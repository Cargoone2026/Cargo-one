/**
 * @cargoone/core — Passkey adapter.
 *
 * Bridges the existing R66 WebAuthn backend to `react-native-passkey`.
 * The server contract (RP-ID = cargoone.co.uk, single-use short-TTL
 * challenges, no cross-user auth, no credential leakage) is unchanged.
 * All this file does is translate options JSON ↔ native library shapes.
 *
 * IMPORTANT — RP-ID is `cargoone.co.uk` in production. In development the
 * server may respond with a different RP-ID; we honour whatever the
 * server sends and never override it client-side, so the security model
 * cannot be weakened by the mobile client.
 */
import { api, saveToken } from "./api";
import type { AuthResponse } from "./types";

// `react-native-passkey` is imported lazily to keep this module usable
// under Jest (Node) — it's optional at test time.
type PasskeyModule = {
  Passkey: {
    isSupported: () => Promise<boolean> | boolean;
    create: (request: any) => Promise<any>;
    get: (request: any) => Promise<any>;
  };
};

async function loadPasskey(): Promise<PasskeyModule["Passkey"]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod: PasskeyModule = require("react-native-passkey");
  return mod.Passkey;
}

export async function isPasskeySupported(): Promise<boolean> {
  try {
    const p = await loadPasskey();
    return await p.isSupported();
  } catch {
    return false;
  }
}

/**
 * Register a passkey for the CURRENTLY logged in user.
 * Mirrors the web flow in `frontend/src/lib/passkeys.js`.
 */
export async function registerPasskey(label?: string): Promise<{ id: string; label?: string }> {
  const options = await api<any>("/auth/passkey/register/generate", { method: "POST" });
  const p = await loadPasskey();
  const attestation = await p.create(options);
  return await api("/auth/passkey/register/verify", {
    method: "POST",
    body: { credential: attestation, label },
  });
}

/**
 * Log in via passkey. On success the JWT is persisted so subsequent
 * `api()` calls carry it automatically.
 */
export async function loginWithPasskey(email: string): Promise<AuthResponse> {
  const options = await api<any>("/auth/passkey/login/generate", {
    method: "POST",
    body: { email: email.trim().toLowerCase() },
    auth: false,
  });
  const p = await loadPasskey();
  const assertion = await p.get(options);
  const res = await api<AuthResponse>("/auth/passkey/login/verify", {
    method: "POST",
    body: { credential: assertion },
    auth: false,
  });
  await saveToken(res.access_token);
  return res;
}

export async function listPasskeys() {
  return api("/auth/passkey/list");
}

export async function deletePasskey(credentialId: string) {
  return api(`/auth/passkey/${encodeURIComponent(credentialId)}`, { method: "DELETE" });
}
