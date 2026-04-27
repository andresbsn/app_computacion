import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../lib/api";
import Modal from "../components/Modal";

const PRIORIDADES = ["baja", "media", "alta", "urgente"];
const ESTADOS = ["vencidas", "pendientes", "completadas", "proximas"];

const initialForm = {
  descripcion: "",
  fecha_vencimiento: "",
  prioridad: "media",
  categoria: ""
};

const priorityLabel = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente"
};

const estadoLabel = {
  vencidas: "Ya vencidas",
  pendientes: "Pendientes",
  completadas: "Completadas",
  proximas: "Proximas"
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  return dayjs(value).format("DD/MM/YYYY HH:mm");
};

function ProgramarTareaPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [estado, setEstado] = useState("");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const tareasQuery = useQuery({
    queryKey: ["tareas", search, prioridad, estado],
    queryFn: () => api.tareas.list({ search, prioridad, estado })
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingId) {
        return api.tareas.update(editingId, payload);
      }
      return api.tareas.create(payload);
    },
    onSuccess: () => {
      setForm(initialForm);
      setEditingId(null);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.tareas.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tareas"] })
  });

  const toggleCompletadaMutation = useMutation({
    mutationFn: ({ id, completada }) => api.tareas.update(id, { completada }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tareas"] })
  });

  const tareas = tareasQuery.data || [];

  const stats = useMemo(() => {
    const now = dayjs();
    return tareas.reduce(
      (acc, tarea) => {
        if (tarea.completada) {
          acc.completadas += 1;
          return acc;
        }

        const due = dayjs(tarea.fecha_vencimiento);
        if (due.isBefore(now)) {
          acc.vencidas += 1;
        } else {
          acc.pendientes += 1;
        }
        return acc;
      },
      { pendientes: 0, vencidas: 0, completadas: 0 }
    );
  }, [tareas]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setIsFormOpen(true);
  };

  const openEdit = (tarea) => {
    setEditingId(tarea.id);
    setForm({
      descripcion: tarea.descripcion || "",
      fecha_vencimiento: tarea.fecha_vencimiento ? dayjs(tarea.fecha_vencimiento).format("YYYY-MM-DDTHH:mm") : "",
      prioridad: tarea.prioridad || "media",
      categoria: tarea.categoria || ""
    });
    setIsFormOpen(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Programar tarea</h2>
          <p className="status">Agenda recordatorios con vencimiento y prioridad.</p>
        </div>
        <button onClick={openCreate}>Nueva tarea</button>
      </div>

      <section className="card toolbar">
        <input
          placeholder="Buscar por descripcion o categoria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
          <option value="">Todas las prioridades</option>
          {PRIORIDADES.map((item) => (
            <option key={item} value={item}>
              {priorityLabel[item]}
            </option>
          ))}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((item) => (
            <option key={item} value={item}>
              {estadoLabel[item]}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={() => tareasQuery.refetch()}>
          Buscar
        </button>
        <button
          className="danger"
          onClick={() => {
            setSearch("");
            setPrioridad("");
            setEstado("");
          }}
        >
          Limpiar
        </button>
      </section>

      <section className="card">
        <h3>Listado</h3>
        <p className="status">
          Pendientes: {stats.pendientes} | Vencidas: {stats.vencidas} | Completadas: {stats.completadas}
        </p>

        {tareasQuery.isLoading ? (
          <div className="empty-state">Cargando tareas...</div>
        ) : (
          <>
            {tareas.length === 0 ? <div className="empty-state">No hay tareas para mostrar con los filtros actuales.</div> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Descripcion</th>
                    <th>Categoria / Asunto</th>
                    <th>Prioridad</th>
                    <th>Fecha de vencimiento</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tareas.map((tarea) => {
                    const vencida = dayjs(tarea.fecha_vencimiento).isBefore(dayjs());
                    const estadoTarea = tarea.completada ? "Completada" : vencida ? "Vencida" : "Pendiente";

                    return (
                      <tr key={tarea.id}>
                        <td>{tarea.id}</td>
                        <td>{tarea.descripcion}</td>
                        <td>{tarea.categoria || "-"}</td>
                        <td>{priorityLabel[tarea.prioridad] || tarea.prioridad}</td>
                        <td>{formatDateTime(tarea.fecha_vencimiento)}</td>
                        <td>{estadoTarea}</td>
                        <td>
                          <div className="actions">
                            <button
                              className="secondary"
                              onClick={() => toggleCompletadaMutation.mutate({ id: tarea.id, completada: !tarea.completada })}
                            >
                              {tarea.completada ? "Reabrir" : "Completar"}
                            </button>
                            <button className="secondary" onClick={() => openEdit(tarea)}>
                              Editar
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (window.confirm("Eliminar esta tarea programada?")) {
                                  deleteMutation.mutate(tarea.id);
                                }
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
        title={editingId ? `Editar tarea #${editingId}` : "Nueva tarea"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({
              descripcion: form.descripcion,
              fecha_vencimiento: form.fecha_vencimiento,
              prioridad: form.prioridad,
              categoria: form.categoria || null
            });
          }}
        >
          <label>
            Descripcion
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              required
            />
          </label>
          <label>
            Fecha de vencimiento
            <input
              type="datetime-local"
              value={form.fecha_vencimiento}
              onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
              required
            />
          </label>
          <label>
            Prioridad
            <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
              {PRIORIDADES.map((item) => (
                <option key={item} value={item}>
                  {priorityLabel[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria / Asunto
            <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </label>

          <button type="submit" disabled={saveMutation.isPending}>
            {editingId ? "Guardar cambios" : "Crear tarea"}
          </button>
          {saveMutation.error ? <span className="error">{saveMutation.error.message}</span> : null}
        </form>
      </Modal>
    </div>
  );
}

export default ProgramarTareaPage;
