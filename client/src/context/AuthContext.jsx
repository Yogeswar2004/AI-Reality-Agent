import { useState } from "react";
import api from "../api/api";
import { AuthContext } from "./authContextInstance";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token") || null;
    } catch {
      return null;
    }
  });

  const [loading] = useState(false);

  const login = async ({ email, password }) => {
    const response = await api.post("/auth/login", { email, password });
    const { token: receivedToken, user: receivedUser } = response.data;

    localStorage.setItem("token", receivedToken);
    localStorage.setItem("user", JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);
    return response.data;
  };

  const register = async ({ name, email, password }) => {
    const response = await api.post("/auth/register", { name, email, password });
    const { token: receivedToken, user: receivedUser } = response.data;

    localStorage.setItem("token", receivedToken);
    localStorage.setItem("user", JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("active_agent_run_id");
    localStorage.removeItem("active_agent_conversation_id");
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token),
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;

