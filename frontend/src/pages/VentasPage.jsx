import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import logoCge from "../../assets/logo.jpeg?inline";

const AFIP_ISSUER_NAME = import.meta.env.VITE_AFIP_ISSUER_NAME || "ZABALA FEDERICO MIGUEL";
const AFIP_ISSUER_ADDRESS = import.meta.env.VITE_AFIP_ISSUER_ADDRESS || "Rivadavia 357";
const AFIP_ISSUER_CITY = import.meta.env.VITE_AFIP_ISSUER_CITY || "Villa Ramallo, Buenos Aires";
const AFIP_ISSUER_CUIL = import.meta.env.VITE_AFIP_ISSUER_CUIL || "20302576239";
const AFIP_ISSUER_GROSS_INCOME = import.meta.env.VITE_AFIP_ISSUER_GROSS_INCOME || AFIP_ISSUER_CUIL;
const AFIP_ISSUER_ACTIVITY_START = import.meta.env.VITE_AFIP_ISSUER_ACTIVITY_START || "01/08/2020";
const AFIP_ISSUER_IVA_CONDITION = import.meta.env.VITE_AFIP_ISSUER_IVA_CONDITION || "IVA Responsable Inscripto";
const AFIP_INVOICE_LEGEND = import.meta.env.VITE_AFIP_INVOICE_LEGEND || '"Insumos - Servicio Tecnico"';
const WORKSHOP_COMPANY_NAME = import.meta.env.VITE_TALLER_RAZON_SOCIAL || "CGE ELECTRONICA";
const AFIP_COMPROBANTE_CODE_BY_LETTER = {
  A: "001",
  B: "006",
  C: "011"
};

const escapeHtml = (value) =>
  String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizeAfipComprobanteTipo = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "A" || normalized === "B") {
    return normalized;
  }

  return null;
};

const resolveAfipComprobanteLabel = (value) => {
  const tipo = normalizeAfipComprobanteTipo(value);
  if (tipo === "A") {
    return "FACTURA A";
  }

  if (tipo === "B") {
    return "FACTURA B";
  }

  return "FACTURA AFIP";
};

const resolveAfipComprobanteCode = (value) => {
  const tipo = normalizeAfipComprobanteTipo(value);
  return AFIP_COMPROBANTE_CODE_BY_LETTER[tipo || ""] || "011";
};

const formatAfipMoney = (value) =>
  Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

const formatAfipQty = (value) =>
  Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

const normalizeClienteCondicionIva = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "inscripto" || normalized === "exento" || normalized === "consumidor_final") {
    return normalized;
  }

  return "consumidor_final";
};

const formatClienteCondicionIvaLabel = (value, afipTipoComprobante) => {
  const normalized = normalizeClienteCondicionIva(value);

  if (normalized === "inscripto") {
    return "Responsable Inscripto";
  }

  if (normalized === "exento") {
    return "IVA Sujeto Exento";
  }

  if (normalized === "consumidor_final") {
    return "Consumidor Final";
  }

  return shouldDiscriminateAfipIva(afipTipoComprobante) ? "Responsable Inscripto" : "Consumidor Final";
};

const resolveAfipTipoComprobanteByClienteCondicion = (condicionIva) =>
  normalizeClienteCondicionIva(condicionIva) === "inscripto" ? "A" : "B";

const shouldDiscriminateAfipIva = (afipTipoComprobante) => normalizeAfipComprobanteTipo(afipTipoComprobante) === "A";

const isVentaAfip = (venta) => {
  const tipo = String(venta?.tipo || "")
    .trim()
    .toLowerCase();
  const comprobanteNumero = String(venta?.comprobante_numero || venta?.comprobante?.numero || "")
    .trim()
    .toUpperCase();
  const afipTipoComprobante = normalizeAfipComprobanteTipo(venta?.afip_tipo_comprobante || venta?.comprobante?.afip_tipo_comprobante);
  const cae = String(venta?.cae || venta?.comprobante?.cae || "").trim();

  return tipo === "afip" || comprobanteNumero.startsWith("AFIP") || Boolean(afipTipoComprobante) || Boolean(cae);
};

const printWhenReady = (printWindow) => {
  let didPrint = false;

  const safePrint = () => {
    if (didPrint) {
      return;
    }
    didPrint = true;
    printWindow.focus();
    printWindow.print();
  };

  const tryPrint = () => {
    const images = Array.from(printWindow.document.images || []);
    if (images.length === 0) {
      setTimeout(safePrint, 50);
      return;
    }

    let pending = images.length;
    const markDone = () => {
      pending -= 1;
      if (pending <= 0) {
        setTimeout(safePrint, 50);
      }
    };

    images.forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        markDone();
        return;
      }
      img.addEventListener("load", markDone, { once: true });
      img.addEventListener("error", markDone, { once: true });
    });

    setTimeout(safePrint, 1500);
  };

  printWindow.addEventListener("load", tryPrint, { once: true });
  setTimeout(tryPrint, 200);
};

const buildVisualQrDataUrl = (value) => {
  const seed = String(value || "CGE-COMPUTACION-QR");
  const size = 21;
  const cell = 5;
  const margin = 4;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  const isFinder = (x, y, startX, startY) => x >= startX && x < startX + 7 && y >= startY && y < startY + 7;
  const isFinderBorder = (x, y, startX, startY) => x === startX || x === startX + 6 || y === startY || y === startY + 6;
  const isFinderCenter = (x, y, startX, startY) => x >= startX + 2 && x <= startX + 4 && y >= startY + 2 && y <= startY + 4;

  let rects = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inTopLeft = isFinder(x, y, 0, 0);
      const inTopRight = isFinder(x, y, size - 7, 0);
      const inBottomLeft = isFinder(x, y, 0, size - 7);

      let fill = false;
      if (inTopLeft) {
        fill = isFinderBorder(x, y, 0, 0) || isFinderCenter(x, y, 0, 0);
      } else if (inTopRight) {
        fill = isFinderBorder(x, y, size - 7, 0) || isFinderCenter(x, y, size - 7, 0);
      } else if (inBottomLeft) {
        fill = isFinderBorder(x, y, 0, size - 7) || isFinderCenter(x, y, 0, size - 7);
      } else {
        const bit = (hash ^ (x * 1103515245) ^ (y * 12345) ^ (x * y * 97)) & 1;
        fill = bit === 1;
      }

      if (fill) {
        rects += `<rect x="${margin + x * cell}" y="${margin + y * cell}" width="${cell}" height="${cell}" fill="#000"/>`;
      }
    }
  }

  const dimension = margin * 2 + size * cell;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const renderAndPrintVentaComprobante = (venta) => {
  const printWindow = window.open("", "_blank", "width=900,height=780");
  if (!printWindow) {
    return;
  }

  const comprobanteNumero = venta?.comprobante?.numero || venta?.comprobante_numero || "-";
  const isAfip = isVentaAfip(venta);
  const afipTipo = normalizeAfipComprobanteTipo(venta?.afip_tipo_comprobante || venta?.comprobante?.afip_tipo_comprobante);
  const comprobanteLabel = isAfip ? resolveAfipComprobanteLabel(afipTipo) : "Comprobante de venta";
  const emisorNombre = isAfip ? AFIP_ISSUER_NAME : "CGE Computacion";
  const items = venta?.items || [];
  const subtotalCalculado = items.reduce((acc, item) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0);
  const subtotal = Number(venta?.subtotal ?? subtotalCalculado);
  const total = Number(venta?.total ?? subtotal);

  if (isAfip) {
    const matches = String(comprobanteNumero).match(/(\d{4})-(\d{8})/);
    const puntoVenta = matches?.[1] || "-";
    const nroComprobante = matches?.[2] || String(comprobanteNumero).replace(/^AFIP-?/i, "") || "-";
    const afipComprobanteCode = resolveAfipComprobanteCode(afipTipo);
    const cae = venta?.cae || venta?.comprobante?.cae || "-";
    const caeVtoRaw = venta?.cae_vto || venta?.comprobante?.cae_vto || null;
    const caeVto = caeVtoRaw ? dayjs(caeVtoRaw).format("DD/MM/YYYY") : "-";
    const visualQr = buildVisualQrDataUrl(`${afipTipo}|${comprobanteNumero}|${cae}|${total.toFixed(2)}`);
    const ivaAlicuota = Number(venta?.afip_iva_alicuota || 0);
    const ivaImporte = Number(venta?.afip_iva_importe ?? Math.max(total - subtotal, 0));
    const discriminaIva = shouldDiscriminateAfipIva(afipTipo);
    const subtotalNeto = discriminaIva ? Math.max(total - ivaImporte, 0) : total;
    const clienteCuit = venta?.cliente_cuit || "-";
    const clienteCondicionIvaLabel = formatClienteCondicionIvaLabel(venta?.cliente_condicion_iva, afipTipo);
    const clienteRazonSocial = venta?.cliente_nombre || "Consumidor final";
    const clienteDomicilio = venta?.cliente_direccion || "-";
    const condicionVenta = venta?.forma_pago ? String(venta.forma_pago).toLowerCase() === "efectivo" ? "Contado" : String(venta.forma_pago) : "Contado";
    const fechaEmision = dayjs(venta?.fecha || new Date()).format("DD/MM/YYYY");
    const ivaContenido = !discriminaIva && ivaAlicuota > 0 ? total * (ivaAlicuota / (100 + ivaAlicuota)) : 0;

    const afipItemsRows =
      items.length > 0
        ? items
            .map((item) => {
              const cantidad = Number(item?.cantidad || 0);
              const itemSubtotal = Number(item?.subtotal ?? cantidad * Number(item?.precio_unitario || 0));
              const itemTotal = discriminaIva ? itemSubtotal * (1 + ivaAlicuota / 100) : itemSubtotal;
              const precioUnitario = cantidad > 0 ? itemSubtotal / cantidad : itemSubtotal;

              return discriminaIva
                ? `
                <tr>
                  <td></td>
                  <td>${escapeHtml(item.descripcion || "-")}</td>
                  <td class="num">${formatAfipQty(cantidad)}</td>
                  <td>unidades</td>
                  <td class="num">${formatAfipMoney(precioUnitario)}</td>
                  <td class="num">0,00</td>
                  <td class="num">${formatAfipMoney(itemSubtotal)}</td>
                  <td class="num">${formatAfipMoney(ivaAlicuota)}%</td>
                  <td class="num">${formatAfipMoney(itemTotal)}</td>
                </tr>
              `
                : `
                <tr>
                  <td></td>
                  <td>${escapeHtml(item.descripcion || "-")}</td>
                  <td class="num">${formatAfipQty(cantidad)}</td>
                  <td>unidades</td>
                  <td class="num">${formatAfipMoney(precioUnitario)}</td>
                  <td class="num">0,00</td>
                  <td class="num">0,00</td>
                  <td class="num">${formatAfipMoney(itemSubtotal)}</td>
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="${discriminaIva ? 9 : 8}" class="empty-row">Sin items registrados.</td></tr>`;

    const afipHtml = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(comprobanteLabel)} ${escapeHtml(comprobanteNumero)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 0; background: #fff; color: #000; }
            .invoice { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 4mm 3.5mm; }
            .box { border: 1px solid #222; }
            .original { text-align: center; font-weight: 700; font-size: 18px; padding: 4px 0 5px; }
            .header { display: grid; grid-template-columns: 1.3fr 85px 1.3fr; }
            .header-col { border-right: 1px solid #222; min-height: 120px; padding: 8px; }
            .header-col:last-child { border-right: 0; }
            .brand-title { font-size: 14px; font-weight: 700; text-align: center; margin: 10px 0 24px; }
            .seller-line { margin: 8px 0 0; font-size: 11px; }
            .seller-line strong { font-size: 11px; }
            .center-box { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .center-box .letter { font-size: 40px; font-weight: 700; line-height: 0.9; }
            .center-box .code { font-size: 11px; margin-top: 4px; font-weight: 700; }
            .doc-title { text-align: left; font-size: 26px; font-weight: 700; margin: 0 0 16px; }
            .doc-line { margin: 6px 0; font-size: 12px; font-weight: 400; white-space: nowrap; }
            .doc-line .doc-label { font-weight: 700; }
            .period { border-left: 1px solid #222; border-right: 1px solid #222; border-bottom: 1px solid #222; display: grid; grid-template-columns: 1fr 1fr 1.3fr; padding: 4px 8px; font-size: 12px; font-weight: 700; }
            .row { border: 1px solid #222; border-top: 0; padding: 4px 8px; font-size: 11px; }
            .row.grid-two { display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px; }
            .row p { margin: 5px 0; }
            .items { width: 100%; border-collapse: collapse; margin-top: 2px; }
            .items th, .items td { border: 1px solid #222; padding: 3px 4px; font-size: 11px; }
            .items th { text-align: left; background: #cfcfcf; font-size: 10px; }
            .items .num { text-align: right; }
            .items .empty-row { text-align: center; }
            .body-spacer { min-height: 122mm; border-left: 1px solid #222; border-right: 1px solid #222; }
            .footer-box { border: 1px solid #222; margin-top: 0; padding: 6px 8px; display: grid; grid-template-columns: 1fr 310px; gap: 12px; align-items: end; }
            .totals { width: 100%; border-collapse: collapse; }
            .totals td { border: 0; padding: 2px 4px; font-size: 11px; font-weight: 700; }
            .totals td:first-child { text-align: right; font-weight: 700; }
            .totals td:last-child { text-align: right; width: 46%; }
            .totals .final td { font-weight: 700; }
            .transparency { border: 1px solid #222; border-top: 0; min-height: 20mm; padding: 4px; font-size: 11px; font-weight: 700; }
            .legend { border: 1px solid #222; border-top: 0; text-align: center; padding: 8px; font-size: 12px; font-style: italic; font-weight: 700; }
            .bottom-strip { display: grid; grid-template-columns: 110px 1fr 230px; align-items: end; gap: 18px; margin-top: 10px; }
            .qr-block img { width: 88px; height: 88px; display: block; border: 1px solid #222; }
            .arca { font-size: 28px; font-weight: 800; letter-spacing: 1px; }
            .bottom-note p { margin: 2px 0; font-size: 10px; }
            .bottom-note .auth { margin-top: 5px; font-size: 12px; font-weight: 700; font-style: italic; }
            .page-number { text-align: center; font-size: 12px; font-weight: 700; }
            .cae { font-size: 12px; font-weight: 700; text-align: right; }
            .cae p { margin: 5px 0; }
            @media print {
              @page { size: A4 portrait; margin: 0; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <section class="invoice">
            <div class="box original">ORIGINAL</div>

            <header class="box header">
              <section class="header-col">
                <p class="brand-title">${escapeHtml(WORKSHOP_COMPANY_NAME)}</p>
                <p class="seller-line"><strong>Razón Social:</strong> ${escapeHtml(AFIP_ISSUER_NAME)}</p>
                <p class="seller-line"><strong>Domicilio Comercial:</strong> ${escapeHtml(AFIP_ISSUER_ADDRESS)} - ${escapeHtml(AFIP_ISSUER_CITY)}</p>
                <p class="seller-line"><strong>Condición frente al IVA:</strong> ${escapeHtml(AFIP_ISSUER_IVA_CONDITION)}</p>
              </section>

              <section class="header-col center-box">
                <div class="letter">${escapeHtml(afipTipo || "A")}</div>
                <div class="code">COD. ${escapeHtml(afipComprobanteCode)}</div>
              </section>

              <section class="header-col">
                <h2 class="doc-title">FACTURA</h2>
                <p class="doc-line"><span class="doc-label">Punto de Venta:</span> ${escapeHtml(puntoVenta)} &nbsp;&nbsp; <span class="doc-label">Comp. Nro:</span> ${escapeHtml(nroComprobante)}</p>
                <p class="doc-line"><span class="doc-label">Fecha de Emisión:</span> ${escapeHtml(fechaEmision)}</p>
                <p class="doc-line"><span class="doc-label">CUIT:</span> ${escapeHtml(AFIP_ISSUER_CUIL)}</p>
                <p class="doc-line"><span class="doc-label">Ingresos Brutos:</span> ${escapeHtml(AFIP_ISSUER_GROSS_INCOME)}</p>
                <p class="doc-line"><span class="doc-label">Fecha de Inicio de Actividades:</span> ${escapeHtml(AFIP_ISSUER_ACTIVITY_START)}</p>
              </section>
            </header>

            ${discriminaIva ? `<section class="period"><div>Período Facturado Desde: ${escapeHtml(fechaEmision)}</div><div>Hasta: ${escapeHtml(fechaEmision)}</div><div>Fecha de Vto. para el pago: ${escapeHtml(fechaEmision)}</div></section>` : ""}

            <section class="row grid-two">
              <div>
                <p><strong>CUIT:</strong> ${escapeHtml(clienteCuit)}</p>
                <p><strong>Condición frente al IVA:</strong> ${escapeHtml(clienteCondicionIvaLabel)}</p>
                <p><strong>Condición de venta:</strong> ${escapeHtml(condicionVenta)}</p>
              </div>
              <div>
                <p><strong>Apellido y Nombre / Razón Social:</strong> ${escapeHtml(clienteRazonSocial)}</p>
                <p><strong>${discriminaIva ? "Domicilio Comercial" : "Domicilio"}:</strong> ${escapeHtml(clienteDomicilio)}</p>
              </div>
            </section>

            <table class="items">
              <thead>
                <tr>
                  ${discriminaIva
                    ? `<th style="width: 7%;">Código</th><th style="width: 31%;">Producto / Servicio</th><th style="width: 9%;">Cantidad</th><th style="width: 8%;">U. medida</th><th style="width: 12%;">Precio Unit.</th><th style="width: 8%;">% Bonif</th><th style="width: 12%;">Subtotal</th><th style="width: 7%;">Alicuota IVA</th><th style="width: 13%;">Subtotal c/IVA</th>`
                    : `<th style="width: 7%;">Código</th><th style="width: 34%;">Producto / Servicio</th><th style="width: 11%;">Cantidad</th><th style="width: 9%;">U. Medida</th><th style="width: 14%;">Precio Unit.</th><th style="width: 8%;">% Bonif</th><th style="width: 10%;">Imp. Bonif.</th><th style="width: 16%;">Subtotal</th>`}
                </tr>
              </thead>
              <tbody>
                ${afipItemsRows}
              </tbody>
            </table>

            <div class="body-spacer"></div>

            <section class="footer-box">
              <div class="cae">
                ${discriminaIva ? `<p>Importe Otros Tributos: $ ${formatAfipMoney(0)}</p>` : ""}
              </div>
              <table class="totals">
                <tbody>
                  ${discriminaIva
                    ? `<tr><td>Importe Neto Gravado: $</td><td>${formatAfipMoney(subtotalNeto)}</td></tr><tr><td>IVA 27%: $</td><td>${formatAfipMoney(0)}</td></tr><tr><td>IVA 21%: $</td><td>${formatAfipMoney(ivaAlicuota === 21 ? ivaImporte : 0)}</td></tr><tr><td>IVA 10.5%: $</td><td>${formatAfipMoney(ivaAlicuota === 10.5 ? ivaImporte : 0)}</td></tr><tr><td>IVA 5%: $</td><td>${formatAfipMoney(0)}</td></tr><tr><td>IVA 2.5%: $</td><td>${formatAfipMoney(0)}</td></tr><tr><td>IVA 0%: $</td><td>${formatAfipMoney(0)}</td></tr><tr><td>Importe Otros Tributos: $</td><td>${formatAfipMoney(0)}</td></tr><tr class="final"><td>Importe Total: $</td><td>${formatAfipMoney(total)}</td></tr>`
                    : `<tr><td>Subtotal: $</td><td>${formatAfipMoney(total)}</td></tr><tr><td>Importe Otros Tributos: $</td><td>${formatAfipMoney(0)}</td></tr><tr class="final"><td>Importe Total: $</td><td>${formatAfipMoney(total)}</td></tr>`}
                </tbody>
              </table>
            </section>

            ${!discriminaIva ? `<section class="transparency"><p>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</p><p style="margin-left: 170px;">IVA Contenido: $ ${formatAfipMoney(ivaContenido)}</p></section>` : ""}

            <section class="legend">${escapeHtml(AFIP_INVOICE_LEGEND)}</section>

            <section class="bottom-strip">
              <div class="qr-block">
                <img src="${visualQr}" alt="QR visual de factura" />
              </div>
              <div class="bottom-note">
                <div class="arca">ARCA</div>
                <p class="auth">Comprobante Autorizado</p>
                <p>Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operación</p>
              </div>
              <div><p class="page-number">Pág. 1/1</p><div class="cae"><p>CAE N°: ${escapeHtml(cae)}</p><p>Fecha de Vto. de CAE: ${escapeHtml(caeVto)}</p></div></div>
            </section>
          </section>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(afipHtml);
    printWindow.document.close();
    printWhenReady(printWindow);
    return;
  }

  const fiscalBlock = isAfip
    ? `
      <p class="muted"><b>Razon social:</b> ${escapeHtml(AFIP_ISSUER_NAME)}</p>
      <p class="muted"><b>Domicilio:</b> ${escapeHtml(AFIP_ISSUER_ADDRESS)}</p>
      <p class="muted"><b>Localidad:</b> ${escapeHtml(AFIP_ISSUER_CITY)}</p>
      <p class="muted"><b>CUIL:</b> ${escapeHtml(AFIP_ISSUER_CUIL)}</p>
    `
    : "";

  const itemsRows =
    items.length > 0
      ? items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.descripcion || "-")}</td>
                <td>${Number(item.cantidad || 0).toFixed(2)}</td>
                <td>$${Number(item.precio_unitario || 0).toFixed(2)}</td>
                <td>$${Number(item.subtotal ?? Number(item.cantidad || 0) * Number(item.precio_unitario || 0)).toFixed(2)}</td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="4">Sin items registrados.</td>
        </tr>
      `;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Comprobante Venta #${escapeHtml(venta?.id)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 68px; height: 68px; object-fit: cover; border-radius: 8px; }
          .brand h1 { margin: 0; font-size: 22px; }
          .muted { color: #475569; margin: 2px 0; font-size: 13px; }
          .section { margin-top: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
          th { background: #e2e8f0; text-align: left; }
          .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 12px; }
          .fiscal-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <header class="header">
          <div class="brand">
            <img src="${logoCge}" alt="Logo CGE Computacion" />
            <div>
              <h1>${escapeHtml(emisorNombre)}</h1>
              <p class="muted">${escapeHtml(comprobanteLabel)}</p>
            </div>
          </div>
          <div>
            <p class="muted"><b>Comprobante:</b> ${escapeHtml(comprobanteNumero)}</p>
            <p class="muted"><b>Fecha:</b> ${escapeHtml(dayjs(venta?.fecha || new Date()).format("DD/MM/YYYY HH:mm"))}</p>
            <p class="muted"><b>Tipo:</b> ${escapeHtml(venta?.tipo || "-")}</p>
          </div>
        </header>

        ${isAfip ? `<section class="section fiscal-box">${fiscalBlock}</section>` : ""}

        <section class="section">
          <p class="muted"><b>Cliente:</b> ${escapeHtml(venta?.cliente_nombre || "Consumidor final")}</p>
          <p class="muted"><b>Forma de pago:</b> ${escapeHtml(venta?.forma_pago || "-")}</p>
          <p class="muted"><b>Origen:</b> ${escapeHtml(venta?.origen || "-")}</p>
        </section>

        <section class="section">
          <table>
            <thead>
              <tr>
                <th>Descripcion</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <p class="muted" style="text-align: right;"><b>SUBTOTAL:</b> $${subtotal.toFixed(2)}</p>
          <p class="total">TOTAL: $${total.toFixed(2)}</p>
          ${
            isAfip
              ? `<p class="muted" style="text-align: right;"><b>CAE:</b> ${escapeHtml(venta?.cae || venta?.comprobante?.cae || "-")} | <b>Vto CAE:</b> ${escapeHtml(
                  venta?.cae_vto || venta?.comprobante?.cae_vto
                    ? dayjs(venta?.cae_vto || venta?.comprobante?.cae_vto).format("DD/MM/YYYY")
                    : "-"
                )}</p>`
              : ""
          }
        </section>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWhenReady(printWindow);
};

const renderAndPrintRawHtml = (html) => {
  const printWindow = window.open("", "_blank", "width=980,height=820");
  if (!printWindow) {
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWhenReady(printWindow);
};

const createEmptyItem = () => ({
  tipo_item: "producto",
  producto_id: "",
  producto_search: "",
  descripcion: "",
  cantidad: "1",
  precio_unitario: "0"
});

function VentasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [origenFilter, setOrigenFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [formError, setFormError] = useState("");
  const [reprintVentaId, setReprintVentaId] = useState(null);
  const [reprintError, setReprintError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    tipo: "local",
    afip_tipo_comprobante: "B",
    afip_iva_alicuota: "21",
    origen: "mostrador",
    cliente_id: "",
    orden_id: "",
    descuento: "0",
    impuestos: "0",
    forma_pago: "efectivo",
    monto_pagado: "",
    items: [createEmptyItem()]
  });

  const ventasQuery = useQuery({
    queryKey: ["ventas", search, tipoFilter, origenFilter],
    queryFn: () =>
      api.ventas.list({
        search,
        tipo: tipoFilter,
        origen: origenFilter
      })
  });
  const clientesQuery = useQuery({ queryKey: ["clientes"], queryFn: () => api.clientes.list("") });
  const productosQuery = useQuery({ queryKey: ["productos"], queryFn: () => api.productos.list("") });
  const ordenesQuery = useQuery({ queryKey: ["ordenes"], queryFn: () => api.ordenes.list({}) });
  const detalleQuery = useQuery({
    queryKey: ["venta-detalle", detailId],
    queryFn: () => api.ventas.getById(detailId),
    enabled: Boolean(detailId)
  });

  const createMutation = useMutation({
    mutationFn: api.ventas.create,
    onSuccess: () => {
      setForm({
        tipo: "local",
        afip_tipo_comprobante: "B",
        afip_iva_alicuota: "21",
        origen: "mostrador",
        cliente_id: "",
        orden_id: "",
        descuento: "0",
        impuestos: "0",
        forma_pago: "efectivo",
        monto_pagado: "",
        items: [createEmptyItem()]
      });
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ventas"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    }
  });

  const subtotal = form.items.reduce((acc, item) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0);
  const baseImponible = subtotal - Number(form.descuento || 0) + Number(form.impuestos || 0);
  const clientes = clientesQuery.data || [];
  const productos = productosQuery.data || [];
  const ordenes = ordenesQuery.data || [];
  const ventas = ventasQuery.data || [];
  const ventaDetalle = detalleQuery.data;
  const clienteSeleccionado = useMemo(
    () => clientes.find((cliente) => Number(cliente.id) === Number(form.cliente_id)) || null,
    [clientes, form.cliente_id]
  );
  const clienteSeleccionadoCondicionIva = normalizeClienteCondicionIva(clienteSeleccionado?.condicion_iva);
  const afipTipoComprobanteSugerido = resolveAfipTipoComprobanteByClienteCondicion(clienteSeleccionadoCondicionIva);
  const discriminaIvaAfipForm = form.tipo === "afip" && shouldDiscriminateAfipIva(afipTipoComprobanteSugerido);
  const afipIvaAlicuota = form.tipo === "afip" ? Number(form.afip_iva_alicuota || 0) : 0;
  const afipIvaImporte = form.tipo === "afip" ? (baseImponible * afipIvaAlicuota) / 100 : 0;
  const total = baseImponible + afipIvaImporte;
  const isConsumidorFinal = !form.cliente_id;

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(ventas.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const ventasPaginadas = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return ventas.slice(start, start + PAGE_SIZE);
  }, [ventas, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, tipoFilter, origenFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (form.tipo === "afip" && form.afip_tipo_comprobante !== afipTipoComprobanteSugerido) {
      setForm((prev) => ({ ...prev, afip_tipo_comprobante: afipTipoComprobanteSugerido }));
    }
  }, [form.tipo, form.afip_tipo_comprobante, afipTipoComprobanteSugerido]);

  const openCreate = () => {
    setFormError("");
    setForm({
      tipo: "local",
      afip_tipo_comprobante: "B",
      afip_iva_alicuota: "21",
      origen: "mostrador",
      cliente_id: "",
      orden_id: "",
      descuento: "0",
      impuestos: "0",
      forma_pago: "efectivo",
      monto_pagado: "",
      items: [createEmptyItem()]
    });
    setIsFormOpen(true);
  };

  const openDetail = (venta) => {
    setDetailId(venta.id);
    setIsDetailOpen(true);
  };

  const handleReprintComprobante = async (ventaId) => {
    setReprintError("");
    setReprintVentaId(ventaId);

    try {
      const ventaDetalleCompleto = await queryClient.fetchQuery({
        queryKey: ["venta-detalle", ventaId],
        queryFn: () => api.ventas.getById(ventaId)
      });

      const esOrdenConFacturaLocal = ventaDetalleCompleto?.origen === "orden" && !isVentaAfip(ventaDetalleCompleto);

      if (esOrdenConFacturaLocal) {
        const technicalReportHtml = await api.ventas.getTechnicalReportHtml(ventaId);
        renderAndPrintRawHtml(technicalReportHtml);
        return;
      }

      renderAndPrintVentaComprobante(ventaDetalleCompleto);
    } catch (error) {
      setReprintError(error.message || "No se pudo reimprimir el comprobante.");
    } finally {
      setReprintVentaId(null);
    }
  };

  const updateItem = (index, patch) => {
    setForm((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], ...patch };
      return { ...prev, items: next };
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Ventas</h2>
          <p className="status">ABM operativo de ventas y comprobantes.</p>
        </div>
        <button onClick={openCreate}>Nueva venta</button>
      </div>

      <section className="card toolbar">
        <input placeholder="Buscar por id, cliente o comprobante" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="local">Local</option>
          <option value="afip">AFIP</option>
        </select>
        <select value={origenFilter} onChange={(e) => setOrigenFilter(e.target.value)}>
          <option value="">Todos los origenes</option>
          <option value="mostrador">Mostrador</option>
          <option value="orden">Orden</option>
        </select>
      </section>
      <section className="card toolbar" style={{ gridTemplateColumns: "auto auto" }}>
        <button className="secondary" onClick={() => ventasQuery.refetch()}>
          Buscar
        </button>
        <button
          className="danger"
          onClick={() => {
            setSearch("");
            setTipoFilter("");
            setOrigenFilter("");
          }}
        >
          Limpiar
        </button>
      </section>

      <section className="card">
        <h3>Listado de ventas</h3>
        {reprintError ? <p className="error">{reprintError}</p> : null}
        {ventasQuery.isLoading ? (
          <div className="empty-state">Cargando ventas...</div>
        ) : (
          <>
            {ventas.length === 0 ? <div className="empty-state">No hay ventas para mostrar con los filtros aplicados.</div> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tipo</th>
                    <th>Origen</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Comprobante</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasPaginadas.map((v) => (
                    <tr key={v.id}>
                      <td>{v.id}</td>
                      <td>{v.tipo}</td>
                      <td>{v.origen}</td>
                      <td>{v.cliente_nombre || "-"}</td>
                      <td>${Number(v.total).toFixed(2)}</td>
                      <td>{v.comprobante_numero || "-"}</td>
                      <td>{dayjs(v.fecha).format("DD/MM/YYYY HH:mm")}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" onClick={() => openDetail(v)}>
                            Ver
                          </button>
                          <button className="secondary" onClick={() => handleReprintComprobante(v.id)} disabled={reprintVentaId === v.id}>
                            {reprintVentaId === v.id ? "Preparando..." : "Reimprimir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ventas.length > PAGE_SIZE ? (
              <div className="actions" style={{ marginTop: 10 }}>
                <button type="button" className="secondary" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={safeCurrentPage === 1}>
                  Anterior
                </button>
                <span className="status" style={{ alignSelf: "center" }}>
                  Pagina {safeCurrentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Modal open={isFormOpen} onClose={() => setIsFormOpen(false)} title="Nueva venta" width={1000} closeOnOverlayClick={false}>
        <form
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
              e.preventDefault();
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();

            const montoPagadoCalculado = isConsumidorFinal
              ? Number(total.toFixed(2))
              : form.monto_pagado === ""
                ? 0
                : Number(form.monto_pagado);

            if (!Number.isFinite(montoPagadoCalculado) || montoPagadoCalculado < 0) {
              setFormError("Monto pagado invalido.");
              return;
            }

            if (isConsumidorFinal && Math.abs(montoPagadoCalculado - total) > 0.01) {
              setFormError("Consumidor final debe registrar el pago total de la venta.");
              return;
            }

            if (montoPagadoCalculado > total) {
              setFormError("El monto pagado no puede superar el total.");
              return;
            }

            setFormError("");
            createMutation.mutate({
              ...form,
              afip_tipo_comprobante: form.tipo === "afip" ? afipTipoComprobanteSugerido : null,
              afip_iva_alicuota: form.tipo === "afip" ? Number(form.afip_iva_alicuota) : null,
              cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
              orden_id: form.orden_id ? Number(form.orden_id) : null,
              descuento: Number(form.descuento || 0),
              impuestos: Number(form.impuestos || 0),
              monto_pagado: montoPagadoCalculado,
              items: form.items.map((item) => ({
                ...item,
                producto_id: item.producto_id ? Number(item.producto_id) : null,
                cantidad: Number(item.cantidad),
                precio_unitario: Number(item.precio_unitario)
              }))
            });
          }}
        >
          <label>
            Tipo comprobante
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="local">Local</option>
              <option value="afip">AFIP</option>
            </select>
          </label>
          {form.tipo === "afip" ? (
            <>
              <label>
                Comprobante AFIP
                <select
                  value={form.afip_tipo_comprobante}
                  onChange={(e) => setForm({ ...form, afip_tipo_comprobante: e.target.value })}
                  disabled
                  required
                >
                  <option value="A">Factura A (cliente inscripto)</option>
                  <option value="B">Factura B (consumidor final/exento)</option>
                </select>
              </label>
              <label>
                IVA AFIP
                <select
                  value={form.afip_iva_alicuota}
                  onChange={(e) => setForm({ ...form, afip_iva_alicuota: e.target.value })}
                  required
                >
                  <option value="10.5">10.5%</option>
                  <option value="21">21%</option>
                </select>
              </label>
            </>
          ) : null}
          <label>
            Origen
            <select value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
              <option value="mostrador">Mostrador</option>
              <option value="orden">Orden reparacion</option>
            </select>
          </label>
          {form.origen === "orden" ? (
            <label>
              Orden
              <select value={form.orden_id} onChange={(e) => setForm({ ...form, orden_id: e.target.value })} required>
                <option value="">Seleccione...</option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.nro_orden} - {o.cliente_nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Cliente
            <select
              value={form.cliente_id}
              onChange={(e) => {
                const nextClienteId = e.target.value;
                setFormError("");
                setForm({
                  ...form,
                  cliente_id: nextClienteId,
                  monto_pagado: nextClienteId ? total.toFixed(2) : ""
                });
              }}
            >
              <option value="">Consumidor final / sin cuenta corriente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="card">
            <h4>Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.1fr 1.6fr 1.5fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                <select value={item.tipo_item} onChange={(e) => updateItem(idx, { tipo_item: e.target.value })}>
                  <option value="producto">Producto</option>
                  <option value="repuesto">Repuesto</option>
                  <option value="servicio">Servicio</option>
                </select>
                <input
                  placeholder="Buscar producto..."
                  value={item.producto_search || ""}
                  onChange={(e) => {
                    const searchValue = e.target.value;
                    const normalized = searchValue.trim().toLowerCase();
                    const productoSeleccionado = productos.find((p) => String(p.id) === String(item.producto_id));
                    const productoSigueVisible =
                      !normalized ||
                      (productoSeleccionado &&
                        `${productoSeleccionado.nombre || ""} ${productoSeleccionado.codigo || ""}`
                          .toLowerCase()
                          .includes(normalized));

                    updateItem(idx, {
                      producto_search: searchValue,
                      ...(productoSigueVisible ? {} : { producto_id: "" })
                    });
                  }}
                />
                <select
                  value={item.producto_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedProduct = productos.find((p) => String(p.id) === String(selectedId));

                    updateItem(idx, {
                      producto_id: selectedId,
                      precio_unitario: selectedProduct ? String(selectedProduct.precio ?? 0) : item.precio_unitario,
                      producto_search: selectedProduct
                        ? `${selectedProduct.nombre}${selectedProduct.codigo ? ` (${selectedProduct.codigo})` : ""}`
                        : item.producto_search,
                      descripcion: selectedProduct && !item.descripcion ? selectedProduct.nombre : item.descripcion
                    });
                  }}
                >
                  <option value="">Sin producto</option>
                  {(
                    (item.producto_search || "").trim()
                      ? productos.filter((p) =>
                          `${p.nombre || ""} ${p.codigo || ""}`
                            .toLowerCase()
                            .includes((item.producto_search || "").trim().toLowerCase())
                        )
                      : productos
                  ).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <input placeholder="Descripcion" value={item.descripcion} onChange={(e) => updateItem(idx, { descripcion: e.target.value })} />
                <input type="number" step="0.01" value={item.cantidad} onChange={(e) => updateItem(idx, { cantidad: e.target.value })} />
                <input
                  type="number"
                  step="0.01"
                  value={item.precio_unitario}
                  onChange={(e) => updateItem(idx, { precio_unitario: e.target.value })}
                />
                <button
                  className="danger"
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.filter((_, i) => i !== idx)
                    }))
                  }
                  disabled={form.items.length === 1}
                >
                  X
                </button>
              </div>
            ))}
            <button
              className="secondary"
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }))}
            >
              Agregar item
            </button>
          </div>

          <label>
            Descuento
            <input type="number" step="0.01" value={form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} />
          </label>
          <label>
            Impuestos
            <input type="number" step="0.01" value={form.impuestos} onChange={(e) => setForm({ ...form, impuestos: e.target.value })} />
          </label>
          <label>
            Forma pago
            <select value={form.forma_pago} onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="mixto">Mixto</option>
            </select>
          </label>
          <label>
            Monto pagado
            <input
              type="number"
              step="0.01"
              value={isConsumidorFinal ? total.toFixed(2) : form.monto_pagado}
              onChange={(e) => {
                setFormError("");
                if (!isConsumidorFinal) {
                  setForm({ ...form, monto_pagado: e.target.value });
                }
              }}
              readOnly={isConsumidorFinal}
            />
          </label>

          <p className="status">
            {isConsumidorFinal
              ? "Consumidor final: se registra pago total obligatorio."
              : "Cliente con cuenta corriente: si el monto pagado es menor al total, la diferencia se registra como deuda."}
          </p>

          <p className="status">
            Subtotal: ${subtotal.toFixed(2)} | Base imponible: ${baseImponible.toFixed(2)}
            {discriminaIvaAfipForm ? ` | IVA ${afipIvaAlicuota.toFixed(1)}%: $${afipIvaImporte.toFixed(2)}` : ""} | Total: ${total.toFixed(2)}
          </p>
          <button type="submit" disabled={createMutation.isPending}>
            Confirmar venta
          </button>
          {formError ? <span className="error">{formError}</span> : null}
          {createMutation.error ? <span className="error">{createMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailId(null);
        }}
        title={ventaDetalle ? `Venta #${ventaDetalle.id}` : "Detalle venta"}
        width={960}
      >
        {ventaDetalle ? (
          <>
            <div className="grid">
              <section className="card">
                <h3>Datos de venta</h3>
                <p><b>Tipo:</b> {ventaDetalle.tipo}</p>
                <p><b>Origen:</b> {ventaDetalle.origen}</p>
                <p><b>Cliente:</b> {ventaDetalle.cliente_nombre || "-"}</p>
                <p><b>Forma pago:</b> {ventaDetalle.forma_pago}</p>
                <p><b>Subtotal:</b> ${Number(ventaDetalle.subtotal).toFixed(2)}</p>
                {ventaDetalle.tipo === "afip" && ventaDetalle.afip_iva_alicuota ? (
                  <p><b>IVA ({Number(ventaDetalle.afip_iva_alicuota).toFixed(1)}%):</b> ${Number(ventaDetalle.afip_iva_importe || 0).toFixed(2)}</p>
                ) : null}
                <p><b>Total:</b> ${Number(ventaDetalle.total).toFixed(2)}</p>
              </section>
              <section className="card">
                <h3>Comprobante</h3>
                <p><b>Numero:</b> {ventaDetalle.comprobante_numero || "-"}</p>
                <p><b>CAE:</b> {ventaDetalle.cae || "-"}</p>
                <p><b>Vto CAE:</b> {ventaDetalle.cae_vto ? dayjs(ventaDetalle.cae_vto).format("DD/MM/YYYY") : "-"}</p>
                <p><b>Fecha:</b> {dayjs(ventaDetalle.fecha).format("DD/MM/YYYY HH:mm")}</p>
              </section>
            </div>

            <section className="card" style={{ marginTop: 12 }}>
              <h3>Items</h3>
              {(ventaDetalle.items || []).length === 0 ? (
                <div className="empty-state">No hay items registrados para esta venta.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Descripcion</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ventaDetalle.items || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.tipo_item}</td>
                          <td>{item.descripcion}</td>
                          <td>{Number(item.cantidad).toFixed(2)}</td>
                          <td>${Number(item.precio_unitario).toFixed(2)}</td>
                          <td>${Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <p>Cargando...</p>
        )}
      </Modal>
    </div>
  );
}

export default VentasPage;
