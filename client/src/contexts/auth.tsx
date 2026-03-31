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

export async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      return null;
    }
    const { token } = await res.json();
    localStorage.setItem("token", token);
    return token;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(async r => {
          if (r.ok) return r.json();
          if (r.status === 401) {
            const newToken = await tryRefreshToken();
            if (newToken) {
              setToken(newToken);
              const r2 = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${newToken}` } });
              if (r2.ok) return r2.json();
            }
          }
          return null;
        })
        .then(u => {
          if (u) setUser(u);
          else { localStorage.removeItem("token"); localStorage.removeItem("refresh_token"); setToken(null); }
        })
        .catch(() => { localStorage.removeItem("token"); localStorage.removeItem("refresh_token"); setToken(null); })
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
    const { token: t, refresh_token: rt, user: u } = await res.json();
    localStorage.setItem("token", t);
    if (rt) localStorage.setItem("refresh_token", rt);
    setToken(t);
    setUser(u);
    queryClient.clear();
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
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
