import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: "super_admin" | "admin_bpp" | "admin_rida";
  isActive: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setUser(u); else { localStorage.removeItem("token"); setToken(null); } })
        .catch(() => { localStorage.removeItem("token"); setToken(null); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error || "Login gagal");
    }
    const { token: t, user: u } = await res.json();
    localStorage.setItem("token", t);
    setToken(t);
    setUser(u);
    queryClient.clear();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
