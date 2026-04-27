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
  prioridad: "media",
  fecha_estimada_entrega: ""
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

const renderAndPrintOrden = (orden) => {
  const printWindow = window.open("", "_blank", "width=900,height=780");
  if (!printWindow) {
    return;
  }

  const formatDate = (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-");
  const movimientos = orden?.movimientos || [];
  const movimientosRows =
    movimientos.length > 0
      ? movimientos
          .map(
            (mov) => `
              <tr>
                <td>${escapeHtml(formatDate(mov.fecha))}</td>
                <td>${escapeHtml(mov.estado)}</td>
                <td>${escapeHtml(mov.detalle)}</td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="3">Sin movimientos registrados.</td>
        </tr>
      `;

  const copies = [
    { label: "COPIA CLIENTE (INGRESO)", showRetiroFirmas: false },
    { label: "COPIA TALLER (ENTREGA/RETIRO)", showRetiroFirmas: true }
  ];

  const copiesHtml = copies
    .map(
      (copy, index) => `
      <section class="copy">
        <header class="header">
          <div class="brand">
            <img src="${logoCge}" alt="Logo CGE Computacion" />
            <div>
              <h1>Orden de reparacion</h1>
              <p class="muted">CGE Computacion</p>
            </div>
          </div>
          <div class="right">
            <p><b>Nro orden:</b> #${escapeHtml(orden?.nro_orden)}</p>
            <p><b>Fecha:</b> ${escapeHtml(formatDate(orden?.fecha_creacion))}</p>
            <p class="chip">${copy.label}</p>
          </div>
        </header>

        <section class="grid two">
          <div>
            <h3>Cliente</h3>
            <p><b>Nombre:</b> ${escapeHtml(orden?.cliente_nombre)}</p>
            <p><b>Telefono:</b> ${escapeHtml(orden?.cliente_telefono || "-")}</p>
          </div>
          <div>
            <h3>Equipo</h3>
            <p><b>Dispositivo:</b> ${escapeHtml(orden?.equipo)}</p>
            <p><b>Marca / Modelo:</b> ${escapeHtml(orden?.marca || "-")} / ${escapeHtml(orden?.modelo || "-")}</p>
            <p><b>Trajo cargador:</b> ${orden?.trajo_cargador ? "Si" : "No"}</p>
          </div>
        </section>

        <section>
          <h3>Recepcion y diagnostico inicial</h3>
          <p class="box">${escapeHtml(orden?.diagnostico_inicial)}</p>
          <p><b>Contrasena / PIN:</b> ${escapeHtml(orden?.contrasena_equipo || "-")}</p>
          <p><b>Observaciones:</b> ${escapeHtml(orden?.observaciones || "-")}</p>
        </section>

        <section>
          <h3>Estado actual</h3>
          <p><b>Estado:</b> ${escapeHtml(orden?.estado_actual)}</p>
          <p><b>Prioridad:</b> ${escapeHtml(orden?.prioridad)}</p>
          <p><b>Entrega estimada:</b> ${escapeHtml(formatDate(orden?.fecha_estimada_entrega))}</p>
        </section>

        <section>
          <h3>Movimientos</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              ${movimientosRows}
            </tbody>
          </table>
        </section>

        <section class="firmas">
          <div class="firma-linea">
            <span>Firma cliente (ingreso)</span>
          </div>
          <div class="firma-linea">
            <span>Firma recepcion / tecnico</span>
          </div>
          ${
            copy.showRetiroFirmas
              ? `
                <div class="firma-linea">
                  <span>Firma cliente (retiro)</span>
                </div>
                <div class="firma-linea">
                  <span>Firma entrega</span>
                </div>
              `
              : ""
          }
        </section>

        <p class="terms">El cliente declara dejar el equipo para revision/reparacion y aceptar las condiciones del servicio tecnico.</p>
      </section>
      ${index === 0 ? '<div class="cut-line"></div>' : ""}
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Orden #${escapeHtml(orden?.nro_orden)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
          .copy { border: 1px solid #0f172a; padding: 14px; }
          .copy + .copy { margin-top: 18px; }
          .header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #94a3b8; padding-bottom: 8px; margin-bottom: 10px; }
          .brand { display: flex; align-items: center; gap: 10px; }
          .brand img { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; }
          .brand h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
          .muted { margin: 2px 0 0; color: #475569; font-size: 12px; }
          .right { text-align: right; font-size: 12px; }
          .right p { margin: 2px 0; }
          .chip { display: inline-block; margin-top: 4px; background: #e2e8f0; border: 1px solid #94a3b8; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
          .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          h3 { font-size: 13px; margin: 10px 0 6px; text-transform: uppercase; }
          p { font-size: 12px; margin: 3px 0; }
          .box { border: 1px solid #cbd5e1; min-height: 34px; padding: 6px; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px; font-size: 11px; text-align: left; vertical-align: top; }
          th { background: #e2e8f0; }
          .firmas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
          .firma-linea { border-top: 1px solid #0f172a; padding-top: 5px; min-height: 22px; font-size: 11px; }
          .terms { margin-top: 8px; font-size: 10px; color: #334155; }
          .cut-line { border-top: 2px dashed #94a3b8; margin: 12px 0; }
          @media print {
            body { margin: 0; padding: 10mm; }
            .copy { break-inside: avoid; }
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
  const emisorNombre = isAfip ? AFIP_ISSUER_NAME : "CGE Computacion";
  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Factura Orden #${orden?.nro_orden || "-"}</title>
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
          <p class="muted"><b>Orden:</b> #${orden?.nro_orden || "-"}</p>
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
  prioridad: orden.prioridad || "media",
  fecha_estimada_entrega: orden.fecha_estimada_entrega ? dayjs(orden.fecha_estimada_entrega).format("YYYY-MM-DDTHH:mm") : ""
});

const getOrdenRowClassName = (estadoActual) => {
  if (["ingresada", "en_diagnostico"].includes(estadoActual)) {
    return "orden-row orden-row--red";
  }

  if (["en_reparacion", "esperando_repuesto"].includes(estadoActual)) {
    return "orden-row orden-row--yellow";
  }

  if (["lista_para_entrega", "entregada"].includes(estadoActual)) {
    return "orden-row orden-row--green";
  }

  return "orden-row";
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
    onSuccess: () => {
      setOrdenForm(initialOrden);
      setEditingId(null);
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
      setOrdenForm(mapOrdenToForm(detalleOrden));
      setIsDispositivoManual(false);
      setIsFormOpen(true);
    } catch (error) {
      setEditLoadError(error.message || "No se pudo cargar la orden para editar.");
    } finally {
      setIsLoadingEdit(false);
    }
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
                    <th>Entrega estimada</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesOrdenadas.map((orden) => (
                    <tr key={orden.id} className={getOrdenRowClassName(orden.estado_actual)}>
                      <td>#{orden.nro_orden}</td>
                      <td>{orden.cliente_nombre}</td>
                      <td>{orden.equipo}</td>
                      <td>{orden.estado_actual}</td>
                      <td>{orden.prioridad}</td>
                      <td>{dayjs(orden.fecha_creacion).format("DD/MM/YYYY HH:mm")}</td>
                      <td>{orden.fecha_estimada_entrega ? dayjs(orden.fecha_estimada_entrega).format("DD/MM/YYYY HH:mm") : "-"}</td>
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
          setEditLoadError("");
        }}
        title={editingId ? `Editar orden #${editingId}` : "Nueva orden"}
        width={1180}
      >
        <form
          className="orden-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isEditMode) {
              saveOrdenMutation.mutate({
                estado_actual: ordenForm.estado_actual,
                prioridad: ordenForm.prioridad,
                fecha_estimada_entrega: ordenForm.fecha_estimada_entrega || null
              });
              return;
            }

            saveOrdenMutation.mutate({
              ...ordenForm,
              cliente_id: Number(ordenForm.cliente_id),
              fecha_estimada_entrega: ordenForm.fecha_estimada_entrega || null
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
              <label>
                Fecha estimada entrega
                <input
                  type="datetime-local"
                  value={ordenForm.fecha_estimada_entrega}
                  onChange={(e) => setOrdenForm({ ...ordenForm, fecha_estimada_entrega: e.target.value })}
                />
              </label>
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
        open={isFacturaOpen}
        onClose={() => {
          setIsFacturaOpen(false);
          setFacturaError("");
          setFacturaForm(initialFacturaForm);
        }}
        title={facturaOrden ? `Facturar orden #${facturaOrden.nro_orden}` : "Generar factura"}
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
                Orden #{facturaOrden.nro_orden} - {facturaOrden.cliente_nombre} - {facturaOrden.equipo}
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
        title={detalle ? `Orden #${detalle.nro_orden}` : "Detalle orden"}
        width={1180}
      >
        {detalle ? (
          <>
            <div className="orden-detail-layout">
              <section className="card orden-detail-card">
                <h3>Datos de la orden</h3>
                <div className="orden-detail-data-grid">
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
                  <article className="orden-detail-data-item">
                    <span className="status">Entrega estimada</span>
                    <strong>{detalle.fecha_estimada_entrega ? dayjs(detalle.fecha_estimada_entrega).format("DD/MM/YYYY HH:mm") : "-"}</strong>
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
