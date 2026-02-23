const getToken = () => localStorage.getItem("token");

export async function apiRequest(method: string, url: string, data?: any, isForm = false): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isForm && data) headers["Content-Type"] = "application/json";
  return fetch(url, {
    method,
    headers,
    body: isForm ? data : data ? JSON.stringify(data) : undefined,
  });
}

export async function fetchJSON<T = any>(url: string): Promise<T> {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
