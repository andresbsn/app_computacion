import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Modal from "../components/Modal";

const tabs = [
  { key: "usuarios", label: "Usuarios" },
  { key: "marcas", label: "Marcas" },
  { key: "dispositivos", label: "Dispositivos" },
  { key: "gastos", label: "Gastos" }
];

const initialUsuario = {
  nombre: "",
  email: "",
  password: "",
  rol: "tecnico"
};

const initialMarca = {
  nombre: ""
};

const initialDispositivo = {
  nombre: ""
};

const initialGasto = {
  concepto: "",
  categoria: "",
  monto: "",
  fecha: "",
  observaciones: ""
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("es-AR");
};

function ConfiguracionPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("usuarios");

  const [usuarioSearch, setUsuarioSearch] = useState("");
  const [marcaSearch, setMarcaSearch] = useState("");
  const [dispositivoSearch, setDispositivoSearch] = useState("");
  const [gastoSearch, setGastoSearch] = useState("");

  const [usuarioForm, setUsuarioForm] = useState(initialUsuario);
  const [marcaForm, setMarcaForm] = useState(initialMarca);
  const [dispositivoForm, setDispositivoForm] = useState(initialDispositivo);
  const [gastoForm, setGastoForm] = useState(initialGasto);

  const [usuarioEditId, setUsuarioEditId] = useState(null);
  const [marcaEditId, setMarcaEditId] = useState(null);
  const [dispositivoEditId, setDispositivoEditId] = useState(null);
  const [gastoEditId, setGastoEditId] = useState(null);

  const [isUsuarioOpen, setIsUsuarioOpen] = useState(false);
  const [isMarcaOpen, setIsMarcaOpen] = useState(false);
  const [isDispositivoOpen, setIsDispositivoOpen] = useState(false);
  const [isGastoOpen, setIsGastoOpen] = useState(false);

  const usuariosQuery = useQuery({ queryKey: ["usuarios", usuarioSearch], queryFn: () => api.usuarios.list(usuarioSearch) });
  const marcasQuery = useQuery({ queryKey: ["marcas", marcaSearch], queryFn: () => api.marcas.list(marcaSearch) });
  const dispositivosQuery = useQuery({ queryKey: ["dispositivos", dispositivoSearch], queryFn: () => api.dispositivos.list(dispositivoSearch) });
  const gastosQuery = useQuery({ queryKey: ["gastos", gastoSearch], queryFn: () => api.gastos.list(gastoSearch) });

  const usuarios = usuariosQuery.data || [];
  const marcas = marcasQuery.data || [];
  const dispositivos = dispositivosQuery.data || [];
  const gastos = gastosQuery.data || [];

  const currentTabLabel = useMemo(() => tabs.find((t) => t.key === activeTab)?.label || "", [activeTab]);

  const saveUsuarioMutation = useMutation({
    mutationFn: (payload) => {
      if (usuarioEditId) {
        return api.usuarios.update(usuarioEditId, payload);
      }
      return api.usuarios.create(payload);
    },
    onSuccess: () => {
      setUsuarioForm(initialUsuario);
      setUsuarioEditId(null);
      setIsUsuarioOpen(false);
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    }
  });

  const deleteUsuarioMutation = useMutation({
    mutationFn: (id) => api.usuarios.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] })
  });

  const saveMarcaMutation = useMutation({
    mutationFn: (payload) => {
      if (marcaEditId) {
        return api.marcas.update(marcaEditId, payload);
      }
      return api.marcas.create(payload);
    },
    onSuccess: () => {
      setMarcaForm(initialMarca);
      setMarcaEditId(null);
      setIsMarcaOpen(false);
      queryClient.invalidateQueries({ queryKey: ["marcas"] });
    }
  });

  const deleteMarcaMutation = useMutation({
    mutationFn: (id) => api.marcas.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marcas"] })
  });

  const saveDispositivoMutation = useMutation({
    mutationFn: (payload) => {
      if (dispositivoEditId) {
        return api.dispositivos.update(dispositivoEditId, payload);
      }
      return api.dispositivos.create(payload);
    },
    onSuccess: () => {
      setDispositivoForm(initialDispositivo);
      setDispositivoEditId(null);
      setIsDispositivoOpen(false);
      queryClient.invalidateQueries({ queryKey: ["dispositivos"] });
    }
  });

  const deleteDispositivoMutation = useMutation({
    mutationFn: (id) => api.dispositivos.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dispositivos"] })
  });

  const saveGastoMutation = useMutation({
    mutationFn: (payload) => {
      if (gastoEditId) {
        return api.gastos.update(gastoEditId, payload);
      }
      return api.gastos.create(payload);
    },
    onSuccess: () => {
      setGastoForm(initialGasto);
      setGastoEditId(null);
      setIsGastoOpen(false);
      queryClient.invalidateQueries({ queryKey: ["gastos"] });
    }
  });

  const deleteGastoMutation = useMutation({
    mutationFn: (id) => api.gastos.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gastos"] })
  });

  const openCreateUsuario = () => {
    setUsuarioEditId(null);
    setUsuarioForm(initialUsuario);
    setIsUsuarioOpen(true);
  };

  const openEditUsuario = (usuario) => {
    setUsuarioEditId(usuario.id);
    setUsuarioForm({
      nombre: usuario.nombre || "",
      email: usuario.email || "",
      password: "",
      rol: usuario.rol || "tecnico"
    });
    setIsUsuarioOpen(true);
  };

  const openCreateMarca = () => {
    setMarcaEditId(null);
    setMarcaForm(initialMarca);
    setIsMarcaOpen(true);
  };

  const openEditMarca = (marca) => {
    setMarcaEditId(marca.id);
    setMarcaForm({ nombre: marca.nombre || "" });
    setIsMarcaOpen(true);
  };

  const openCreateDispositivo = () => {
    setDispositivoEditId(null);
    setDispositivoForm(initialDispositivo);
    setIsDispositivoOpen(true);
  };

  const openEditDispositivo = (dispositivo) => {
    setDispositivoEditId(dispositivo.id);
    setDispositivoForm({ nombre: dispositivo.nombre || "" });
    setIsDispositivoOpen(true);
  };

  const openCreateGasto = () => {
    setGastoEditId(null);
    setGastoForm(initialGasto);
    setIsGastoOpen(true);
  };

  const openEditGasto = (gasto) => {
    setGastoEditId(gasto.id);
    setGastoForm({
      concepto: gasto.concepto || "",
      categoria: gasto.categoria || "",
      monto: String(gasto.monto || ""),
      fecha: gasto.fecha ? new Date(gasto.fecha).toISOString().slice(0, 10) : "",
      observaciones: gasto.observaciones || ""
    });
    setIsGastoOpen(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Configuracion</h2>
          <p className="status">Administra usuarios, marcas, dispositivos y gastos desde un unico modulo.</p>
        </div>
      </div>

      <section className="card config-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? "secondary" : ""}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === "usuarios" ? (
        <>
          <section className="card toolbar">
            <input placeholder="Buscar por nombre o email" value={usuarioSearch} onChange={(e) => setUsuarioSearch(e.target.value)} />
            <button className="secondary" onClick={() => usuariosQuery.refetch()}>
              Buscar
            </button>
            <button onClick={openCreateUsuario}>Nuevo usuario</button>
          </section>

          <section className="card">
            <h3>{currentTabLabel}</h3>
            {usuariosQuery.isLoading ? (
              <div className="empty-state">Cargando usuarios...</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>{usuario.id}</td>
                        <td>{usuario.nombre}</td>
                        <td>{usuario.email}</td>
                        <td>{usuario.rol}</td>
                        <td>
                          <div className="actions">
                            <button className="secondary" onClick={() => openEditUsuario(usuario)}>
                              Editar
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (window.confirm(`Desactivar usuario '${usuario.nombre}'?`)) {
                                  deleteUsuarioMutation.mutate(usuario.id);
                                }
                              }}
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
            )}
          </section>
        </>
      ) : null}

      {activeTab === "marcas" ? (
        <>
          <section className="card toolbar">
            <input placeholder="Buscar marca" value={marcaSearch} onChange={(e) => setMarcaSearch(e.target.value)} />
            <button className="secondary" onClick={() => marcasQuery.refetch()}>
              Buscar
            </button>
            <button onClick={openCreateMarca}>Nueva marca</button>
          </section>

          <section className="card">
            <h3>{currentTabLabel}</h3>
            {marcasQuery.isLoading ? (
              <div className="empty-state">Cargando marcas...</div>
            ) : (
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
                    {marcas.map((marca) => (
                      <tr key={marca.id}>
                        <td>{marca.id}</td>
                        <td>{marca.nombre}</td>
                        <td>
                          <div className="actions">
                            <button className="secondary" onClick={() => openEditMarca(marca)}>
                              Editar
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (window.confirm(`Desactivar marca '${marca.nombre}'?`)) {
                                  deleteMarcaMutation.mutate(marca.id);
                                }
                              }}
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
            )}
          </section>
        </>
      ) : null}

      {activeTab === "gastos" ? (
        <>
          <section className="card toolbar">
            <input placeholder="Buscar por concepto o categoria" value={gastoSearch} onChange={(e) => setGastoSearch(e.target.value)} />
            <button className="secondary" onClick={() => gastosQuery.refetch()}>
              Buscar
            </button>
            <button onClick={openCreateGasto}>Nuevo gasto</button>
          </section>

          <section className="card">
            <h3>{currentTabLabel}</h3>
            {gastosQuery.isLoading ? (
              <div className="empty-state">Cargando gastos...</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Concepto</th>
                      <th>Categoria</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map((gasto) => (
                      <tr key={gasto.id}>
                        <td>{gasto.id}</td>
                        <td>{gasto.concepto}</td>
                        <td>{gasto.categoria || "-"}</td>
                        <td>${Number(gasto.monto).toFixed(2)}</td>
                        <td>{formatDate(gasto.fecha)}</td>
                        <td>
                          <div className="actions">
                            <button className="secondary" onClick={() => openEditGasto(gasto)}>
                              Editar
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (window.confirm(`Desactivar gasto '${gasto.concepto}'?`)) {
                                  deleteGastoMutation.mutate(gasto.id);
                                }
                              }}
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
            )}
          </section>
        </>
      ) : null}

      {activeTab === "dispositivos" ? (
        <>
          <section className="card toolbar">
            <input
              placeholder="Buscar dispositivo"
              value={dispositivoSearch}
              onChange={(e) => setDispositivoSearch(e.target.value)}
            />
            <button className="secondary" onClick={() => dispositivosQuery.refetch()}>
              Buscar
            </button>
            <button onClick={openCreateDispositivo}>Nuevo dispositivo</button>
          </section>

          <section className="card">
            <h3>{currentTabLabel}</h3>
            {dispositivosQuery.isLoading ? (
              <div className="empty-state">Cargando dispositivos...</div>
            ) : (
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
                    {dispositivos.map((dispositivo) => (
                      <tr key={dispositivo.id}>
                        <td>{dispositivo.id}</td>
                        <td>{dispositivo.nombre}</td>
                        <td>
                          <div className="actions">
                            <button className="secondary" onClick={() => openEditDispositivo(dispositivo)}>
                              Editar
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (window.confirm(`Desactivar dispositivo '${dispositivo.nombre}'?`)) {
                                  deleteDispositivoMutation.mutate(dispositivo.id);
                                }
                              }}
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
            )}
          </section>
        </>
      ) : null}

      <Modal
        open={isUsuarioOpen}
        onClose={() => {
          setIsUsuarioOpen(false);
          setUsuarioEditId(null);
        }}
        title={usuarioEditId ? `Editar usuario #${usuarioEditId}` : "Nuevo usuario"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              nombre: usuarioForm.nombre,
              email: usuarioForm.email,
              rol: usuarioForm.rol
            };
            if (usuarioForm.password) {
              payload.password = usuarioForm.password;
            }
            saveUsuarioMutation.mutate(payload);
          }}
        >
          <label>
            Nombre
            <input value={usuarioForm.nombre} onChange={(e) => setUsuarioForm({ ...usuarioForm, nombre: e.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={usuarioForm.email} onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })} required />
          </label>
          <label>
            Rol
            <select value={usuarioForm.rol} onChange={(e) => setUsuarioForm({ ...usuarioForm, rol: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="tecnico">Tecnico</option>
              <option value="caja">Caja</option>
            </select>
          </label>
          <label>
            Password {usuarioEditId ? "(opcional)" : ""}
            <input
              type="password"
              value={usuarioForm.password}
              onChange={(e) => setUsuarioForm({ ...usuarioForm, password: e.target.value })}
              required={!usuarioEditId}
            />
          </label>
          <button type="submit" disabled={saveUsuarioMutation.isPending}>
            {usuarioEditId ? "Guardar cambios" : "Crear usuario"}
          </button>
          {saveUsuarioMutation.error ? <span className="error">{saveUsuarioMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal
        open={isMarcaOpen}
        onClose={() => {
          setIsMarcaOpen(false);
          setMarcaEditId(null);
        }}
        title={marcaEditId ? `Editar marca #${marcaEditId}` : "Nueva marca"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMarcaMutation.mutate({ nombre: marcaForm.nombre });
          }}
        >
          <label>
            Nombre
            <input value={marcaForm.nombre} onChange={(e) => setMarcaForm({ nombre: e.target.value })} required />
          </label>
          <button type="submit" disabled={saveMarcaMutation.isPending}>
            {marcaEditId ? "Guardar cambios" : "Crear marca"}
          </button>
          {saveMarcaMutation.error ? <span className="error">{saveMarcaMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal
        open={isGastoOpen}
        onClose={() => {
          setIsGastoOpen(false);
          setGastoEditId(null);
        }}
        title={gastoEditId ? `Editar gasto #${gastoEditId}` : "Nuevo gasto"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveGastoMutation.mutate({
              concepto: gastoForm.concepto,
              categoria: gastoForm.categoria || null,
              monto: Number(gastoForm.monto),
              fecha: gastoForm.fecha || null,
              observaciones: gastoForm.observaciones || null
            });
          }}
        >
          <label>
            Concepto
            <input value={gastoForm.concepto} onChange={(e) => setGastoForm({ ...gastoForm, concepto: e.target.value })} required />
          </label>
          <label>
            Categoria
            <input value={gastoForm.categoria} onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value })} />
          </label>
          <label>
            Monto
            <input
              type="number"
              step="0.01"
              min="0"
              value={gastoForm.monto}
              onChange={(e) => setGastoForm({ ...gastoForm, monto: e.target.value })}
              required
            />
          </label>
          <label>
            Fecha
            <input type="date" value={gastoForm.fecha} onChange={(e) => setGastoForm({ ...gastoForm, fecha: e.target.value })} />
          </label>
          <label>
            Observaciones
            <textarea value={gastoForm.observaciones} onChange={(e) => setGastoForm({ ...gastoForm, observaciones: e.target.value })} />
          </label>
          <button type="submit" disabled={saveGastoMutation.isPending}>
            {gastoEditId ? "Guardar cambios" : "Crear gasto"}
          </button>
          {saveGastoMutation.error ? <span className="error">{saveGastoMutation.error.message}</span> : null}
        </form>
      </Modal>

      <Modal
        open={isDispositivoOpen}
        onClose={() => {
          setIsDispositivoOpen(false);
          setDispositivoEditId(null);
        }}
        title={dispositivoEditId ? `Editar dispositivo #${dispositivoEditId}` : "Nuevo dispositivo"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveDispositivoMutation.mutate({ nombre: dispositivoForm.nombre });
          }}
        >
          <label>
            Nombre
            <input value={dispositivoForm.nombre} onChange={(e) => setDispositivoForm({ nombre: e.target.value })} required />
          </label>
          <button type="submit" disabled={saveDispositivoMutation.isPending}>
            {dispositivoEditId ? "Guardar cambios" : "Crear dispositivo"}
          </button>
          {saveDispositivoMutation.error ? <span className="error">{saveDispositivoMutation.error.message}</span> : null}
        </form>
      </Modal>
    </div>
  );
}

export default ConfiguracionPage;
