import { QueryClient } from "@tanstack/react-query";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) { isRefreshing = false; return null; }
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        isRefreshing = false;
        return null;
      }
      const { token } = await res.json();
      localStorage.setItem("token", token);
      isRefreshing = false;
      return token;
    } catch {
      isRefreshing = false;
      return null;
    }
  })();
  return refreshPromise;
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      return fetch(url, { ...options, headers });
    }
  }
  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const params = queryKey[1] as Record<string, any> | undefined;
        let fullUrl = url;
        if (params) {
          const searchParams = new URLSearchParams();
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") searchParams.set(k, String(v));
          });
          const qs = searchParams.toString();
          if (qs) fullUrl = `${url}?${qs}`;
        }
        const res = await fetchWithAuth(fullUrl);
        if (!res.ok) {
          const text = await res.text();
          let message = text;
          try { message = JSON.parse(text).error || text; } catch {}
          throw new Error(message);
        }
        return res.json();
      },
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export async function apiRequest(method: string, url: string, data?: any): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data && !(data instanceof FormData)) headers["Content-Type"] = "application/json";
  return fetchWithAuth(url, {
    method,
    headers,
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });
}
