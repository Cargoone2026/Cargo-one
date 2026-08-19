/**
 * @cargoone/core — HTTP client for the existing CargoOne backend.
 *
 * Design:
 *   - Reads `EXPO_PUBLIC_BACKEND_URL` at build time (Expo env convention).
 *   - Uses a bearer token from `AsyncStorage` — no cookies on native.
 *   - Every route is under `/api` (matches server.py APIRouter prefix).
 *   - Errors are surfaced as `ApiError` with the backend detail string
 *     so screens can render meaningful messages.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_TOKEN = "cargoone.token";
let overrideBaseUrl: string | null = null;

function envBaseUrl(): string {
  const injected =
    (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_BACKEND_URL) ||
    (typeof process !== "undefined" && process.env && process.env.REACT_APP_BACKEND_URL) ||
    "";
  return String(injected || "").replace(/\/$/, "");
}

/** Test-only helper to point the client at a mock server. */
export function _setBaseUrlForTests(url: string | null) {
  overrideBaseUrl = url ? url.replace(/\/$/, "") : null;
}

export function baseUrl(): string {
  return overrideBaseUrl ?? envBaseUrl();
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function readToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_TOKEN);
  } catch {
    return null;
  }
}

export async function saveToken(token: string | null) {
  if (token) await AsyncStorage.setItem(STORAGE_TOKEN, token);
  else await AsyncStorage.removeItem(STORAGE_TOKEN);
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true — attach bearer if we have one
  headers?: Record<string, string>;
}

/**
 * Perform an authenticated request to `/api{path}`.
 *
 * Returns parsed JSON on 2xx. Throws `ApiError` on non-2xx with the
 * server's `detail` string (or `Unknown error` when missing).
 */
export async function api<T = any>(
  path: string,
  { method = "GET", body, auth = true, headers = {} }: ApiOptions = {},
): Promise<T> {
  const url = `${baseUrl()}/api${path.startsWith("/") ? path : `/${path}`}`;
  const h: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (auth) {
    const t = await readToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(url, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail =
      (parsed && (parsed.detail || parsed.message)) ||
      (typeof parsed === "string" ? parsed : "Request failed");
    throw new ApiError(String(detail), res.status);
  }
  return parsed as T;
}
