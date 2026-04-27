import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getAuthToken, setAuthToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsReady(true);
      return;
    }

    api.auth
      .me()
      .then((response) => {
        setUser(response.user || null);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  const login = async (credentials) => {
    const response = await api.auth.login(credentials);
    setAuthToken(response.token);
    setUser(response.user || null);
    return response.user;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isReady,
      isAuthenticated: Boolean(user),
      login,
      logout
    }),
    [isReady, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
