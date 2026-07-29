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

// SEC1 — CSRF double-submit. The backend sets a non-HttpOnly `cargoone_csrf`
// cookie at login/register (and opportunistically on /auth/me). We read it
// here and echo it into the `X-CSRF-Token` header on every mutating request.
// Bearer/native clients bypass CSRF server-side so this has no effect there.
function readCsrfToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)cargoone_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Thin fetch wrapper.
 *
 *   await api("/auth/me")
 *   await api("/auth/login", { method: "POST", body: { email, password } })
 */
export async function api(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const method = (opts.method || "GET").toUpperCase();
  const headers = {
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers || {}),
  };
  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCsrfToken();
    if (csrf && !headers["X-CSRF-Token"]) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  const res = await fetch(url, {
    method,
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
