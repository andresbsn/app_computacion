import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import logoCge from "../../assets/logo.jpeg?inline";

const AFIP_ISSUER_NAME = import.meta.env.VITE_AFIP_ISSUER_NAME || "Federico Zabala";
const AFIP_ISSUER_ADDRESS = import.meta.env.VITE_AFIP_ISSUER_ADDRESS || "Rivadavia 357";
const AFIP_ISSUER_CITY = import.meta.env.VITE_AFIP_ISSUER_CITY || "Villa Ramallo";
const WORKSHOP_COMPANY_NAME = import.meta.env.VITE_TALLER_RAZON_SOCIAL || AFIP_ISSUER_NAME || "CGE Computacion";
const WORKSHOP_COMPANY_ADDRESS = import.meta.env.VITE_TALLER_DIRECCION || AFIP_ISSUER_ADDRESS || "-";
const WORKSHOP_COMPANY_PHONE = import.meta.env.VITE_TALLER_TELEFONO || "3407411490";

const initialOrden = {
  cliente_id: "",
  equipo: "",
  marca: "",
  modelo: "",
  contrasena_equipo: "",
  diagnostico_inicial: "",
  trajo_cargador: false,
  observaciones: "",
  estado_actual: "ingresada",
  prioridad: "media"
};

const initialClienteForm = {
  nombre: "",
  telefono: "",
  email: "",
  documento: "",
  direccion: "",
  ciudad: "",
  provincia: "",
  cuit: "",
  condicion_iva: "consumidor_final",
  observaciones: ""
};

const initialMov = {
  detalle: "",
  precio: ""
};

const initialFacturaForm = {
  tipo: "local",
  afip_tipo_comprobante: "B",
  forma_pago: "efectivo",
  modo_detalle: "manual",
  manual_item_descripcion: "",
  manual_item_precio_unitario: "",
  manual_items: []
};

const mapEmailReasonToMessage = (reason) => {
  const reasons = {
    cliente_sin_email: "el cliente no tiene email cargado",
    smtp_no_configurado: "SMTP no configurado",
    reporte_no_encontrado: "no se pudo construir el reporte técnico",
    email_error: "ocurrió un error enviando el email"
  };

  return reasons[reason] || `motivo desconocido (${reason || "sin_detalle"})`;
};

const mapMovimientosToFacturaItems = (movimientos = []) =>
  movimientos
    .filter((mov) => mov.detalle && mov.detalle.trim())
    .map((mov) => ({
      tipo_item: "servicio",
      producto_id: null,
      descripcion: mov.detalle,
      cantidad: 1,
      precio_unitario: Number(mov.precio) || 0
    }));

const escapeHtml = (value) =>
  String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatOrderNumber = (value) => `#${String(value ?? "-").padStart(7, "0")}`;

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

const renderAndPrintOrden = (orden) => {
  const printWindow = window.open("", "_blank", "width=900,height=780");
  if (!printWindow) {
    return;
  }

  const formatDate = (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-");
  const orderNumber = formatOrderNumber(orden?.nro_orden);
  const legalText = `
    Todo articulo(s)/aparato(s)/producto(s) y/o accesorio(s) dejado en el servicio tecnico de CGE Computacion para efectos de confeccionar un presupuesto y posteriormente ser reparado(s), el o los articulo(s) y/o accesorio(s), deberan ser retirados dentro de los 90 dias a partir de la fecha de recepcion reparado o no, caso contrario se considerara abandonado por su dueno, ART. 2525 y 2526 del codigo civil, por lo que el servicio tecnico dispondra del aparato como crea conveniente, inclusive venderlo y/o desarmarlo, renunciando el propietario a exigir suma alguna en concepto de compensacion y/o indemnizacion.
    <br /><br />
    Respecto a storage, almacenamiento de datos en discos externos y/o internos, el backup de la informacion que contienen los mismos es entera responsabilidad del usuario, exime a CGE Computacion de dicha tarea.
  `;

  const copies = [
    { label: "Copia local", showSecurity: true, showIngreso: true },
    { label: "Copia cliente", showSecurity: false, showIngreso: false }
  ];

  const copiesHtml = copies
    .map(
      (copy, index) => `
      <section class="copy ${index === 0 ? "copy-break" : ""}">
        <header class="header">
          <div class="brand">
            <img src="${logoCge}" alt="Logo CGE Computacion" />
            <div>
              <h1>CGE COMPUTACION</h1>
              <p class="muted"><b>Razon social:</b> ${escapeHtml(WORKSHOP_COMPANY_NAME)}</p>
              <p class="muted"><b>Telefono:</b> ${escapeHtml(WORKSHOP_COMPANY_PHONE)}</p>
              <p class="muted"><b>Direccion:</b> ${escapeHtml(WORKSHOP_COMPANY_ADDRESS)}</p>
              <p class="muted"><b>Fecha de creacion:</b> ${escapeHtml(formatDate(orden?.fecha_creacion || new Date()))}</p>
            </div>
          </div>
          <div class="badge">
            <span class="badge-label">ORDEN</span>
            <strong>${escapeHtml(orderNumber)}</strong>
          </div>
        </header>

        <section class="title-box">
          <h2>FORMULARIO DE RECEPCION</h2>
          <p>${copy.label}</p>
        </section>

        <section class="data-box">
          <h3>DATOS DEL CLIENTE</h3>
          <div class="rows">
            <p><b>Nombre:</b> ${escapeHtml(orden?.cliente_nombre || "-")}</p>
            <p><b>Documento:</b> ${escapeHtml(orden?.cliente_documento || "-")}</p>
            <p><b>Telefono:</b> ${escapeHtml(orden?.cliente_telefono || "-")}</p>
          </div>
        </section>

        <section class="data-box">
          <h3>DATOS DEL EQUIPO</h3>
          <div class="rows">
            <p><b>Equipo:</b> ${escapeHtml(orden?.equipo || "-")}</p>
            <p><b>Falla/Detalle:</b> ${escapeHtml(orden?.diagnostico_inicial || "-")}</p>
            <p><b>Deja cargador:</b> ${orden?.trajo_cargador ? "Si" : "No"}</p>
            <p><b>Deja accesorios:</b> ${escapeHtml(orden?.observaciones || "No informado")}</p>
          </div>
        </section>

        ${
          copy.showSecurity
            ? `
              <section class="data-box">
                <h3>SEGURIDAD DEL EQUIPO</h3>
                <div class="security-grid">
                  <div class="security-item security-item--clave">
                    <span>CLAVE</span>
                    <strong>${escapeHtml(orden?.contrasena_equipo || "No informada")}</strong>
                  </div>
                  <div class="security-item security-item--patron">
                    <span>PATRON ANDROID</span>
                    <strong>No informado</strong>
                  </div>
                </div>
              </section>
            `
            : ""
        }

        ${
          copy.showIngreso
            ? `
              <section class="ingreso-box">
                <h3>INGRESO DE EQUIPO</h3>
                <div class="firma-group">
                  <p>Firma:</p>
                  <div class="linea"></div>
                </div>
                <div class="firma-group">
                  <p>Aclaracion:</p>
                  <div class="linea"></div>
                </div>
                <div class="firma-group">
                  <p>Documento:</p>
                  <div class="linea"></div>
                </div>
              </section>
            `
            : ""
        }

        <section class="terms-box">
          ${legalText}
        </section>

        <p class="footer-note">© 2026 - Desarrollo de <u>AB Sistemas</u></p>
      </section>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Orden ${escapeHtml(orderNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 10px; color: #0b1a33; background: #f3f4f6; }
          .copy { width: 100%; max-width: 794px; margin: 0 auto; background: #f9fafb; border-radius: 8px; padding: 8px 9px 7px; border: 1px solid #d7dce4; }
          .copy + .copy { margin-top: 12px; }
          .header { display: flex; justify-content: space-between; gap: 8px; border-bottom: 3px solid #1f2937; padding-bottom: 6px; }
          .brand { display: flex; gap: 10px; align-items: flex-start; }
          .brand img { width: 130px; height: 82px; object-fit: contain; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; }
          .brand h1 { margin: 0 0 2px; font-size: 24px; font-weight: 800; letter-spacing: 0.3px; line-height: 1.05; }
          .muted { margin: 1px 0; font-size: 12px; color: #0f172a; line-height: 1.2; }
          .badge { min-width: 128px; border-radius: 8px; padding: 7px 10px; background: linear-gradient(120deg, #4f46e5 0%, #06b6d4 100%); color: #fff; text-align: center; box-shadow: 0 6px 12px rgba(79, 70, 229, 0.22); }
          .badge-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; margin-bottom: 2px; }
          .badge strong { font-size: 26px; letter-spacing: 0.8px; line-height: 1; }
          .title-box { margin-top: 6px; border: 1px solid #1f2937; border-radius: 6px; padding: 5px 7px 3px; text-align: center; }
          .title-box h2 { margin: 0; font-size: 20px; letter-spacing: 0.4px; text-transform: uppercase; line-height: 1.1; }
          .title-box p { margin: 3px 0 0; font-size: 14px; color: #64748b; }
          .data-box { margin-top: 6px; border: 1px solid #d5dae3; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
          .data-box h3 { margin: 0; font-size: 15px; text-transform: uppercase; line-height: 1.2; border-bottom: 1px solid #c5ced8; padding-bottom: 3px; }
          .rows { padding-top: 3px; }
          .rows p { margin: 3px 0; font-size: 12px; line-height: 1.25; }
          .rows b { display: inline-block; min-width: 106px; }
          .security-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding-top: 4px; }
          .security-item { border: 1px dashed #94a3b8; border-radius: 6px; text-align: center; padding: 5px 6px; background: #f8fafc; }
          .security-item span { display: block; font-size: 11px; font-weight: 700; color: #475569; }
          .security-item strong { display: block; margin-top: 2px; font-size: 13px; color: #0f172a; }
          .security-item--clave { border-color: #818cf8; }
          .security-item--patron { border-color: #34d399; }
          .ingreso-box { margin-top: 6px; border-top: 1px dashed #9ca3af; padding-top: 4px; }
          .ingreso-box h3 { margin: 0 0 4px; font-size: 14px; text-transform: uppercase; }
          .firma-group { margin-bottom: 7px; }
          .firma-group p { margin: 0 0 2px; font-size: 11px; }
          .linea { border-bottom: 2px solid #1e293b; height: 18px; width: 52%; }
          .terms-box { margin-top: 6px; border: 1px solid #f59e0b; background: #fff7e6; border-radius: 6px; padding: 6px; font-size: 10.5px; line-height: 1.3; color: #92400e; }
          .footer-note { margin: 8px 0 0; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #d1d5db; padding-top: 5px; }
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
            body { background: #fff; padding: 0; margin: 0; }
            .copy {
              border: none;
              box-shadow: none;
              border-radius: 0;
              width: 100%;
              max-width: none;
              min-height: calc(297mm - 16mm);
              margin: 0;
              padding: 0;
              break-inside: avoid;
            }
            .copy + .copy { margin-top: 0; }
            .copy-break { page-break-after: always; break-after: page; }
          }
        </style>
      </head>
      <body>
        ${copiesHtml}
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWhenReady(printWindow);
};

const renderAndPrintFactura = ({ venta, orden, items }) => {
  const printWindow = window.open("", "_blank", "width=900,height=780");
  if (!printWindow) {
    return;
  }

  const total = Number(venta?.total || 0);
  const orderNumber = formatOrderNumber(orden?.nro_orden);
  const detalleDiagnosticoHtml = (items || [])
    .map((item) => escapeHtml(item?.descripcion || "-").replace(/\n/g, "<br />"))
    .filter((detalle) => detalle && detalle !== "-")
    .map((detalle) => `<p class="detail-line">${detalle}</p>`)
    .join("");
  const copies = ["COPIA LOCAL", "COPIA CLIENTE"];
  const copiesHtml = copies
    .map(
      (copyLabel, index) => `
        <section class="sheet ${index === 0 ? "copy-break" : ""}">
          <header class="header">
            <div class="header-left">
              <div class="brand">
                <img src="${logoCge}" alt="Logo CGE Computacion" />
                <div>
                  <h1 class="company-name">CGE COMPUTACION</h1>
                  <p class="company-line">${escapeHtml(AFIP_ISSUER_NAME)}</p>
                  <p class="company-line">${escapeHtml(AFIP_ISSUER_ADDRESS)} - ${escapeHtml(AFIP_ISSUER_CITY)}</p>
                  <p class="company-line">Tel: ${escapeHtml(WORKSHOP_COMPANY_PHONE)}</p>
                </div>
              </div>
            </div>
            <div class="header-right">
              <div class="x-box">X</div>
              <h2 class="report-title">INFORME TECNICO</h2>
              <p class="report-number">N° ${escapeHtml(orderNumber)}</p>
              <p class="report-date">Fecha: ${dayjs(venta?.fecha || new Date()).format("DD/MM/YYYY")}</p>
              <span class="copy-badge">${copyLabel}</span>
            </div>
          </header>

          <table class="data-table">
            <tbody>
              <tr>
                <td class="label">Cliente:</td>
                <td class="value-large">${escapeHtml(orden?.cliente_nombre || "-")}</td>
                <td class="label">Documento:</td>
                <td>${escapeHtml(orden?.cliente_documento || "-")}</td>
              </tr>
              <tr>
                <td class="label">Telefono:</td>
                <td class="value-large">${escapeHtml(orden?.cliente_telefono || "-")}</td>
                <td class="label">Fecha ingreso:</td>
                <td>${dayjs(orden?.fecha_creacion || venta?.fecha || new Date()).format("DD/MM/YYYY")}</td>
              </tr>
              <tr>
                <td class="label">Equipo:</td>
                <td class="value-large">${escapeHtml(orden?.equipo || "-")}</td>
                <td class="label">N° Serie:</td>
                <td>N/A</td>
              </tr>
              <tr>
                <td class="label">Falla reportada:</td>
                <td colspan="3">${escapeHtml(orden?.diagnostico_inicial || "-")}</td>
              </tr>
            </tbody>
          </table>

          <div class="bar">DETALLE DEL DIAGNOSTICO Y REPARACION</div>
          <div class="detail-space">
            ${detalleDiagnosticoHtml || '<p class="detail-line">-</p>'}
          </div>

          <table class="totals">
            <tbody>
              <tr>
                <td class="label">Importe de reparacion:</td>
                <td class="value">${escapeHtml(`$${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</td>
              </tr>
            </tbody>
            <tbody class="totals-final">
              <tr>
                <td class="label">TOTAL:</td>
                <td class="value">${escapeHtml(`$${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures">
            <div class="sign">
              <div class="sign-line"></div>
              Firma del tecnico
            </div>
            <div class="sign">
              <div class="sign-line"></div>
              Firma del cliente
            </div>
          </div>
        </section>
      `
    )
    .join("");
  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Informe tecnico ${escapeHtml(orderNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 12px; background: #efefef; color: #111; }
          .sheet { max-width: 920px; margin: 0 auto; border: 1px solid #222; background: #fff; }
          .sheet + .sheet { margin-top: 14px; }
          .header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #222; }
          .header-left, .header-right { padding: 12px; min-height: 132px; }
          .header-left { border-right: 1px solid #222; }
          .brand { display: flex; gap: 14px; align-items: flex-start; }
          .brand img { width: 130px; height: 92px; object-fit: contain; }
          .company-name { margin: 10px 0 4px; font-size: 29px; font-weight: 800; letter-spacing: 0.3px; }
          .company-line { margin: 1px 0; font-size: 13px; }
          .x-box { width: 40px; height: 40px; border: 2px solid #222; margin: 0 auto 8px; text-align: center; line-height: 36px; font-size: 31px; font-weight: 700; }
          .report-title { margin: 0; text-align: center; font-size: 40px; font-weight: 900; letter-spacing: 1px; }
          .report-number { margin: 2px 0 0; text-align: center; font-size: 35px; font-weight: 700; }
          .report-date { margin: 6px 0 0; text-align: center; font-size: 19px; }
          .copy-badge { display: table; margin: 8px auto 0; border: 1px solid #999; padding: 2px 8px; font-size: 11px; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table td { border: 1px solid #bbb; padding: 4px 6px; font-size: 13px; }
          .data-table td.label { width: 21%; background: #f2f2f2; font-weight: 700; }
          .data-table td.value-large { width: 31%; }
          .bar { background: #050505; color: #fff; font-weight: 700; text-transform: uppercase; font-size: 13px; padding: 4px 8px; }
          .detail-space { min-height: 170px; padding: 8px; border-bottom: 1px solid #bbb; }
          .detail-line { margin: 0 0 6px; font-size: 13px; line-height: 1.35; }
          .totals { width: 100%; border-collapse: collapse; }
          .totals td { border: 1px solid #bbb; padding: 2px 8px; font-size: 14px; }
          .totals .label { text-align: right; font-weight: 700; }
          .totals .value { width: 28%; text-align: right; font-weight: 700; }
          .totals-final td { background: #050505; color: #fff; font-size: 30px; font-weight: 900; padding: 5px 8px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 18px 16px 14px; }
          .sign { text-align: center; font-size: 12px; }
          .sign-line { border-top: 1px solid #222; width: 65%; margin: 0 auto 3px; }
          @media print {
            body { background: #fff; padding: 0; margin: 0; }
            .sheet { border: none; max-width: 100%; }
            .sheet + .sheet { margin-top: 0; }
            .copy-break { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        ${copiesHtml}
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWhenReady(printWindow);
};

const mapOrdenToForm = (orden) => ({
  cliente_id: String(orden.cliente_id),
  equipo: orden.equipo || "",
  marca: orden.marca || "",
  modelo: orden.modelo || "",
  contrasena_equipo: orden.contrasena_equipo || "",
  diagnostico_inicial: orden.diagnostico_inicial || "",
  trajo_cargador: Boolean(orden.trajo_cargador),
  observaciones: orden.observaciones || "",
  estado_actual: orden.estado_actual || "ingresada",
  prioridad: orden.prioridad || "media"
});

const getEstadoClassName = (estadoActual) => {
  if (["ingresada", "en_diagnostico"].includes(estadoActual)) {
    return "orden-estado--red";
  }

  if (["en_reparacion", "esperando_repuesto"].includes(estadoActual)) {
    return "orden-estado--yellow";
  }

  if (["lista_para_entrega", "entregada"].includes(estadoActual)) {
    return "orden-estado--green";
  }

  return "";
};

const getPrioridadClassName = (prioridad) => {
  if (["urgente", "alta"].includes(prioridad)) {
    return "orden-prioridad--high";
  }

  if (prioridad === "media") {
    return "orden-prioridad--medium";
  }

  if (prioridad === "baja") {
    return "orden-prioridad--low";
  }

  return "";
};

const prioridadRank = {
  urgente: 4,
  alta: 3,
  media: 2,
  baja: 1
};

const estadoRank = {
  ingresada: 1,
  en_diagnostico: 2,
  en_reparacion: 3,
  esperando_repuesto: 4,
  lista_para_entrega: 5,
  entregada: 6,
  cancelada: 7
};

function OrdenesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [prioridadFilter, setPrioridadFilter] = useState("");
  const [demoradaFilter, setDemoradaFilter] = useState(false);
  const [sortBy, setSortBy] = useState("fecha_creacion");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [ordenForm, setOrdenForm] = useState(initialOrden);
  const [editingId, setEditingId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [movForm, setMovForm] = useState(initialMov);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editLoadError, setEditLoadError] = useState("");
  const [isFacturaOpen, setIsFacturaOpen] = useState(false);
  const [isLoadingFacturaOrden, setIsLoadingFacturaOrden] = useState(false);
  const [isLoadingPrintOrden, setIsLoadingPrintOrden] = useState(false);
  const [isFinalizandoOrdenId, setIsFinalizandoOrdenId] = useState(null);
  const [facturaError, setFacturaError] = useState("");
  const [facturaForm, setFacturaForm] = useState(initialFacturaForm);
  const [facturaOrden, setFacturaOrden] = useState(null);
  const [facturaNotice, setFacturaNotice] = useState("");
  const [ultimaFacturaData, setUltimaFacturaData] = useState(null);
  const [isDispositivoManual, setIsDispositivoManual] = useState(false);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [clienteForm, setClienteForm] = useState(initialClienteForm);
  const [editingOrderNumber, setEditingOrderNumber] = useState(null);

  const clientesQuery = useQuery({ queryKey: ["clientes"], queryFn: () => api.clientes.list("") });
  const marcasQuery = useQuery({ queryKey: ["marcas"], queryFn: () => api.marcas.list("") });
  const dispositivosQuery = useQuery({ queryKey: ["dispositivos"], queryFn: () => api.dispositivos.list("") });
  const ordenesQuery = useQuery({
    queryKey: ["ordenes", search, estadoFilter, prioridadFilter, demoradaFilter],
    queryFn: () =>
      api.ordenes.list({
        search,
        estado: estadoFilter,
        prioridad: prioridadFilter,
        demorada: demoradaFilter ? "true" : ""
      })
  });

  const createClienteMutation = useMutation({
    mutationFn: (payload) => api.clientes.create(payload),
    onSuccess: (clienteCreado) => {
      setClienteForm(initialClienteForm);
      setIsClienteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      if (clienteCreado?.id) {
        setOrdenForm((prev) => ({ ...prev, cliente_id: String(clienteCreado.id) }));
      }
    }
  });

  const detalleQuery = useQuery({
    queryKey: ["orden-detalle", detailId],
    queryFn: () => api.ordenes.getById(detailId),
    enabled: Boolean(detailId)
  });

  const saveOrdenMutation = useMutation({
    mutationFn: (payload) => {
      if (editingId) {
        return api.ordenes.update(editingId, payload);
      }
      return api.ordenes.create(payload);
    },
    onSuccess: async (ordenGuardada) => {
      const isCreate = !editingId;

      if (isCreate && ordenGuardada?.id) {
        try {
          const detalleOrden = await queryClient.fetchQuery({
            queryKey: ["orden-detalle", ordenGuardada.id],
            queryFn: () => api.ordenes.getById(ordenGuardada.id)
          });
          renderAndPrintOrden(detalleOrden);
        } catch (error) {
          setFacturaError(error.message || "La orden se creo, pero no se pudo emitir la orden de trabajo.");
        }
      }

      setOrdenForm(initialOrden);
      setEditingId(null);
      setEditingOrderNumber(null);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ordenes"] });
      if (detailId) {
        queryClient.invalidateQueries({ queryKey: ["orden-detalle", detailId] });
      }
    }
  });

  const movimientoMutation = useMutation({
    mutationFn: (payload) => api.ordenes.addMovimiento(detailId, payload),
    onSuccess: () => {
      setMovForm(initialMov);
      queryClient.invalidateQueries({ queryKey: ["ordenes"] });
      queryClient.invalidateQueries({ queryKey: ["orden-detalle", detailId] });
    }
  });

  const finalizarOrdenMutation = useMutation({
    mutationFn: ({ ordenId, payload }) => api.ordenes.update(ordenId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ordenes"] });
      queryClient.invalidateQueries({ queryKey: ["orden-detalle", variables.ordenId] });
    }
  });

  const facturarOrdenMutation = useMutation({
    mutationFn: ({ payload }) => api.ventas.create(payload),
    onSuccess: (venta, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] });
      setIsFacturaOpen(false);
      setFacturaForm(initialFacturaForm);
      setFacturaError("");

      const facturaData = {
        venta,
        orden: variables.ordenSnapshot,
        items: variables.itemsSnapshot
      };

      const emailResult = venta?.reporte_tecnico_email;
      if (emailResult?.sent) {
        setFacturaNotice(`Factura generada. Email enviado a ${emailResult.to}.`);
      } else if (emailResult) {
        setFacturaNotice(`Factura generada, pero no se envió el email: ${mapEmailReasonToMessage(emailResult.reason)}.`);
      } else {
        setFacturaNotice("Factura generada. No se recibió estado de envío de email.");
      }

      setUltimaFacturaData(facturaData);
      renderAndPrintFactura(facturaData);
    }
  });

  const clientes = clientesQuery.data || [];
  const marcas = marcasQuery.data || [];
  const dispositivos = dispositivosQuery.data || [];
  const ordenes = ordenesQuery.data || [];
  const detalle = detalleQuery.data;
  const isEditMode = Boolean(editingId);

  const ordenesOrdenadas = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...ordenes].sort((a, b) => {
      const aEntregada = a.estado_actual === "entregada";
      const bEntregada = b.estado_actual === "entregada";

      if (aEntregada !== bEntregada) {
        return aEntregada ? 1 : -1;
      }

      if (sortBy === "prioridad") {
        const aRank = prioridadRank[a.prioridad] || 0;
        const bRank = prioridadRank[b.prioridad] || 0;
        return (aRank - bRank) * direction;
      }

      if (sortBy === "estado") {
        const aRank = estadoRank[a.estado_actual] || 0;
        const bRank = estadoRank[b.estado_actual] || 0;
        return (aRank - bRank) * direction;
      }

      const aDate = dayjs(a.fecha_creacion).valueOf();
      const bDate = dayjs(b.fecha_creacion).valueOf();
      return (aDate - bDate) * direction;
    });
  }, [ordenes, sortBy, sortDirection]);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(ordenesOrdenadas.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const ordenesPaginadas = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return ordenesOrdenadas.slice(start, start + PAGE_SIZE);
  }, [ordenesOrdenadas, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, estadoFilter, prioridadFilter, demoradaFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const facturaItemsPreview = useMemo(() => {
    if (facturaForm.modo_detalle === "manual") {
      return facturaForm.manual_items.map((item) => ({
        tipo_item: "servicio",
        producto_id: null,
        descripcion: item.descripcion,
        cantidad: 1,
        precio_unitario: Number(item.precio_unitario) || 0
      }));
    }

    return mapMovimientosToFacturaItems(facturaOrden?.movimientos || []);
  }, [facturaForm.manual_items, facturaForm.modo_detalle, facturaOrden]);

  const facturaTotalPreview = useMemo(
    () => facturaItemsPreview.reduce((acc, item) => acc + Number(item.cantidad) * Number(item.precio_unitario), 0),
    [facturaItemsPreview]
  );

  const selectedCliente = useMemo(() => clientes.find((c) => String(c.id) === String(ordenForm.cliente_id)), [clientes, ordenForm.cliente_id]);

  const openCreate = () => {
    setEditingId(null);
    setEditingOrderNumber(null);
    setDetailId(null);
    setEditLoadError("");
    setOrdenForm(initialOrden);
    setMovForm(initialMov);
    setIsDispositivoManual(false);
    setIsFormOpen(true);
  };

  const openEdit = async (orden) => {
    setIsLoadingEdit(true);
    setEditLoadError("");
    setDetailId(orden.id);

    try {
      const detalleOrden = await queryClient.fetchQuery({
        queryKey: ["orden-detalle", orden.id],
        queryFn: () => api.ordenes.getById(orden.id)
      });

      setEditingId(orden.id);
      setEditingOrderNumber(detalleOrden.nro_orden || null);
      setOrdenForm(mapOrdenToForm(detalleOrden));
      setMovForm(initialMov);
      setIsDispositivoManual(false);
      setIsFormOpen(true);
    } catch (error) {
      setDetailId(null);
      setEditLoadError(error.message || "No se pudo cargar la orden para editar.");
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const openClienteModal = () => {
    setClienteForm(initialClienteForm);
    createClienteMutation.reset();
    setIsClienteModalOpen(true);
  };

  const handlePrintOrden = async (ordenId, ordenSnapshot = null) => {
    setFacturaError("");
    setIsLoadingPrintOrden(true);

    try {
      const detalleOrden = await queryClient.fetchQuery({
        queryKey: ["orden-detalle", ordenId],
        queryFn: () => api.ordenes.getById(ordenId)
      });

      renderAndPrintOrden({
        ...detalleOrden,
        cliente_telefono: ordenSnapshot?.cliente_telefono || detalleOrden?.cliente_telefono || ""
      });
    } catch (error) {
      setFacturaError(error.message || "No se pudo preparar la impresion de la orden.");
    } finally {
      setIsLoadingPrintOrden(false);
    }
  };

  const openFactura = async (ordenIdOrEvent = editingId) => {
    const ordenId = typeof ordenIdOrEvent === "number" || typeof ordenIdOrEvent === "string" ? ordenIdOrEvent : editingId;
    if (!ordenId) {
      return;
    }

    setFacturaError("");
    setIsLoadingFacturaOrden(true);

    try {
      const detalleOrden = await queryClient.fetchQuery({
        queryKey: ["orden-detalle", ordenId],
        queryFn: () => api.ordenes.getById(ordenId)
      });

      setFacturaOrden(detalleOrden);
      setFacturaForm(initialFacturaForm);
      setIsFacturaOpen(true);
    } catch (error) {
      setFacturaError(error.message || "No se pudo cargar la orden para facturar.");
    } finally {
      setIsLoadingFacturaOrden(false);
    }
  };

  const handleFinalizarOrden = async (orden) => {
    setFacturaError("");
    setFacturaNotice("");
    setIsFinalizandoOrdenId(orden.id);

    try {
      if (orden.estado_actual !== "entregada") {
        await finalizarOrdenMutation.mutateAsync({
          ordenId: orden.id,
          payload: { estado_actual: "entregada" }
        });
      }

      const ventasOrden = await api.ventas.list({ origen: "orden", orden_id: orden.id });
      const ventaExistente = Array.isArray(ventasOrden) && ventasOrden.length > 0 ? ventasOrden[0] : null;

      if (ventaExistente?.id) {
        const [detalleOrden, ventaDetalle] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ["orden-detalle", orden.id],
            queryFn: () => api.ordenes.getById(orden.id)
          }),
          api.ventas.getById(ventaExistente.id)
        ]);

        const facturaData = {
          venta: ventaDetalle,
          orden: detalleOrden,
          items: ventaDetalle?.items || []
        };

        setUltimaFacturaData(facturaData);
        setFacturaNotice("Orden finalizada. Se imprimio la factura existente.");
        renderAndPrintFactura(facturaData);
        return;
      }

      await openFactura(orden.id);
    } catch (error) {
      setFacturaError(error.message || "No se pudo finalizar la orden.");
    } finally {
      setIsFinalizandoOrdenId(null);
    }
  };

  return (
    <div>
      <div className="page-header page-header--compact">
        <div>
          <h2 className="page-title">Ordenes de reparacion</h2>
          <p className="status">ABM de ordenes con circuito tecnico y prioridades.</p>
          {facturaNotice ? <p className="status">{facturaNotice}</p> : null}
        </div>
        <button onClick={openCreate}>Nueva orden</button>
      </div>

      <section className="card toolbar" style={{ gridTemplateColumns: "1fr auto auto auto auto" }}>
        <input placeholder="Buscar por cliente, equipo o nro" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="ingresada">Ingresada</option>
          <option value="en_diagnostico">En diagnostico</option>
          <option value="en_reparacion">En reparacion</option>
          <option value="esperando_repuesto">Esperando repuesto</option>
          <option value="lista_para_entrega">Lista para entrega</option>
          <option value="entregada">Entregada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={prioridadFilter} onChange={(e) => setPrioridadFilter(e.target.value)}>
          <option value="">Todas las prioridades</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
        <button className="secondary" onClick={() => ordenesQuery.refetch()}>
          Buscar
        </button>
        <button
          className="danger"
          onClick={() => {
            setSearch("");
            setEstadoFilter("");
            setPrioridadFilter("");
            setDemoradaFilter(false);
            setSortBy("fecha_creacion");
            setSortDirection("desc");
            setCurrentPage(1);
          }}
        >
          Limpiar
        </button>
      </section>

      <section className="card">
        <h3>Listado</h3>
        {ordenesQuery.isLoading ? (
          <div className="empty-state">Cargando ordenes...</div>
        ) : (
          <>
            {ordenesOrdenadas.length === 0 ? <div className="empty-state">No hay ordenes para los filtros seleccionados.</div> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nro</th>
                    <th>Cliente</th>
                    <th>Equipo</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    {/* <th>Creada</th> */}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesPaginadas.map((orden) => (
                    <tr
                      key={orden.id}
                      className={`orden-row ${orden.estado_actual === "entregada" ? "orden-row--entregada" : ""}`}
                    >
                      <td>{formatOrderNumber(orden.nro_orden)}</td>
                      <td>{orden.cliente_nombre}</td>
                      <td>{orden.equipo}</td>
                      <td>{orden.marca || "-"}</td>
                      <td>{orden.modelo || "-"}</td>
                      <td>
                        <span className="orden-estado">{orden.estado_actual}</span>
                      </td>
                      <td className={`orden-prioridad-cell ${getPrioridadClassName(orden.prioridad)}`}>
                        <span className="orden-prioridad">{orden.prioridad}</span>
                      </td>
                      {/* <td>{dayjs(orden.fecha_creacion).format("DD/MM/YYYY HH:mm")}</td> */}
                      <td>
                        <div className="actions">
                          <button className="secondary" onClick={() => openEdit(orden)}>
                            Ver / Actualizar
                          </button>
                          {orden.estado_actual !== "entregada" ? (
                            <button
                              className="secondary"
                              type="button"
                              onClick={() => handleFinalizarOrden(orden)}
                              disabled={isFinalizandoOrdenId === orden.id || isLoadingFacturaOrden}
                            >
                              {isFinalizandoOrdenId === orden.id ? "Finalizando..." : "Finalizar orden"}
                            </button>
                          ) : null}
                          <button className="secondary" onClick={() => handlePrintOrden(orden.id, orden)} disabled={isLoadingPrintOrden}>
                            {isLoadingPrintOrden ? "Preparando..." : "Imprimir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ordenesOrdenadas.length > PAGE_SIZE ? (
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

      <Modal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingId(null);
          setEditingOrderNumber(null);
          setDetailId(null);
          setMovForm(initialMov);
          setEditLoadError("");
        }}
        title={editingId ? `Editar orden ${formatOrderNumber(editingOrderNumber ?? editingId)}` : "Nueva orden"}
        width="96vw"
      >
        <form
          className="orden-form orden-form--compact"
          onSubmit={(e) => {
            e.preventDefault();
            if (isEditMode) {
              saveOrdenMutation.mutate({
                estado_actual: ordenForm.estado_actual,
                prioridad: ordenForm.prioridad
              });
              return;
            }

            saveOrdenMutation.mutate({
              ...ordenForm,
              cliente_id: Number(ordenForm.cliente_id)
            });
          }}
        >
          <div className="orden-form-grid">
            <section className="card orden-form-section">
              <h3>Cliente / Orden</h3>
              <label>
                Cliente
                <select
                  value={ordenForm.cliente_id}
                  onChange={(e) => setOrdenForm({ ...ordenForm, cliente_id: e.target.value })}
                  required
                  disabled={isEditMode}
                >
                  <option value="">Seleccione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {!isEditMode ? (
                <div className="actions" style={{ marginTop: 6 }}>
                  <button type="button" className="secondary" onClick={openClienteModal}>
                    Nuevo cliente
                  </button>
                </div>
              ) : null}
              <label>
                Telefono
                <input value={selectedCliente?.telefono || ""} readOnly placeholder="Sin telefono" />
              </label>
              {selectedCliente ? <p className="status">Cliente seleccionado: {selectedCliente.nombre}</p> : null}
            </section>

            <section className="card orden-form-section">
              <h3>Equipo</h3>
              <label>
                Dispositivo
                <select
                  value={isDispositivoManual ? "__otro__" : ordenForm.equipo}
                  onChange={(e) => {
                    if (e.target.value === "__otro__") {
                      setIsDispositivoManual(true);
                      setOrdenForm({ ...ordenForm, equipo: "" });
                      return;
                    }

                    setIsDispositivoManual(false);
                    setOrdenForm({ ...ordenForm, equipo: e.target.value });
                  }}
                  required
                  disabled={isEditMode}
                >
                  <option value="">Seleccione...</option>
                  <option value="__otro__">Otro (manual)</option>
                  {dispositivos.map((dispositivo) => (
                    <option key={dispositivo.id} value={dispositivo.nombre}>
                      {dispositivo.nombre}
                    </option>
                  ))}
                  {isEditMode && ordenForm.equipo && !dispositivos.some((dispositivo) => dispositivo.nombre === ordenForm.equipo) ? (
                    <option value={ordenForm.equipo}>{ordenForm.equipo}</option>
                  ) : null}
                </select>
              </label>
              {isDispositivoManual && !isEditMode ? (
                <label>
                  Dispositivo (manual)
                  <input
                    value={ordenForm.equipo}
                    onChange={(e) => setOrdenForm({ ...ordenForm, equipo: e.target.value })}
                    required
                  />
                </label>
              ) : null}
              <div className="orden-inline-two">
                <label>
                  Marca
                  <select value={ordenForm.marca} onChange={(e) => setOrdenForm({ ...ordenForm, marca: e.target.value })} disabled={isEditMode}>
                    <option value="">Seleccione...</option>
                    {marcas.map((marca) => (
                      <option key={marca.id} value={marca.nombre}>
                        {marca.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Modelo
                  <input value={ordenForm.modelo} onChange={(e) => setOrdenForm({ ...ordenForm, modelo: e.target.value })} readOnly={isEditMode} />
                </label>
              </div>
            </section>

            <section className="card orden-form-section">
              <h3>Seguridad</h3>
              <label>
                Contraseña / PIN
                <input
                  value={ordenForm.contrasena_equipo}
                  onChange={(e) => setOrdenForm({ ...ordenForm, contrasena_equipo: e.target.value })}
                  placeholder="Ej: 1234, abcd"
                  readOnly={isEditMode}
                />
              </label>
            </section>

            <section className="card orden-form-section orden-form-wide">
              <h3>Falla y estado</h3>
              <label>
                Falla reportada
                <textarea
                  value={ordenForm.diagnostico_inicial}
                  onChange={(e) => setOrdenForm({ ...ordenForm, diagnostico_inicial: e.target.value })}
                  required
                  readOnly={isEditMode}
                />
              </label>
              <label>
                Observaciones (danos preexistentes)
                <textarea
                  value={ordenForm.observaciones}
                  onChange={(e) => setOrdenForm({ ...ordenForm, observaciones: e.target.value })}
                  readOnly={isEditMode}
                />
              </label>
              <div className="orden-inline-three">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={ordenForm.trajo_cargador}
                    onChange={(e) => setOrdenForm({ ...ordenForm, trajo_cargador: e.target.checked })}
                    disabled={isEditMode}
                  />
                  Trajo cargador
                </label>
                <label>
                  Prioridad
                  <select value={ordenForm.prioridad} onChange={(e) => setOrdenForm({ ...ordenForm, prioridad: e.target.value })}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </label>
                <label>
                  Estado de la reparacion
                  <select value={ordenForm.estado_actual} onChange={(e) => setOrdenForm({ ...ordenForm, estado_actual: e.target.value })}>
                    <option value="ingresada">Ingresada</option>
                    <option value="en_diagnostico">En diagnostico</option>
                    <option value="en_reparacion">En reparacion</option>
                    <option value="esperando_repuesto">Esperando repuesto</option>
                    <option value="lista_para_entrega">Lista para entrega</option>
                    <option value="entregada">Entregada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>
              </div>
            </section>
          </div>

          <div className="actions orden-form-actions">
            <button type="submit" disabled={saveOrdenMutation.isPending}>
              {editingId ? "Guardar cambios" : "Crear orden"}
            </button>
            {isEditMode ? (
              <button type="button" className="secondary" onClick={() => openFactura()} disabled={isLoadingFacturaOrden}>
                {isLoadingFacturaOrden ? "Cargando orden..." : "Generar factura"}
              </button>
            ) : null}
            {isEditMode ? (
              <button type="button" className="secondary" onClick={() => handlePrintOrden(editingId)} disabled={isLoadingPrintOrden}>
                {isLoadingPrintOrden ? "Preparando..." : "Imprimir orden"}
              </button>
            ) : null}
            {ultimaFacturaData && Number(ultimaFacturaData.orden?.id) === Number(editingId) ? (
              <button type="button" onClick={() => renderAndPrintFactura(ultimaFacturaData)}>
                Reimprimir ultima factura
              </button>
            ) : null}
          </div>

          {isEditMode && detalle ? (
            <>
              <section className="card orden-edit-extra" style={{ marginTop: 12 }}>
                <h3>Agregar movimiento</h3>
                <label>
                  Detalle
                  <textarea value={movForm.detalle} onChange={(e) => setMovForm({ ...movForm, detalle: e.target.value })} />
                </label>
                <label>
                  Precio
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={movForm.precio}
                    onChange={(e) => setMovForm({ ...movForm, precio: e.target.value })}
                    placeholder="Ej: 45000"
                  />
                </label>
                <div className="actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="secondary"
                    disabled={movimientoMutation.isPending}
                    onClick={() => {
                      const detalleMovimiento = movForm.detalle.trim();
                      const precioMovimiento = Number(movForm.precio);
                      if (!detalleMovimiento || !detailId) {
                        return;
                      }

                      if (!Number.isFinite(precioMovimiento) || precioMovimiento < 0) {
                        return;
                      }

                      movimientoMutation.mutate({
                        detalle: detalleMovimiento,
                        precio: precioMovimiento
                      });
                    }}
                  >
                    {movimientoMutation.isPending ? "Guardando..." : "Guardar movimiento"}
                  </button>
                </div>
              </section>

              <section className="card orden-edit-extra" style={{ marginTop: 12 }}>
                <h3>Movimientos</h3>
                {(detalle.movimientos || []).length === 0 ? (
                  <div className="empty-state">Todavia no hay movimientos cargados.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th>Detalle</th>
                          <th>Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.movimientos || []).map((m) => (
                          <tr key={m.id}>
                            <td>{dayjs(m.fecha).format("DD/MM/YYYY HH:mm")}</td>
                            <td>{m.estado}</td>
                            <td>{m.detalle}</td>
                            <td>${Number(m.precio || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : null}

          {isLoadingEdit ? <span className="status">Cargando datos de la orden...</span> : null}
          {editLoadError ? <span className="error">{editLoadError}</span> : null}
          {movimientoMutation.error ? <span className="error">{movimientoMutation.error.message}</span> : null}
          {facturaError ? <span className="error">{facturaError}</span> : null}
          {saveOrdenMutation.error ? <span className="error">{saveOrdenMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal
        open={isClienteModalOpen}
        onClose={() => setIsClienteModalOpen(false)}
        title="Nuevo cliente"
        width={760}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createClienteMutation.mutate(clienteForm);
          }}
        >
          <label>
            Nombre
            <input value={clienteForm.nombre} onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })} required />
          </label>
          <label>
            Telefono
            <input value={clienteForm.telefono} onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })} />
          </label>
          <label>
            Email
            <input value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} />
          </label>
          <label>
            Documento
            <input value={clienteForm.documento} onChange={(e) => setClienteForm({ ...clienteForm, documento: e.target.value })} />
          </label>
          <label>
            Direccion
            <input value={clienteForm.direccion} onChange={(e) => setClienteForm({ ...clienteForm, direccion: e.target.value })} />
          </label>
          <label>
            Ciudad
            <input value={clienteForm.ciudad} onChange={(e) => setClienteForm({ ...clienteForm, ciudad: e.target.value })} />
          </label>
          <label>
            Provincia
            <input value={clienteForm.provincia} onChange={(e) => setClienteForm({ ...clienteForm, provincia: e.target.value })} />
          </label>
          <label>
            CUIT
            <input value={clienteForm.cuit} onChange={(e) => setClienteForm({ ...clienteForm, cuit: e.target.value })} />
          </label>
          <label>
            Condicion IVA
            <select value={clienteForm.condicion_iva} onChange={(e) => setClienteForm({ ...clienteForm, condicion_iva: e.target.value })}>
              <option value="consumidor_final">Consumidor final</option>
              <option value="inscripto">Inscripto</option>
              <option value="exento">Exento</option>
            </select>
          </label>
          <label>
            Observaciones
            <textarea value={clienteForm.observaciones} onChange={(e) => setClienteForm({ ...clienteForm, observaciones: e.target.value })} />
          </label>
          <button type="submit" disabled={createClienteMutation.isPending}>
            {createClienteMutation.isPending ? "Creando cliente..." : "Crear cliente"}
          </button>
          {createClienteMutation.error ? <span className="error">{createClienteMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal
        open={isFacturaOpen}
        onClose={() => {
          setIsFacturaOpen(false);
          setFacturaError("");
          setFacturaForm(initialFacturaForm);
        }}
        title={facturaOrden ? `Facturar orden ${formatOrderNumber(facturaOrden.nro_orden)}` : "Generar factura"}
        width={900}
      >
        {facturaOrden ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (facturaItemsPreview.length === 0) {
                setFacturaError("Debe cargar items manuales o usar movimientos automaticos con contenido.");
                return;
              }

              setFacturaError("");

              facturarOrdenMutation.mutate({
                payload: {
                  tipo: facturaForm.tipo,
                  afip_tipo_comprobante: facturaForm.tipo === "afip" ? facturaForm.afip_tipo_comprobante : null,
                  origen: "orden",
                  orden_id: Number(facturaOrden.id),
                  cliente_id: Number(facturaOrden.cliente_id),
                  descuento: 0,
                  impuestos: 0,
                  forma_pago: facturaForm.forma_pago,
                  monto_pagado: 0,
                  items: facturaItemsPreview
                },
                ordenSnapshot: facturaOrden,
                itemsSnapshot: facturaItemsPreview
              });
            }}
          >
            <section className="card">
              <h3>Datos de la factura</h3>
              <p className="status">
                Orden {formatOrderNumber(facturaOrden.nro_orden)} - {facturaOrden.cliente_nombre} - {facturaOrden.equipo}
              </p>
              <div className="orden-inline-two">
                <label>
                  Tipo comprobante
                  <select value={facturaForm.tipo} onChange={(e) => setFacturaForm({ ...facturaForm, tipo: e.target.value })}>
                    <option value="local">Local</option>
                    <option value="afip">AFIP</option>
                  </select>
                </label>
                {facturaForm.tipo === "afip" ? (
                  <label>
                    Comprobante AFIP
                    <select
                      value={facturaForm.afip_tipo_comprobante}
                      onChange={(e) => setFacturaForm({ ...facturaForm, afip_tipo_comprobante: e.target.value })}
                    >
                      <option value="A">Factura A</option>
                      <option value="B">Factura B</option>
                    </select>
                  </label>
                ) : null}
                <label>
                  Forma de pago
                  <select value={facturaForm.forma_pago} onChange={(e) => setFacturaForm({ ...facturaForm, forma_pago: e.target.value })}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="card">
              <h3>Detalle a facturar</h3>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name="modo_detalle"
                  checked={facturaForm.modo_detalle === "manual"}
                  onChange={() => setFacturaForm({ ...facturaForm, modo_detalle: "manual" })}
                />
                Cargar detalle manual
              </label>
              {facturaForm.modo_detalle === "manual" ? (
                <>
                  <div className="orden-inline-two" style={{ marginTop: 8 }}>
                    <label>
                      Detalle
                      <input
                        value={facturaForm.manual_item_descripcion}
                        onChange={(e) => setFacturaForm({ ...facturaForm, manual_item_descripcion: e.target.value })}
                        placeholder="Ej: Reparacion de placa"
                      />
                    </label>
                    <label>
                      Precio unitario
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={facturaForm.manual_item_precio_unitario}
                        onChange={(e) => setFacturaForm({ ...facturaForm, manual_item_precio_unitario: e.target.value })}
                        placeholder="Ej: 45000"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      const descripcion = facturaForm.manual_item_descripcion.trim();
                      const precioUnitario = Number(facturaForm.manual_item_precio_unitario);

                      if (!descripcion) {
                        setFacturaError("Debe ingresar el detalle del item.");
                        return;
                      }

                      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
                        setFacturaError("Debe ingresar un precio unitario valido (0 o mayor).");
                        return;
                      }

                      setFacturaError("");
                      setFacturaForm((prev) => ({
                        ...prev,
                        manual_items: [...prev.manual_items, { descripcion, precio_unitario: precioUnitario }],
                        manual_item_descripcion: "",
                        manual_item_precio_unitario: ""
                      }));
                    }}
                  >
                    Agregar item
                  </button>

                  {facturaForm.manual_items.length > 0 ? (
                    <div className="table-wrap" style={{ marginTop: 8 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Detalle</th>
                            <th>Precio unitario</th>
                            <th>Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {facturaForm.manual_items.map((item, index) => (
                            <tr key={`${item.descripcion}-${index}`}>
                              <td>{item.descripcion}</td>
                              <td>${Number(item.precio_unitario).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFacturaForm((prev) => ({
                                      ...prev,
                                      manual_items: prev.manual_items.filter((_, currentIndex) => currentIndex !== index)
                                    }));
                                  }}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ marginTop: 8 }}>
                      Todavia no hay items manuales cargados.
                    </div>
                  )}
                </>
              ) : null}

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input
                  type="radio"
                  name="modo_detalle"
                  checked={facturaForm.modo_detalle === "movimientos"}
                  onChange={() => setFacturaForm({ ...facturaForm, modo_detalle: "movimientos" })}
                />
                Cargar automaticamente movimientos de la orden
              </label>
              {facturaForm.modo_detalle === "movimientos" && (facturaOrden.movimientos || []).length === 0 ? (
                <div className="empty-state" style={{ marginTop: 8 }}>
                  La orden no tiene movimientos para cargar automaticamente.
                </div>
              ) : null}
            </section>

            <section className="card">
              <h3>Vista previa de items</h3>
              {facturaItemsPreview.length === 0 ? (
                <div className="empty-state">Todavia no hay items para facturar.</div>
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
                      {facturaItemsPreview.map((item, index) => (
                        <tr key={`${item.descripcion}-${index}`}>
                          <td>{item.tipo_item}</td>
                          <td>{item.descripcion}</td>
                          <td>{Number(item.cantidad).toFixed(2)}</td>
                          <td>${Number(item.precio_unitario).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td>
                            ${Number(item.cantidad * item.precio_unitario).toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="status">
                Total calculado: ${facturaTotalPreview.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </section>

            <button type="submit" className="secondary" disabled={facturarOrdenMutation.isPending}>
              {facturarOrdenMutation.isPending ? "Generando factura..." : "Generar e imprimir factura"}
            </button>
            {facturarOrdenMutation.error ? <span className="error">{facturarOrdenMutation.error.message}</span> : null}
            {facturaError ? <span className="error">{facturaError}</span> : null}
          </form>
        ) : (
          <p>Cargando...</p>
        )}
      </Modal>

    </div>
  );
}

export default OrdenesPage;
