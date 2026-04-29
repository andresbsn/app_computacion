import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import logoCge from "../../assets/logo.jpeg";

const AFIP_ISSUER_NAME = import.meta.env.VITE_AFIP_ISSUER_NAME || "Federico Zabala";
const AFIP_ISSUER_ADDRESS = import.meta.env.VITE_AFIP_ISSUER_ADDRESS || "Rivadavia 357";
const AFIP_ISSUER_CITY = import.meta.env.VITE_AFIP_ISSUER_CITY || "Villa Ramallo";
const AFIP_ISSUER_CUIL = import.meta.env.VITE_AFIP_ISSUER_CUIL || "20-30257623-9";
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
  estado: "en_diagnostico",
  detalle: "",
  prioridad: ""
};

const initialFacturaForm = {
  tipo: "local",
  forma_pago: "efectivo",
  modo_detalle: "manual",
  detalle_manual: ""
};

const mapMovimientosToFacturaItems = (movimientos = []) =>
  movimientos
    .filter((mov) => mov.detalle && mov.detalle.trim())
    .map((mov) => ({
      tipo_item: "servicio",
      producto_id: null,
      descripcion: `[${mov.estado}] ${mov.detalle}`,
      cantidad: 1,
      precio_unitario: 0
    }));

const escapeHtml = (value) =>
  String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatOrderNumber = (value) => `#${String(value ?? "-").padStart(7, "0")}`;

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
          body { font-family: Arial, sans-serif; margin: 0; padding: 14px; color: #0b1a33; background: #f3f4f6; }
          .copy { width: 100%; max-width: 920px; margin: 0 auto; background: #f9fafb; border-radius: 10px; padding: 10px 10px 8px; border: 1px solid #d7dce4; }
          .copy + .copy { margin-top: 16px; }
          .header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 4px solid #1f2937; padding-bottom: 8px; }
          .brand { display: flex; gap: 10px; align-items: flex-start; }
          .brand img { width: 120px; height: 80px; object-fit: contain; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; }
          .brand h1 { margin: 0 0 4px; font-size: 36px; font-weight: 800; letter-spacing: 0.4px; line-height: 1; }
          .muted { margin: 1px 0; font-size: 19px; color: #0f172a; line-height: 1.2; }
          .badge { min-width: 178px; border-radius: 10px; padding: 10px 14px; background: linear-gradient(120deg, #4f46e5 0%, #06b6d4 100%); color: #fff; text-align: center; box-shadow: 0 10px 18px rgba(79, 70, 229, 0.22); }
          .badge-label { display: block; font-size: 16px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
          .badge strong { font-size: 44px; letter-spacing: 1px; line-height: 1; }
          .title-box { margin-top: 8px; border: 1px solid #1f2937; border-radius: 8px; padding: 6px 8px 4px; text-align: center; }
          .title-box h2 { margin: 0; font-size: 42px; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.1; }
          .title-box p { margin: 4px 0 0; font-size: 30px; color: #64748b; }
          .data-box { margin-top: 8px; border: 1px solid #d5dae3; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
          .data-box h3 { margin: 0; font-size: 34px; text-transform: uppercase; line-height: 1.1; border-bottom: 1px solid #c5ced8; padding-bottom: 4px; }
          .rows { padding-top: 4px; }
          .rows p { margin: 4px 0; font-size: 29px; line-height: 1.15; }
          .rows b { display: inline-block; min-width: 180px; }
          .security-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding-top: 6px; }
          .security-item { border: 2px dashed #94a3b8; border-radius: 8px; text-align: center; padding: 6px 8px; background: #f8fafc; }
          .security-item span { display: block; font-size: 20px; font-weight: 700; color: #475569; }
          .security-item strong { display: block; margin-top: 3px; font-size: 28px; color: #0f172a; }
          .security-item--clave { border-color: #818cf8; }
          .security-item--patron { border-color: #34d399; }
          .ingreso-box { margin-top: 8px; border-top: 1px dashed #9ca3af; padding-top: 4px; }
          .ingreso-box h3 { margin: 0 0 4px; font-size: 28px; text-transform: uppercase; }
          .firma-group { margin-bottom: 8px; }
          .firma-group p { margin: 0 0 3px; font-size: 19px; }
          .linea { border-bottom: 3px solid #1e293b; height: 22px; width: 52%; }
          .terms-box { margin-top: 8px; border: 1px solid #f59e0b; background: #fff7e6; border-radius: 8px; padding: 8px; font-size: 15px; line-height: 1.35; color: #92400e; }
          .footer-note { margin: 10px 0 0; text-align: center; font-size: 15px; color: #94a3b8; border-top: 1px solid #d1d5db; padding-top: 6px; }
          @media print {
            body { background: #fff; padding: 0; margin: 0; }
            .copy { border: none; box-shadow: none; border-radius: 0; padding: 8mm; max-width: 100%; }
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
  printWindow.focus();
  printWindow.print();
};

const renderAndPrintFactura = ({ venta, orden, items }) => {
  const printWindow = window.open("", "_blank", "width=900,height=780");
  if (!printWindow) {
    return;
  }

  const total = items.reduce((acc, item) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0);
  const comprobanteNumero = venta?.comprobante?.numero || "-";
  const tipoComprobante = (venta?.comprobante?.tipo || venta?.tipo || "").toString().toLowerCase();
  const isAfip = tipoComprobante === "afip" || comprobanteNumero.toUpperCase().startsWith("AFIP");
  const fiscalBlock = isAfip
    ? `
      <p class="muted"><b>Razon social:</b> ${escapeHtml(AFIP_ISSUER_NAME)}</p>
      <p class="muted"><b>Domicilio:</b> ${escapeHtml(AFIP_ISSUER_ADDRESS)}</p>
      <p class="muted"><b>Localidad:</b> ${escapeHtml(AFIP_ISSUER_CITY)}</p>
      <p class="muted"><b>CUIL:</b> ${escapeHtml(AFIP_ISSUER_CUIL)}</p>
    `
    : "";
  const orderNumber = formatOrderNumber(orden?.nro_orden);
  const emisorNombre = isAfip ? AFIP_ISSUER_NAME : "CGE Computacion";
  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Factura Orden ${escapeHtml(orderNumber)}</title>
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
              <p class="muted">Factura de servicio tecnico</p>
            </div>
          </div>
          <div>
            <p class="muted"><b>Comprobante:</b> ${comprobanteNumero}</p>
            <p class="muted"><b>Fecha:</b> ${dayjs(venta?.fecha || new Date()).format("DD/MM/YYYY HH:mm")}</p>
          </div>
        </header>

        ${isAfip ? `<section class="section fiscal-box">${fiscalBlock}</section>` : ""}

        <section class="section">
          <p class="muted"><b>Orden:</b> ${escapeHtml(orderNumber)}</p>
          <p class="muted"><b>Cliente:</b> ${orden?.cliente_nombre || "-"}</p>
          <p class="muted"><b>Equipo:</b> ${orden?.equipo || "-"}</p>
          <p class="muted"><b>Estado actual:</b> ${orden?.estado_actual || "-"}</p>
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
              ${items
                .map(
                  (item) => `
                    <tr>
                      <td>${item.descripcion || "-"}</td>
                      <td>${Number(item.cantidad).toFixed(2)}</td>
                      <td>$${Number(item.precio_unitario).toFixed(2)}</td>
                      <td>$${(Number(item.cantidad || 0) * Number(item.precio_unitario || 0)).toFixed(2)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
          <p class="total">TOTAL: $${total.toFixed(2)}</p>
        </section>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
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
  const [sortBy, setSortBy] = useState("prioridad");
  const [sortDirection, setSortDirection] = useState("desc");
  const [ordenForm, setOrdenForm] = useState(initialOrden);
  const [editingId, setEditingId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [movForm, setMovForm] = useState(initialMov);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editLoadError, setEditLoadError] = useState("");
  const [isFacturaOpen, setIsFacturaOpen] = useState(false);
  const [isLoadingFacturaOrden, setIsLoadingFacturaOrden] = useState(false);
  const [isLoadingPrintOrden, setIsLoadingPrintOrden] = useState(false);
  const [facturaForm, setFacturaForm] = useState(initialFacturaForm);
  const [facturaOrden, setFacturaOrden] = useState(null);
  const [facturaError, setFacturaError] = useState("");
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

  const facturaItemsPreview = useMemo(() => {
    if (facturaForm.modo_detalle === "manual") {
      const detalleManual = facturaForm.detalle_manual.trim();
      if (!detalleManual) {
        return [];
      }

      return [
        {
          tipo_item: "servicio",
          producto_id: null,
          descripcion: detalleManual,
          cantidad: 1,
          precio_unitario: 0
        }
      ];
    }

    return mapMovimientosToFacturaItems(facturaOrden?.movimientos || []);
  }, [facturaForm.detalle_manual, facturaForm.modo_detalle, facturaOrden]);

  const selectedCliente = useMemo(() => clientes.find((c) => String(c.id) === String(ordenForm.cliente_id)), [clientes, ordenForm.cliente_id]);

  const openCreate = () => {
    setEditingId(null);
    setEditingOrderNumber(null);
    setEditLoadError("");
    setOrdenForm(initialOrden);
    setIsDispositivoManual(false);
    setIsFormOpen(true);
  };

  const openEdit = async (orden) => {
    setIsLoadingEdit(true);
    setEditLoadError("");

    try {
      const detalleOrden = await queryClient.fetchQuery({
        queryKey: ["orden-detalle", orden.id],
        queryFn: () => api.ordenes.getById(orden.id)
      });

      setEditingId(orden.id);
      setEditingOrderNumber(detalleOrden.nro_orden || null);
      setOrdenForm(mapOrdenToForm(detalleOrden));
      setIsDispositivoManual(false);
      setIsFormOpen(true);
    } catch (error) {
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

  const openDetail = (orden) => {
    setDetailId(orden.id);
    setIsDetailOpen(true);
  };

  const openFactura = async () => {
    if (!editingId) {
      return;
    }

    setFacturaError("");
    setIsLoadingFacturaOrden(true);

    try {
      const detalleOrden = await queryClient.fetchQuery({
        queryKey: ["orden-detalle", editingId],
        queryFn: () => api.ordenes.getById(editingId)
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Ordenes de reparacion</h2>
          <p className="status">ABM de ordenes con circuito tecnico y prioridades.</p>
        </div>
        <button onClick={openCreate}>Nueva orden</button>
      </div>

      <section className="card toolbar">
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
      </section>
      <section className="card toolbar" style={{ gridTemplateColumns: "auto auto auto auto auto" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={demoradaFilter} onChange={(e) => setDemoradaFilter(e.target.checked)} />
          Solo demoradas
        </label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="prioridad">Ordenar por prioridad</option>
          <option value="estado">Ordenar por estado</option>
          <option value="fecha_creacion">Ordenar por fecha de creacion</option>
        </select>
        <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)}>
          <option value="desc">Descendente</option>
          <option value="asc">Ascendente</option>
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
            setSortBy("prioridad");
            setSortDirection("desc");
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
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Creada</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesOrdenadas.map((orden) => (
                    <tr key={orden.id} className="orden-row">
                      <td>{formatOrderNumber(orden.nro_orden)}</td>
                      <td>{orden.cliente_nombre}</td>
                      <td>{orden.equipo}</td>
                      <td>
                        <span className={`orden-estado ${getEstadoClassName(orden.estado_actual)}`}>{orden.estado_actual}</span>
                      </td>
                      <td>
                        <span className={`orden-prioridad ${getPrioridadClassName(orden.prioridad)}`}>{orden.prioridad}</span>
                      </td>
                      <td>{dayjs(orden.fecha_creacion).format("DD/MM/YYYY HH:mm")}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" onClick={() => openDetail(orden)}>
                            Ver
                          </button>
                          <button onClick={() => openEdit(orden)}>Editar</button>
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
          </>
        )}
      </section>

      <Modal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingId(null);
          setEditingOrderNumber(null);
          setEditLoadError("");
        }}
        title={editingId ? `Editar orden ${formatOrderNumber(editingOrderNumber ?? editingId)}` : "Nueva orden"}
        width={1180}
      >
        <form
          className="orden-form"
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

          <div className="actions">
            <button type="submit" disabled={saveOrdenMutation.isPending}>
              {editingId ? "Guardar cambios" : "Crear orden"}
            </button>
            {isEditMode ? (
              <button type="button" className="secondary" onClick={openFactura} disabled={isLoadingFacturaOrden}>
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
          {isLoadingEdit ? <span className="status">Cargando datos de la orden...</span> : null}
          {editLoadError ? <span className="error">{editLoadError}</span> : null}
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
                setFacturaError("Debe cargar un detalle manual o usar movimientos automaticos con contenido.");
                return;
              }

              setFacturaError("");

              facturarOrdenMutation.mutate({
                payload: {
                  tipo: facturaForm.tipo,
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
                <label>
                  Detalle
                  <textarea
                    value={facturaForm.detalle_manual}
                    onChange={(e) => setFacturaForm({ ...facturaForm, detalle_manual: e.target.value })}
                    placeholder="Ej: Reparacion de placa y limpieza completa"
                    required
                  />
                </label>
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
                          <td>$0.00</td>
                          <td>$0.00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="status">No se solicita importe final: la factura se genera con items en $0 para completar la orden.</p>
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

      <Modal
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailId(null);
        }}
        title={detalle ? `Orden ${formatOrderNumber(detalle.nro_orden)}` : "Detalle orden"}
        width={1180}
      >
        {detalle ? (
          <>
            <div className="orden-detail-layout">
              <section className="card orden-detail-card">
                <h3>Datos de la orden</h3>
                <div className="orden-detail-data-grid">
                  <article className="orden-detail-data-item">
                    <span className="status">Nro de orden</span>
                    <strong>{formatOrderNumber(detalle.nro_orden)}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Cliente</span>
                    <strong>{detalle.cliente_nombre || "-"}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Equipo</span>
                    <strong>{detalle.equipo || "-"}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Marca</span>
                    <strong>{detalle.marca || "-"}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Modelo</span>
                    <strong>{detalle.modelo || "-"}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Contraseña / PIN</span>
                    <strong>{detalle.contrasena_equipo || "-"}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Estado</span>
                    <strong>{detalle.estado_actual || "-"}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Prioridad</span>
                    <strong>{detalle.prioridad || "-"}</strong>
                  </article>
                  <article className="orden-detail-data-item">
                    <span className="status">Fecha creacion</span>
                    <strong>{dayjs(detalle.fecha_creacion).format("DD/MM/YYYY HH:mm")}</strong>
                  </article>
                </div>
                <div className="orden-detail-actions">
                  <button type="button" className="secondary" onClick={() => handlePrintOrden(detalle.id, detalle)} disabled={isLoadingPrintOrden}>
                    {isLoadingPrintOrden ? "Preparando..." : "Imprimir orden"}
                  </button>
                </div>
              </section>

              <section className="card orden-detail-card">
                <h3>Agregar movimiento</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    movimientoMutation.mutate({
                      estado: movForm.estado,
                      detalle: movForm.detalle,
                      prioridad: movForm.prioridad || undefined
                    });
                  }}
                >
                  <label>
                    Estado
                    <select value={movForm.estado} onChange={(e) => setMovForm({ ...movForm, estado: e.target.value })}>
                      <option value="ingresada">Ingresada</option>
                      <option value="en_diagnostico">En diagnostico</option>
                      <option value="en_reparacion">En reparacion</option>
                      <option value="esperando_repuesto">Esperando repuesto</option>
                      <option value="lista_para_entrega">Lista para entrega</option>
                      <option value="entregada">Entregada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </label>
                  <label>
                    Prioridad (opcional)
                    <select value={movForm.prioridad} onChange={(e) => setMovForm({ ...movForm, prioridad: e.target.value })}>
                      <option value="">Sin cambios</option>
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </label>
                  <label>
                    Detalle
                    <textarea value={movForm.detalle} onChange={(e) => setMovForm({ ...movForm, detalle: e.target.value })} required />
                  </label>
                  <button className="secondary" type="submit" disabled={movimientoMutation.isPending}>
                    Guardar movimiento
                  </button>
                </form>
              </section>
            </div>

            <section className="card" style={{ marginTop: 12 }}>
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
                      </tr>
                    </thead>
                    <tbody>
                      {(detalle.movimientos || []).map((m) => (
                        <tr key={m.id}>
                          <td>{dayjs(m.fecha).format("DD/MM/YYYY HH:mm")}</td>
                          <td>{m.estado}</td>
                          <td>{m.detalle}</td>
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

export default OrdenesPage;
