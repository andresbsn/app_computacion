import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Modal from "../components/Modal";

const initialForm = {
  codigo: "",
  nombre: "",
  descripcion: "",
  costo: "0",
  precio: "0",
  stock_actual: "0"
};

function ProductosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const productosQuery = useQuery({ queryKey: ["productos", search], queryFn: () => api.productos.list(search) });

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingId) {
        return api.productos.update(editingId, payload);
      }
      return api.productos.create(payload);
    },
    onSuccess: () => {
      setForm(initialForm);
      setEditingId(null);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["productos"] });
    }
  });

  const productos = productosQuery.data || [];

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(productos.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const productosPaginados = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return productos.slice(start, start + PAGE_SIZE);
  }, [productos, safeCurrentPage]);

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

  const openEdit = (producto) => {
    setEditingId(producto.id);
    setForm({
      codigo: producto.codigo || "",
      nombre: producto.nombre || "",
      descripcion: producto.descripcion || "",
      costo: String(producto.costo ?? 0),
      precio: String(producto.precio ?? 0),
      stock_actual: String(producto.stock_actual ?? 0)
    });
    setIsFormOpen(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Productos</h2>
          <p className="status">ABM de productos y stock inicial.</p>
        </div>
        <button onClick={openCreate}>Nuevo producto</button>
      </div>

      <section className="card toolbar">
        <input placeholder="Buscar por nombre o codigo" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="secondary" onClick={() => productosQuery.refetch()}>
          Buscar
        </button>
        <button className="danger" onClick={() => setSearch("")}>
          Limpiar
        </button>
      </section>

      <section className="card">
        <h3>Listado</h3>
        {productosQuery.isLoading ? (
          <div className="empty-state">Cargando productos...</div>
        ) : (
          <>
            {productos.length === 0 ? <div className="empty-state">No hay productos para mostrar con los filtros actuales.</div> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosPaginados.map((producto) => (
                    <tr key={producto.id}>
                      <td>{producto.id}</td>
                      <td>{producto.codigo || "-"}</td>
                      <td>{producto.nombre}</td>
                      <td>${Number(producto.precio).toFixed(2)}</td>
                      <td>{Number(producto.stock_actual).toFixed(2)}</td>
                      <td>
                        <div className="actions">
                          <button
                            className="secondary"
                            onClick={() => {
                              setDetailProduct(producto);
                              setIsDetailOpen(true);
                            }}
                          >
                            Ver
                          </button>
                          <button onClick={() => openEdit(producto)}>Editar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {productos.length > PAGE_SIZE ? (
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
        title={editingId ? `Editar producto #${editingId}` : "Nuevo producto"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({
              ...form,
              costo: Number(form.costo),
              precio: Number(form.precio),
              stock_actual: Number(form.stock_actual)
            });
          }}
        >
          <label>
            Codigo
            <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          </label>
          <label>
            Nombre
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </label>
          <label>
            Descripcion
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </label>
          <label>
            Costo
            <input type="number" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
          </label>
          <label>
            Precio
            <input type="number" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
          </label>
          <label>
            Stock
            <input
              type="number"
              step="0.01"
              value={form.stock_actual}
              onChange={(e) => setForm({ ...form, stock_actual: e.target.value })}
            />
          </label>
          <button type="submit" disabled={saveMutation.isPending}>
            {editingId ? "Guardar cambios" : "Crear producto"}
          </button>
          {saveMutation.error ? <span className="error">{saveMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal open={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={detailProduct ? `Producto: ${detailProduct.nombre}` : "Detalle producto"}>
        {detailProduct ? (
          <section className="card">
            <p><b>Codigo:</b> {detailProduct.codigo || "-"}</p>
            <p><b>Nombre:</b> {detailProduct.nombre}</p>
            <p><b>Descripcion:</b> {detailProduct.descripcion || "-"}</p>
            <p><b>Costo:</b> ${Number(detailProduct.costo).toFixed(2)}</p>
            <p><b>Precio:</b> ${Number(detailProduct.precio).toFixed(2)}</p>
            <p><b>Stock:</b> {Number(detailProduct.stock_actual).toFixed(2)}</p>
          </section>
        ) : null}
      </Modal>
    </div>
  );
}

export default ProductosPage;
