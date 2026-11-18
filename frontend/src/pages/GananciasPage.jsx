import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../lib/api";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (value) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "-");

function GananciasPage() {
  const [fechaInicio, setFechaInicio] = useState(() => dayjs().startOf("month").format("YYYY-MM-DD"));
  const [fechaFin, setFechaFin] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [periodo, setPeriodo] = useState({
    fecha_inicio: dayjs().startOf("month").format("YYYY-MM-DD"),
    fecha_fin: dayjs().format("YYYY-MM-DD")
  });

  const gananciasQuery = useQuery({
    queryKey: ["reportes", "ganancias", periodo.fecha_inicio, periodo.fecha_fin],
    queryFn: () => api.reportes.ganancias(periodo)
  });

  const reporte = gananciasQuery.data;
  const resumen = reporte?.resumen;

  const generarReporte = (event) => {
    event.preventDefault();
    setPeriodo({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Ganancias</h2>
          <p className="status">Control de ventas, costos y gastos por período.</p>
        </div>
      </div>

      <form className="card toolbar" onSubmit={generarReporte}>
        <label>
          Fecha inicio
          <input type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} required />
        </label>
        <label>
          Fecha fin
          <input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} required />
        </label>
        <button type="submit">Generar reporte</button>
      </form>

      {gananciasQuery.isLoading ? <div className="empty-state">Cargando reporte...</div> : null}
      {gananciasQuery.error ? <div className="error">{gananciasQuery.error.message}</div> : null}

      {reporte && resumen ? (
        <>
          {reporte.advertencias?.costos_historicos_incompletos ? (
            <div className="card error">
              Hay {reporte.advertencias.items_sin_costo} ítem(s) sin costo histórico. La ganancia de esos ítems puede estar estimada.
            </div>
          ) : null}

          <section className="grid">
            <div className="card"><h3>Total ventas</h3><strong>${formatMoney(resumen.total_ventas)}</strong></div>
            <div className="card"><h3>Costo productos</h3><strong>${formatMoney(resumen.costo_productos)}</strong></div>
            <div className="card"><h3>Ganancia bruta</h3><strong>${formatMoney(resumen.ganancia_bruta)}</strong></div>
            <div className="card"><h3>Gastos</h3><strong>${formatMoney(resumen.total_gastos)}</strong></div>
            <div className="card"><h3>Ganancia neta</h3><strong>${formatMoney(resumen.ganancia_neta)}</strong></div>
            <div className="card"><h3>Margen bruto</h3><strong>{Number(resumen.margen_porcentaje || 0).toFixed(2)}%</strong></div>
          </section>

          <section className="card">
            <h3>Ventas del período ({resumen.cantidad_ventas})</h3>
            {reporte.ventas.length === 0 ? (
              <div className="empty-state">No hay ventas confirmadas en el período.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Comprobante</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Costo</th>
                      <th>Ganancia bruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.ventas.map((venta) => (
                      <tr key={venta.id}>
                        <td>{formatDate(venta.fecha)}</td>
                        <td>{venta.comprobante_numero || `Venta #${venta.id}`}</td>
                        <td>{venta.cliente_nombre || "Consumidor final"}</td>
                        <td>${formatMoney(venta.total)}</td>
                        <td>${formatMoney(venta.costo_productos)}{venta.costo_estimado ? " *" : ""}</td>
                        <td>${formatMoney(venta.ganancia_bruta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Gastos del período</h3>
            {reporte.gastos.length === 0 ? (
              <div className="empty-state">No hay gastos activos en el período.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>Categoría</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.gastos.map((gasto) => (
                      <tr key={gasto.id}>
                        <td>{formatDate(gasto.fecha)}</td>
                        <td>{gasto.concepto}</td>
                        <td>{gasto.categoria || "-"}</td>
                        <td>${formatMoney(gasto.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default GananciasPage;
