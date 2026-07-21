// Cargo One web API client.
// - Uses REACT_APP_BACKEND_URL (never hard-coded).
// - Sends `credentials: "include"` on every request so the HttpOnly
//   `cargoone_session` cookie set by the backend is transmitted.
// - Never touches localStorage / IndexedDB / AsyncStorage for auth tokens.

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    "[cargoone] REACT_APP_BACKEND_URL is not set — API calls will fail.",
  );
}
export const API_BASE = `${BACKEND_URL}/api`;

/**
 * Thin fetch wrapper.
 *
 *   await api("/auth/me")
 *   await api("/auth/login", { method: "POST", body: { email, password } })
 */
export async function api(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = {
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers || {}),
  };

  const res = await fetch(url, {
    method: opts.method || "GET",
    credentials: "include", // <-- cookie transport
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && (payload.detail || payload.message)) ||
      `Request failed (${res.status})`;
    const err = new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}
