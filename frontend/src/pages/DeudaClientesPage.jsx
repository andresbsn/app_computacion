import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Modal from "../components/Modal";

const PAGE_SIZE = 8;

function DeudaClientesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState(null);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoDesc, setPagoDesc] = useState("");
  const [pagoVentaId, setPagoVentaId] = useState("");

  const deudaQuery = useQuery({
    queryKey: ["reportes", "deuda-clientes", search],
    queryFn: () => api.reportes.deudaClientes(search)
  });

  const pagoMutation = useMutation({
    mutationFn: (payload) => api.clientes.registrarPago(selectedClient.id, payload),
    onSuccess: () => {
      setPagoMonto("");
      setPagoDesc("");
      setSelectedClient(null);
      queryClient.invalidateQueries({ queryKey: ["reportes", "deuda-clientes"] });
      queryClient.invalidateQueries({ queryKey: ["cuenta-corriente", selectedClient.id] });
    }
  });

  const cuentaQuery = useQuery({
    queryKey: ["cuenta-corriente", selectedClient?.id],
    queryFn: () => api.clientes.getCuentaCorriente(selectedClient.id),
    enabled: Boolean(selectedClient)
  });

  const clientes = deudaQuery.data || [];
  const totalPages = Math.max(1, Math.ceil(clientes.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const clientesPaginados = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return clientes.slice(start, start + PAGE_SIZE);
  }, [clientes, pageSafe]);
  const totalDeuda = clientes.reduce((total, cliente) => total + Number(cliente.saldo || 0), 0);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openPayment = (cliente) => {
    setSelectedClient(cliente);
    setPagoMonto("");
    setPagoDesc("");
    setPagoVentaId("");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Deuda clientes</h2>
          <p className="status">Clientes con saldo pendiente en cuenta corriente.</p>
        </div>
      </div>

      <section className="card toolbar">
        <input
          placeholder="Buscar por nombre o apellido"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="secondary" type="button" onClick={() => deudaQuery.refetch()}>
          Buscar
        </button>
        <button className="danger" type="button" onClick={() => setSearch("")}>
          Limpiar
        </button>
      </section>

      <section className="card">
        <div className="page-header">
          <h3>Listado de deudores</h3>
          <strong>Total adeudado: ${totalDeuda.toFixed(2)}</strong>
        </div>

        {deudaQuery.isLoading ? <div className="empty-state">Cargando reporte...</div> : null}
        {deudaQuery.error ? <div className="error">{deudaQuery.error.message}</div> : null}
        {!deudaQuery.isLoading && !deudaQuery.error && clientes.length === 0 ? (
          <div className="empty-state">No se encontraron clientes con deuda.</div>
        ) : null}

        {clientes.length > 0 ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Telefono</th>
                    <th>Documento</th>
                    <th>Deuda total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesPaginados.map((cliente) => (
                    <tr key={cliente.id}>
                      <td>{cliente.nombre}</td>
                      <td>{cliente.telefono || "-"}</td>
                      <td>{cliente.documento || "-"}</td>
                      <td>${Number(cliente.saldo || 0).toFixed(2)}</td>
                      <td>
                        <button type="button" onClick={() => openPayment(cliente)}>
                          Registrar pago
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {clientes.length > PAGE_SIZE ? (
              <div className="actions" style={{ marginTop: 10 }}>
                <button type="button" className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={pageSafe === 1}>
                  Anterior
                </button>
                <span className="status" style={{ alignSelf: "center" }}>
                  Pagina {pageSafe} de {totalPages}
                </span>
                <button type="button" className="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={pageSafe === totalPages}>
                  Siguiente
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <Modal
        open={Boolean(selectedClient)}
        onClose={() => {
          setSelectedClient(null);
          setPagoVentaId("");
        }}
        title={selectedClient ? `Registrar pago: ${selectedClient.nombre}` : "Registrar pago"}
      >
        {selectedClient ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              pagoMutation.mutate({
                monto: Number(pagoMonto),
                descripcion: pagoDesc,
                venta_id: pagoVentaId ? Number(pagoVentaId) : null
              });
            }}
          >
            <p><b>Saldo actual:</b> ${Number(selectedClient.saldo || 0).toFixed(2)}</p>
            <label>
              Aplicar a venta
              <select value={pagoVentaId} onChange={(event) => setPagoVentaId(event.target.value)}>
                <option value="">Pago general (sin venta especifica)</option>
                {(cuentaQuery.data?.ventas || [])
                  .filter((venta) => Number(venta.saldo_pendiente || 0) > 0)
                  .map((venta) => (
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
                min="0.01"
                step="0.01"
                max={Number(selectedClient.saldo || 0)}
                value={pagoMonto}
                onChange={(event) => setPagoMonto(event.target.value)}
                required
              />
            </label>
            <label>
              Descripcion
              <input value={pagoDesc} onChange={(event) => setPagoDesc(event.target.value)} />
            </label>
            <button type="submit" disabled={pagoMutation.isPending}>
              {pagoMutation.isPending ? "Registrando..." : "Confirmar pago"}
            </button>
            {pagoMutation.error ? <span className="error">{pagoMutation.error.message}</span> : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

export default DeudaClientesPage;
