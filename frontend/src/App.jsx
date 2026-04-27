import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import ClientesPage from "./pages/ClientesPage";
import ProductosPage from "./pages/ProductosPage";
import OrdenesPage from "./pages/OrdenesPage";
import VentasPage from "./pages/VentasPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import ProgramarTareaPage from "./pages/ProgramarTareaPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./lib/auth-context";

const navItems = [
  { to: "/clientes", label: "Clientes" },
  { to: "/productos", label: "Productos" },
  { to: "/ordenes", label: "Ordenes" },
  { to: "/ventas", label: "Ventas" },
  { to: "/programar-tarea", label: "Programar tarea" },
  { to: "/configuracion", label: "Configuracion" }
];

function ProtectedShell() {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [themeIntensity, setThemeIntensity] = useState(() => localStorage.getItem("theme-intensity") || "suave");

  useEffect(() => {
    document.body.classList.toggle("theme-ultra-soft", themeIntensity === "ultra");
    localStorage.setItem("theme-intensity", themeIntensity);
  }, [themeIntensity]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>App Computacion</h1>
        <button
          type="button"
          className="theme-switch"
          onClick={() => setThemeIntensity((prev) => (prev === "suave" ? "ultra" : "suave"))}
        >
          Tema: {themeIntensity === "ultra" ? "Ultra-suave" : "Suave"}
        </button>
        <p className="status">{user ? `${user.nombre} (${user.rol})` : ""}</p>
        <button type="button" onClick={logout}>
          Cerrar sesion
        </button>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname.startsWith(item.to) ? "nav-link active" : "nav-link"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/ordenes" element={<OrdenesPage />} />
          <Route path="/ventas" element={<VentasPage />} />
          <Route path="/programar-tarea" element={<ProgramarTareaPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return <div className="auth-loading">Verificando sesion...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/clientes" replace /> : <LoginPage />} />
      <Route path="/*" element={isAuthenticated ? <ProtectedShell /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
