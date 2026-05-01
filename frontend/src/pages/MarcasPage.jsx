import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Modal from "../components/Modal";

const initialForm = {
  nombre: ""
};

function MarcasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const marcasQuery = useQuery({ queryKey: ["marcas", search], queryFn: () => api.marcas.list(search) });

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingId) {
        return api.marcas.update(editingId, payload);
      }
      return api.marcas.create(payload);
    },
    onSuccess: () => {
      setForm(initialForm);
      setEditingId(null);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["marcas"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.marcas.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marcas"] });
    }
  });

  const marcas = marcasQuery.data || [];

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(marcas.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const marcasPaginadas = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return marcas.slice(start, start + PAGE_SIZE);
  }, [marcas, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setIsFormOpen(true);
  };

  const openEdit = (marca) => {
    setEditingId(marca.id);
    setForm({ nombre: marca.nombre || "" });
    setIsFormOpen(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Marcas</h2>
          <p className="status">Catalogo de marcas para ordenes de reparacion.</p>
        </div>
        <button onClick={openCreate}>Nueva marca</button>
      </div>

      <section className="card toolbar">
        <input placeholder="Buscar por nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="secondary" onClick={() => marcasQuery.refetch()}>
          Buscar
        </button>
        <button className="danger" onClick={() => setSearch("")}>
          Limpiar
        </button>
      </section>

      <section className="card">
        <h3>Listado</h3>
        {marcasQuery.isLoading ? (
          <div className="empty-state">Cargando marcas...</div>
        ) : (
          <>
            {marcas.length === 0 ? <div className="empty-state">No hay marcas para mostrar.</div> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {marcasPaginadas.map((marca) => (
                    <tr key={marca.id}>
                      <td>{marca.id}</td>
                      <td>{marca.nombre}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" onClick={() => openEdit(marca)}>
                            Editar
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              if (window.confirm(`Deseas desactivar la marca '${marca.nombre}'?`)) {
                                deleteMutation.mutate(marca.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {marcas.length > PAGE_SIZE ? (
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
        }}
        title={editingId ? `Editar marca #${editingId}` : "Nueva marca"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({ nombre: form.nombre });
          }}
        >
          <label>
            Nombre
            <input value={form.nombre} onChange={(e) => setForm({ nombre: e.target.value })} required />
          </label>
          <button type="submit" disabled={saveMutation.isPending}>
            {editingId ? "Guardar cambios" : "Crear marca"}
          </button>
          {saveMutation.error ? <span className="error">{saveMutation.error.message}</span> : null}
        </form>
      </Modal>
    </div>
  );
}

export default MarcasPage;
