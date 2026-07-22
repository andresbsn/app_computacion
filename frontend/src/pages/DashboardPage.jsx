import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../lib/api";

const estadoLabels = {
  ingresada: "Ingresada",
  en_diagnostico: "En diagnostico",
  en_reparacion: "En reparacion",
  esperando_repuesto: "Esperando repuesto",
  lista_para_entrega: "Lista para entrega",
  entregada: "Entregada",
  cancelada: "Cancelada"
};

const prioridadLabels = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Media",
  baja: "Baja"
};

const estadoOrder = [
  "ingresada",
  "en_diagnostico",
  "en_reparacion",
  "esperando_repuesto",
  "lista_para_entrega",
  "entregada",
  "cancelada"
];

const prioridadOrder = ["urgente", "alta", "media", "baja"];

const prioridadRank = {
  urgente: 4,
  alta: 3,
  media: 2,
  baja: 1
};

const formatDate = (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "-");

const buildChartData = (items, order, labels, key) => {
  const totals = items.reduce((acc, item) => {
    const value = item[key] || "sin_dato";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const max = Math.max(...order.map((entry) => totals[entry] || 0), 1);

  return order.map((entry) => ({
    key: entry,
    label: labels[entry] || entry,
    value: totals[entry] || 0,
    width: `${((totals[entry] || 0) / max) * 100}%`
  }));
};

function DashboardPage() {
  const [monthFilter, setMonthFilter] = useState(() => dayjs().format("YYYY-MM"));
  const [estadoFilter, setEstadoFilter] = useState("");
  const [prioridadFilter, setPrioridadFilter] = useState("");

  const ordenesQuery = useQuery({
    queryKey: ["dashboard-ordenes"],
    queryFn: () => api.ordenes.list({})
  });

  const ordenes = ordenesQuery.data || [];

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((orden) => {
      const sameMonth = monthFilter ? dayjs(orden.fecha_creacion).format("YYYY-MM") === monthFilter : true;
      const sameEstado = estadoFilter ? orden.estado_actual === estadoFilter : true;
      const samePrioridad = prioridadFilter ? orden.prioridad === prioridadFilter : true;
      return sameMonth && sameEstado && samePrioridad;
    });
  }, [estadoFilter, monthFilter, ordenes, prioridadFilter]);

  const resumen = useMemo(() => {
    const pendientes = ordenesFiltradas.filter((orden) => ["ingresada", "en_diagnostico"].includes(orden.estado_actual)).length;
    const enProceso = ordenesFiltradas.filter((orden) => ["en_reparacion", "esperando_repuesto"].includes(orden.estado_actual)).length;
    const demoradas = ordenesFiltradas.filter((orden) => orden.demorada).length;
    const urgentes = ordenesFiltradas.filter((orden) => ["urgente", "alta"].includes(orden.prioridad)).length;
    const listasEntrega = ordenesFiltradas.filter((orden) => orden.estado_actual === "lista_para_entrega").length;

    return {
      total: ordenesFiltradas.length,
      pendientes,
      enProceso,
      demoradas,
      urgentes,
      listasEntrega
    };
  }, [ordenesFiltradas]);

  const chartEstado = useMemo(() => buildChartData(ordenesFiltradas, estadoOrder, estadoLabels, "estado_actual"), [ordenesFiltradas]);
  const chartPrioridad = useMemo(() => buildChartData(ordenesFiltradas, prioridadOrder, prioridadLabels, "prioridad"), [ordenesFiltradas]);

  const focoOperativo = useMemo(() => {
    return [...ordenesFiltradas]
      .filter((orden) => !["entregada", "cancelada"].includes(orden.estado_actual))
      .sort((a, b) => {
        if (Boolean(a.demorada) !== Boolean(b.demorada)) {
          return a.demorada ? -1 : 1;
        }

        const prioridadDelta = (prioridadRank[b.prioridad] || 0) - (prioridadRank[a.prioridad] || 0);
        if (prioridadDelta !== 0) {
          return prioridadDelta;
        }

        const fechaA = a.fecha_estimada_entrega ? dayjs(a.fecha_estimada_entrega).valueOf() : Number.MAX_SAFE_INTEGER;
        const fechaB = b.fecha_estimada_entrega ? dayjs(b.fecha_estimada_entrega).valueOf() : Number.MAX_SAFE_INTEGER;
        if (fechaA !== fechaB) {
          return fechaA - fechaB;
        }

        return dayjs(b.fecha_creacion).valueOf() - dayjs(a.fecha_creacion).valueOf();
      })
      .slice(0, 6);
  }, [ordenesFiltradas]);

  return (
    <section>
      <header className="page-header dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Operacion diaria</p>
          <h2 className="page-title">Dashboard operativo</h2>
          <p className="dashboard-subtitle">Seguimiento rapido de carga, estados y prioridades del taller.</p>
        </div>

        <div className="dashboard-filters">
          <label>
            Fecha
            <input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
          </label>
          <label>
            Estado
            <select value={estadoFilter} onChange={(event) => setEstadoFilter(event.target.value)}>
              <option value="">Todos</option>
              {estadoOrder.map((estado) => (
                <option key={estado} value={estado}>
                  {estadoLabels[estado]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select value={prioridadFilter} onChange={(event) => setPrioridadFilter(event.target.value)}>
              <option value="">Todas</option>
              {prioridadOrder.map((prioridad) => (
                <option key={prioridad} value={prioridad}>
                  {prioridadLabels[prioridad]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {ordenesQuery.isLoading ? <div className="card">Cargando dashboard...</div> : null}
      {ordenesQuery.isError ? <div className="card error">{ordenesQuery.error.message}</div> : null}

      {!ordenesQuery.isLoading && !ordenesQuery.isError ? (
        <>
          <section className="dashboard-kpis">
            <article className="card dashboard-kpi">
              <span>Ordenes totales</span>
              <strong>{resumen.total}</strong>
              <small>Mes y filtros aplicados</small>
            </article>
            <article className="card dashboard-kpi">
              <span>Pendientes</span>
              <strong>{resumen.pendientes}</strong>
              <small>Ingresadas y en diagnostico</small>
            </article>
            <article className="card dashboard-kpi">
              <span>En proceso</span>
              <strong>{resumen.enProceso}</strong>
              <small>En reparacion o esperando repuesto</small>
            </article>
          </section>

          <section className="dashboard-alerts">
            <article className="card dashboard-alert dashboard-alert--danger">
              <span>Demoradas</span>
              <strong>{resumen.demoradas}</strong>
            </article>
            <article className="card dashboard-alert dashboard-alert--warning">
              <span>Prioridad alta/urgente</span>
              <strong>{resumen.urgentes}</strong>
            </article>
            <article className="card dashboard-alert dashboard-alert--success">
              <span>Listas para entregar</span>
              <strong>{resumen.listasEntrega}</strong>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="card">
              <div className="dashboard-section-head">
                <h3>Ordenes por estado</h3>
                <span>{resumen.total} registros</span>
              </div>
              <div className="dashboard-chart-list">
                {chartEstado.map((item) => (
                  <div key={item.key} className="dashboard-bar-row">
                    <div className="dashboard-bar-meta">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="dashboard-bar-track">
                      <div className="dashboard-bar-fill" style={{ width: item.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="card">
              <div className="dashboard-section-head">
                <h3>Ordenes por prioridad</h3>
                <span>Criticidad operativa</span>
              </div>
              <div className="dashboard-chart-list">
                {chartPrioridad.map((item) => (
                  <div key={item.key} className="dashboard-bar-row">
                    <div className="dashboard-bar-meta">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="dashboard-bar-track">
                      <div className="dashboard-bar-fill dashboard-bar-fill--priority" style={{ width: item.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="dashboard-grid dashboard-grid--bottom">
            <article className="card">
              <div className="dashboard-section-head">
                <h3>Foco operativo</h3>
                <span>Ordenes a revisar primero</span>
              </div>
              {focoOperativo.length === 0 ? (
                <div className="empty-state">No hay ordenes activas para los filtros actuales.</div>
              ) : (
                <div className="dashboard-focus-list">
                  {focoOperativo.map((orden) => (
                    <div key={orden.id} className="dashboard-focus-item">
                      <div>
                        <strong>#{String(orden.nro_orden).padStart(7, "0")}</strong>
                        <p>
                          {orden.cliente_nombre} · {orden.equipo}
                        </p>
                      </div>
                      <div className="dashboard-focus-meta">
                        <span>{estadoLabels[orden.estado_actual] || orden.estado_actual}</span>
                        <span>{prioridadLabels[orden.prioridad] || orden.prioridad}</span>
                        <span>{orden.demorada ? "Demorada" : `Entrega ${formatDate(orden.fecha_estimada_entrega)}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="card">
              <div className="dashboard-section-head">
                <h3>Proximos indicadores</h3>
                <span>Recomendados</span>
              </div>
              <div className="dashboard-recommendations">
                <div>
                  <strong>Tiempo promedio de reparacion</strong>
                  <p>Sirve para medir cuellos de botella reales entre ingreso y cierre.</p>
                </div>
                <div>
                  <strong>Conversion a venta</strong>
                  <p>Cuantas ordenes terminan facturadas versus canceladas o no aprobadas.</p>
                </div>
                <div>
                  <strong>Repuestos pendientes</strong>
                  <p>Volumen atrapado esperando piezas, ideal para compras y seguimiento.</p>
                </div>
                <div>
                  <strong>Carga por tecnico</strong>
                  <p>Permite balancear trabajo si mas adelante asignan responsable por orden.</p>
                </div>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}

export default DashboardPage;
