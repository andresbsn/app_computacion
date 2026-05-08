import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const WSAA_URLS = {
  test: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  production: "https://wsaa.afip.gov.ar/ws/services/LoginCms"
};

const WSFE_URLS = {
  test: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  production: "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
};

const decodeXmlEntities = (input) =>
  String(input || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractXmlTag = (xml, tagName) => {
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tagName}>([\\s\\S]*?)</(?:[\\w-]+:)?${tagName}>`, "i");
  const match = String(xml || "").match(pattern);
  return match ? match[1].trim() : null;
};

const ensureHttpOk = async (response) => {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  const error = new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);
  error.response = {
    status: response.status,
    statusText: response.statusText,
    data: body
  };
  throw error;
};

const compactXml = (value) => String(value || "").replace(/\r?\n\s*/g, "").trim();

const normalizeAfipDate = (value) => {
  const raw = String(value || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(raw)) {
    return null;
  }
  return raw;
};

export class AfipSoapService {
  constructor({ cuit, production, certPath, keyPath }) {
    const parsedCuit = Number(cuit);
    if (!Number.isInteger(parsedCuit) || parsedCuit <= 0) {
      throw new Error("AFIP_CUIT invalido para servicio SOAP");
    }

    this.cuit = parsedCuit;
    this.production = Boolean(production);
    this.certPath = certPath;
    this.keyPath = keyPath;

    this.token = null;
    this.sign = null;
    this.expiration = null;
  }

  async getAuth() {
    if (this.token && this.sign && this.expiration instanceof Date && new Date() < this.expiration) {
      return { token: this.token, sign: this.sign };
    }
    return this.loginCms();
  }

  buildLoginTicketRequestXml() {
    return compactXml(`
      <?xml version="1.0" encoding="UTF-8"?>
      <loginTicketRequest version="1.0">
        <header>
          <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
          <generationTime>${new Date(Date.now() - 10 * 60 * 1000).toISOString()}</generationTime>
          <expirationTime>${new Date(Date.now() + 10 * 60 * 1000).toISOString()}</expirationTime>
        </header>
        <service>wsfe</service>
      </loginTicketRequest>
    `);
  }

  signTraWithOpenSsl(traXml) {
    const traPath = path.join(os.tmpdir(), `tra_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.xml`);
    const cmsPath = path.join(os.tmpdir(), `cms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pem`);

    try {
      fs.writeFileSync(traPath, traXml, "utf8");

      execFileSync(
        "openssl",
        [
          "smime",
          "-sign",
          "-signer",
          this.certPath,
          "-inkey",
          this.keyPath,
          "-outform",
          "PEM",
          "-nodetach",
          "-in",
          traPath,
          "-out",
          cmsPath
        ],
        { stdio: "pipe" }
      );

      const cmsPem = fs.readFileSync(cmsPath, "utf8");
      const cms = cmsPem
        .replace("-----BEGIN PKCS7-----", "")
        .replace("-----END PKCS7-----", "")
        .replace(/\s/g, "");

      if (!cms) {
        throw new Error("No se pudo generar CMS firmado");
      }

      return cms;
    } catch (error) {
      throw new Error(`Error firmando TRA con openssl: ${error.message}`);
    } finally {
      try {
        fs.unlinkSync(traPath);
      } catch {
        // noop
      }
      try {
        fs.unlinkSync(cmsPath);
      } catch {
        // noop
      }
    }
  }

  async loginCms() {
    if (!fs.existsSync(this.certPath)) {
      throw new Error(`Certificado AFIP no encontrado: ${this.certPath}`);
    }

    if (!fs.existsSync(this.keyPath)) {
      throw new Error(`Clave privada AFIP no encontrada: ${this.keyPath}`);
    }

    const traXml = this.buildLoginTicketRequestXml();
    const cms = this.signTraWithOpenSsl(traXml);

    const soapRequest = compactXml(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dnet.afip.gov.ar/xsd">
        <soapenv:Header/>
        <soapenv:Body>
          <wsaa:loginCms>
            <wsaa:in0>${cms}</wsaa:in0>
          </wsaa:loginCms>
        </soapenv:Body>
      </soapenv:Envelope>
    `);

    const url = this.production ? WSAA_URLS.production : WSAA_URLS.test;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        SOAPAction: ""
      },
      body: soapRequest
    });

    await ensureHttpOk(response);
    const responseXml = await response.text();

    const faultString = extractXmlTag(responseXml, "faultstring") || extractXmlTag(responseXml, "faultcode");
    if (faultString) {
      throw new Error(`WSAA Fault: ${faultString}`);
    }

    const loginCmsReturnRaw = extractXmlTag(responseXml, "loginCmsReturn");
    if (!loginCmsReturnRaw) {
      throw new Error("WSAA loginCmsReturn ausente");
    }

    const ticketXml = decodeXmlEntities(loginCmsReturnRaw);
    const token = extractXmlTag(ticketXml, "token");
    const sign = extractXmlTag(ticketXml, "sign");
    const expirationRaw = extractXmlTag(ticketXml, "expirationTime");

    if (!token || !sign || !expirationRaw) {
      throw new Error("WSAA devolvio ticket incompleto (token/sign/expiration)");
    }

    const expiration = new Date(expirationRaw);
    if (Number.isNaN(expiration.getTime())) {
      throw new Error("WSAA devolvio expirationTime invalido");
    }

    this.token = token;
    this.sign = sign;
    this.expiration = expiration;

    return { token, sign };
  }

  async getLastVoucher(ptoVta, cbteTipo) {
    const { token, sign } = await this.getAuth();
    const url = this.production ? WSFE_URLS.production : WSFE_URLS.test;

    const xmlBody = compactXml(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
        <soapenv:Header/>
        <soapenv:Body>
          <ar:FECompUltimoAutorizado>
            <ar:Auth>
              <ar:Token>${token}</ar:Token>
              <ar:Sign>${sign}</ar:Sign>
              <ar:Cuit>${this.cuit}</ar:Cuit>
            </ar:Auth>
            <ar:PtoVta>${ptoVta}</ar:PtoVta>
            <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
          </ar:FECompUltimoAutorizado>
        </soapenv:Body>
      </soapenv:Envelope>
    `);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"
      },
      body: xmlBody
    });

    await ensureHttpOk(response);
    const responseXml = await response.text();

    const faultString = extractXmlTag(responseXml, "faultstring") || extractXmlTag(responseXml, "faultcode");
    if (faultString) {
      throw new Error(`WSFE Fault (ultimo autorizado): ${faultString}`);
    }

    const cbteNroRaw = extractXmlTag(responseXml, "CbteNro");
    const cbteNro = Number(cbteNroRaw);
    if (!Number.isFinite(cbteNro)) {
      throw new Error("WSFE no devolvio CbteNro valido");
    }

    return cbteNro;
  }

  async createVoucher(request) {
    const { token, sign } = await this.getAuth();
    const url = this.production ? WSFE_URLS.production : WSFE_URLS.test;

    const ivaXml = Array.isArray(request.Iva)
      ? request.Iva.map(
          (iva) => compactXml(`
            <ar:AlicIva>
              <ar:Id>${Number(iva.Id)}</ar:Id>
              <ar:BaseImp>${Number(iva.BaseImp).toFixed(2)}</ar:BaseImp>
              <ar:Importe>${Number(iva.Importe).toFixed(2)}</ar:Importe>
            </ar:AlicIva>
          `)
        ).join("")
      : "";

    const xmlBody = compactXml(`
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
        <soapenv:Header/>
        <soapenv:Body>
          <ar:FECAESolicitar>
            <ar:Auth>
              <ar:Token>${token}</ar:Token>
              <ar:Sign>${sign}</ar:Sign>
              <ar:Cuit>${this.cuit}</ar:Cuit>
            </ar:Auth>
            <ar:FeCAEReq>
              <ar:FeCabReq>
                <ar:CantReg>${Number(request.CantReg || 1)}</ar:CantReg>
                <ar:PtoVta>${Number(request.PtoVta)}</ar:PtoVta>
                <ar:CbteTipo>${Number(request.CbteTipo)}</ar:CbteTipo>
              </ar:FeCabReq>
              <ar:FeDetReq>
                <ar:FECAEDetRequest>
                  <ar:Concepto>${Number(request.Concepto || 1)}</ar:Concepto>
                  <ar:DocTipo>${Number(request.DocTipo)}</ar:DocTipo>
                  <ar:DocNro>${Number(request.DocNro)}</ar:DocNro>
                  <ar:CbteDesde>${Number(request.CbteDesde)}</ar:CbteDesde>
                  <ar:CbteHasta>${Number(request.CbteHasta)}</ar:CbteHasta>
                  <ar:CbteFch>${normalizeAfipDate(request.CbteFch)}</ar:CbteFch>
                  <ar:ImpTotal>${Number(request.ImpTotal).toFixed(2)}</ar:ImpTotal>
                  <ar:ImpTotConc>${Number(request.ImpTotConc || 0).toFixed(2)}</ar:ImpTotConc>
                  <ar:ImpNeto>${Number(request.ImpNeto || 0).toFixed(2)}</ar:ImpNeto>
                  <ar:ImpOpEx>${Number(request.ImpOpEx || 0).toFixed(2)}</ar:ImpOpEx>
                  <ar:ImpTrib>${Number(request.ImpTrib || 0).toFixed(2)}</ar:ImpTrib>
                  <ar:ImpIVA>${Number(request.ImpIVA || 0).toFixed(2)}</ar:ImpIVA>
                  <ar:MonId>${request.MonId || "PES"}</ar:MonId>
                  <ar:MonCotiz>${Number(request.MonCotiz || 1).toFixed(2)}</ar:MonCotiz>
                  ${ivaXml ? `<ar:Iva>${ivaXml}</ar:Iva>` : ""}
                </ar:FECAEDetRequest>
              </ar:FeDetReq>
            </ar:FeCAEReq>
          </ar:FECAESolicitar>
        </soapenv:Body>
      </soapenv:Envelope>
    `);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar"
      },
      body: xmlBody
    });

    await ensureHttpOk(response);
    const responseXml = await response.text();

    const faultString = extractXmlTag(responseXml, "faultstring") || extractXmlTag(responseXml, "faultcode");
    if (faultString) {
      throw new Error(`WSFE Fault (FECAESolicitar): ${faultString}`);
    }

    const resultado = extractXmlTag(responseXml, "Resultado");
    const cae = extractXmlTag(responseXml, "CAE");
    const caeFchVto = extractXmlTag(responseXml, "CAEFchVto");

    if (resultado !== "A") {
      const errCode = extractXmlTag(responseXml, "Code");
      const errMsg = extractXmlTag(responseXml, "Msg");
      const observed = [errCode, errMsg].filter(Boolean).join(" - ");
      throw new Error(`AFIP rechazo comprobante${observed ? `: ${observed}` : ""}`);
    }

    if (!cae || !caeFchVto) {
      throw new Error("AFIP aprobo pero no devolvio CAE/CAEFchVto");
    }

    return {
      CAE: cae,
      CAEFchVto: normalizeAfipDate(caeFchVto),
      rawXml: responseXml
    };
  }
}
