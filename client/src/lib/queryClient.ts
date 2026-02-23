import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const token = localStorage.getItem("token");
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
        const res = await fetch(fullUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (data && !(data instanceof FormData)) headers["Content-Type"] = "application/json";
  return fetch(url, {
    method,
    headers,
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });
}
