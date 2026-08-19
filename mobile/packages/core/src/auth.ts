/**
 * @cargoone/core — Auth store.
 *
 * Thin wrapper around the backend's password + passkey login endpoints
 * with token persistence via AsyncStorage. Both mobile apps consume this
 * identical module so the customer & driver apps have a single source of
 * truth for session handling.
 */
import { api, saveToken } from "./api";
import type { AuthResponse, User, UserRole } from "./types";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: UserRole;
  vehicle?: { key: string; make?: string; reg?: string };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email: email.trim().toLowerCase(), password },
    auth: false,
  });
  await saveToken(res.access_token);
  return res;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const res = await api<AuthResponse>("/auth/register", {
    method: "POST",
    body: { ...input, email: input.email.trim().toLowerCase() },
    auth: false,
  });
  await saveToken(res.access_token);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    /* ignore — the token is being nuked locally anyway */
  }
  await saveToken(null);
}

export async function me(): Promise<User | null> {
  try {
    return await api<User>("/auth/me");
  } catch {
    return null;
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api("/auth/request-password-reset", {
    method: "POST",
    body: { email: email.trim().toLowerCase() },
    auth: false,
  });
}
