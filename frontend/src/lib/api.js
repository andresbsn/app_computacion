const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const AUTH_TOKEN_KEY = "auth-token";

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

export const setAuthToken = (token) => {
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
};

async function request(path, options = {}) {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Error de API");
  }

  return data;
}

export const api = {
  auth: {
    login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    me: () => request("/auth/me"),
    bootstrapStatus: () => request("/auth/bootstrap-status"),
    bootstrapAdmin: (payload) => request("/auth/bootstrap-admin", { method: "POST", body: JSON.stringify(payload) })
  },
  clientes: {
    list: (search = "") => request(`/clientes${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: (payload) => request("/clientes", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/clientes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    getCuentaCorriente: (id) => request(`/clientes/${id}/cuenta-corriente`),
    registrarPago: (id, payload) =>
      request(`/clientes/${id}/cuenta-corriente/pagos`, { method: "POST", body: JSON.stringify(payload) })
  },
  productos: {
    list: (search = "") => request(`/productos${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: (payload) => request("/productos", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/productos/${id}`, { method: "PUT", body: JSON.stringify(payload) })
  },
  marcas: {
    list: (search = "") => request(`/marcas${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: (payload) => request("/marcas", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/marcas/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) => request(`/marcas/${id}`, { method: "DELETE" })
  },
  dispositivos: {
    list: (search = "") => request(`/dispositivos${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: (payload) => request("/dispositivos", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/dispositivos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) => request(`/dispositivos/${id}`, { method: "DELETE" })
  },
  usuarios: {
    list: (search = "") => request(`/usuarios${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: (payload) => request("/usuarios", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/usuarios/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) => request(`/usuarios/${id}`, { method: "DELETE" })
  },
  gastos: {
    list: (search = "") => request(`/gastos${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: (payload) => request("/gastos", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/gastos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) => request(`/gastos/${id}`, { method: "DELETE" })
  },
  tareas: {
    list: (params = {}) => request(`/programar-tareas${buildQuery(params)}`),
    create: (payload) => request("/programar-tareas", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/programar-tareas/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) => request(`/programar-tareas/${id}`, { method: "DELETE" })
  },
  ordenes: {
    list: (params = {}) => request(`/ordenes-reparacion${buildQuery(params)}`),
    getById: (id) => request(`/ordenes-reparacion/${id}`),
    create: (payload) => request("/ordenes-reparacion", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/ordenes-reparacion/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    addMovimiento: (id, payload) =>
      request(`/ordenes-reparacion/${id}/movimientos`, { method: "POST", body: JSON.stringify(payload) })
  },
  reportes: {
    ordenesPorMarca: () => request("/reportes/ordenes-por-marca")
  },
  ventas: {
    list: (params = {}) => request(`/ventas${buildQuery(params)}`),
    getById: (id) => request(`/ventas/${id}`),
    create: (payload) => request("/ventas", { method: "POST", body: JSON.stringify(payload) })
  }
};
