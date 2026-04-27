import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../lib/api";
import Modal from "../components/Modal";

const DETAIL_PAGE_SIZE = 5;

const initialForm = {
  nombre: "",
  telefono: "",
  email: "",
  documento: "",
  direccion: "",
  observaciones: ""
};

function ClientesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoDesc, setPagoDesc] = useState("");
  const [pagoVentaId, setPagoVentaId] = useState("");
  const [movimientosPage, setMovimientosPage] = useState(1);
  const [comprasPage, setComprasPage] = useState(1);

  const clientesQuery = useQuery({ queryKey: ["clientes", search], queryFn: () => api.clientes.list(search) });

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingId) {
        return api.clientes.update(editingId, payload);
      }
      return api.clientes.create(payload);
    },
    onSuccess: () => {
      setForm(initialForm);
      setEditingId(null);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    }
  });

  const cuentaQuery = useQuery({
    queryKey: ["cuenta-corriente", detailId],
    queryFn: () => api.clientes.getCuentaCorriente(detailId),
    enabled: Boolean(detailId)
  });

  const pagoMutation = useMutation({
    mutationFn: (payload) => api.clientes.registrarPago(detailId, payload),
    onSuccess: () => {
      setPagoMonto("");
      setPagoDesc("");
      setPagoVentaId("");
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", detailId] });
    }
  });

  const clientes = clientesQuery.data || [];
  const selected = useMemo(() => clientes.find((c) => String(c.id) === String(detailId)), [clientes, detailId]);
  const movimientos = cuentaQuery.data?.movimientos || [];
  const compras = cuentaQuery.data?.ventas || [];

  const movimientosTotalPages = Math.max(1, Math.ceil(movimientos.length / DETAIL_PAGE_SIZE));
  const comprasTotalPages = Math.max(1, Math.ceil(compras.length / DETAIL_PAGE_SIZE));

  const movimientosPageSafe = Math.min(movimientosPage, movimientosTotalPages);
  const comprasPageSafe = Math.min(comprasPage, comprasTotalPages);

  const movimientosPaginados = useMemo(() => {
    const start = (movimientosPageSafe - 1) * DETAIL_PAGE_SIZE;
    return movimientos.slice(start, start + DETAIL_PAGE_SIZE);
  }, [movimientos, movimientosPageSafe]);

  const comprasPaginadas = useMemo(() => {
    const start = (comprasPageSafe - 1) * DETAIL_PAGE_SIZE;
    return compras.slice(start, start + DETAIL_PAGE_SIZE);
  }, [compras, comprasPageSafe]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setIsFormOpen(true);
  };

  const openEdit = (cliente) => {
    setEditingId(cliente.id);
    setForm({
      nombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      email: cliente.email || "",
      documento: cliente.documento || "",
      direccion: cliente.direccion || "",
      observaciones: cliente.observaciones || ""
    });
    setIsFormOpen(true);
  };

  const openDetail = (cliente) => {
    setDetailId(cliente.id);
    setPagoMonto("");
    setPagoDesc("");
    setPagoVentaId("");
    setMovimientosPage(1);
    setComprasPage(1);
    setIsDetailOpen(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Clientes</h2>
          <p className="status">ABM de clientes con cuenta corriente.</p>
        </div>
        <button onClick={openCreate}>Nuevo cliente</button>
      </div>

      <section className="card toolbar">
        <input
          placeholder="Buscar por nombre, telefono o documento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="secondary" onClick={() => clientesQuery.refetch()}>
          Buscar
        </button>
        <button className="danger" onClick={() => setSearch("")}>
          Limpiar
        </button>
      </section>

      <section className="card">
        <h3>Listado de clientes</h3>
        {clientesQuery.isLoading ? (
          <div className="empty-state">Cargando clientes...</div>
        ) : (
          <>
            {clientes.length === 0 ? <div className="empty-state">No se encontraron clientes con esos filtros.</div> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Telefono</th>
                    <th>Documento</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td>{cliente.id}</td>
                      <td>{cliente.nombre}</td>
                      <td>{cliente.telefono || "-"}</td>
                      <td>{cliente.documento || "-"}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" onClick={() => openDetail(cliente)}>
                            Ver
                          </button>
                          <button onClick={() => openEdit(cliente)}>Editar</button>
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
        }}
        title={editingId ? `Editar cliente #${editingId}` : "Nuevo cliente"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(form);
          }}
        >
          <label>
            Nombre
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </label>
          <label>
            Telefono
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Documento
            <input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
          </label>
          <label>
            Direccion
            <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          </label>
          <label>
            Observaciones
            <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </label>
          <button type="submit" disabled={saveMutation.isPending}>
            {editingId ? "Guardar cambios" : "Crear cliente"}
          </button>
          {saveMutation.error ? <span className="error">{saveMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailId(null);
        }}
        title={selected ? `Cliente: ${selected.nombre}` : "Detalle cliente"}
      >
        {selected ? (
          <div className="grid">
            <section className="card">
              <h3>Datos principales</h3>
              <p><b>Telefono:</b> {selected.telefono || "-"}</p>
              <p><b>Email:</b> {selected.email || "-"}</p>
              <p><b>Documento:</b> {selected.documento || "-"}</p>
              <p><b>Direccion:</b> {selected.direccion || "-"}</p>
            </section>

            <section className="card">
              <h3>Cuenta corriente</h3>
              {cuentaQuery.data ? <p><b>Saldo:</b> ${Number(cuentaQuery.data.saldo).toFixed(2)}</p> : <p className="status">Cargando...</p>}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  pagoMutation.mutate({
                    monto: Number(pagoMonto),
                    descripcion: pagoDesc,
                    venta_id: pagoVentaId ? Number(pagoVentaId) : null
                  });
                }}
              >
                <label>
                  Aplicar a venta
                  <select value={pagoVentaId} onChange={(e) => setPagoVentaId(e.target.value)}>
                    <option value="">Pago general (sin venta específica)</option>
                    {(cuentaQuery.data?.ventas || []).map((venta) => (
                      <option key={venta.id} value={venta.id}>
                        #{venta.id} - {venta.comprobante_numero || "Sin comprobante"} - Pendiente ${Number(venta.saldo_pendiente || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Monto pago
                  <input
                    type="number"
                    step="0.01"
                    value={pagoMonto}
                    onChange={(e) => setPagoMonto(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Descripcion
                  <input value={pagoDesc} onChange={(e) => setPagoDesc(e.target.value)} />
                </label>
                <button className="secondary" type="submit" disabled={pagoMutation.isPending}>
                  Registrar pago
                </button>
              </form>
            </section>
          </div>
        ) : null}

        {cuentaQuery.data?.movimientos?.length ? (
          <section className="card" style={{ marginTop: 12 }}>
            <h3>Movimientos recientes</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Origen</th>
                    <th>Venta</th>
                    <th>Comprobante</th>
                    <th>Descripcion</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosPaginados.map((m) => (
                    <tr key={m.id}>
                      <td>{m.fecha ? dayjs(m.fecha).format("DD/MM/YYYY HH:mm") : "-"}</td>
                      <td>{m.tipo}</td>
                      <td>{m.origen}</td>
                      <td>{m.venta_id ? `#${m.venta_id}` : "-"}</td>
                      <td>{m.venta_comprobante_numero || "-"}</td>
                      <td>{m.descripcion || "-"}</td>
                      <td>${Number(m.monto).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {movimientos.length > DETAIL_PAGE_SIZE ? (
              <div className="actions" style={{ marginTop: 8, justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setMovimientosPage((prev) => Math.max(prev - 1, 1))}
                  disabled={movimientosPageSafe === 1}
                >
                  Anterior
                </button>
                <span className="status">
                  Pagina {movimientosPageSafe} de {movimientosTotalPages}
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setMovimientosPage((prev) => Math.min(prev + 1, movimientosTotalPages))}
                  disabled={movimientosPageSafe === movimientosTotalPages}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </section>
        ) : <div className="empty-state" style={{ marginTop: 12 }}>Todavia no hay movimientos de cuenta corriente.</div>}

        {cuentaQuery.data?.ventas?.length ? (
          <section className="card" style={{ marginTop: 12 }}>
            <h3>Compras del cliente</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Venta</th>
                    <th>Comprobante</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Pagado CC</th>
                    <th>Saldo pendiente</th>
                    <th>Forma pago</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasPaginadas.map((venta) => (
                    <tr key={venta.id}>
                      <td>#{venta.id}</td>
                      <td>{venta.comprobante_numero || "-"}</td>
                      <td>{venta.fecha ? dayjs(venta.fecha).format("DD/MM/YYYY HH:mm") : "-"}</td>
                      <td>${Number(venta.total || 0).toFixed(2)}</td>
                      <td>${Number(venta.monto_pagado_cuenta_corriente || 0).toFixed(2)}</td>
                      <td>${Number(venta.saldo_pendiente || 0).toFixed(2)}</td>
                      <td>{venta.forma_pago || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {compras.length > DETAIL_PAGE_SIZE ? (
              <div className="actions" style={{ marginTop: 8, justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setComprasPage((prev) => Math.max(prev - 1, 1))}
                  disabled={comprasPageSafe === 1}
                >
                  Anterior
                </button>
                <span className="status">
                  Pagina {comprasPageSafe} de {comprasTotalPages}
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setComprasPage((prev) => Math.min(prev + 1, comprasTotalPages))}
                  disabled={comprasPageSafe === comprasTotalPages}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
      </Modal>
    </div>
  );
}

export default ClientesPage;
