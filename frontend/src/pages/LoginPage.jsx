import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [bootstrapForm, setBootstrapForm] = useState({ nombre: "", email: "", password: "" });
  const [requiresBootstrap, setRequiresBootstrap] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    api.auth
      .bootstrapStatus()
      .then((response) => {
        setRequiresBootstrap(Boolean(response.requiresBootstrap));
      })
      .catch(() => {
        setRequiresBootstrap(false);
      });
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBootstrapChange = (event) => {
    const { name, value } = event.target;
    setBootstrapForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBootstrapSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      await api.auth.bootstrapAdmin({
        nombre: bootstrapForm.nombre.trim(),
        email: bootstrapForm.email.trim(),
        password: bootstrapForm.password
      });

      await login({ email: bootstrapForm.email.trim(), password: bootstrapForm.password });
      const redirectTo = location.state?.from?.pathname || "/clientes";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "No se pudo crear el admin inicial");
      setStatus("error");
    } finally {
      setStatus((prev) => (prev === "error" ? prev : "idle"));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      await login({ email: form.email.trim(), password: form.password });
      const redirectTo = location.state?.from?.pathname || "/clientes";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesion");
      setStatus("error");
    } finally {
      setStatus((prev) => (prev === "error" ? prev : "idle"));
    }
  };

  return (
    <div className="auth-screen">
      <div className="login-card">
        <h1>App Computacion</h1>
        <p>{requiresBootstrap ? "Crea el primer admin para habilitar el sistema" : "Inicia sesion para acceder al panel principal"}</p>

        {requiresBootstrap ? (
          <form onSubmit={handleBootstrapSubmit}>
            <label>
              Nombre
              <input
                type="text"
                name="nombre"
                value={bootstrapForm.nombre}
                onChange={handleBootstrapChange}
                placeholder="Administrador"
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                name="email"
                value={bootstrapForm.email}
                onChange={handleBootstrapChange}
                placeholder="admin@correo.com"
                required
              />
            </label>

            <label>
              Contrasena
              <input
                type="password"
                name="password"
                value={bootstrapForm.password}
                onChange={handleBootstrapChange}
                placeholder="Minimo 6 caracteres"
                required
                minLength={6}
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <button type="submit" className="secondary" disabled={status === "loading"}>
              {status === "loading" ? "Creando admin..." : "Crear admin inicial"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="usuario@correo.com"
                required
              />
            </label>

            <label>
              Contrasena
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="********"
                required
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <button type="submit" className="secondary" disabled={status === "loading"}>
              {status === "loading" ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
