// R66 — Passkey / WebAuthn browser helpers.
//
// Wraps the platform's `navigator.credentials` API and translates
// between the base64url strings the backend speaks and the ArrayBuffers
// the WebAuthn API requires. All requests use the shared `api()` client
// (session cookie + CSRF header where applicable).

import { api } from "@/lib/api";

// ---------- base64url ----------
function b64urlToBytes(value) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function creationOptionsFromServer(opts) {
  return {
    ...opts,
    challenge: b64urlToBytes(opts.challenge),
    user: { ...opts.user, id: b64urlToBytes(opts.user.id) },
    excludeCredentials: (opts.excludeCredentials || []).map((c) => ({
      ...c,
      id: b64urlToBytes(c.id),
    })),
  };
}

function requestOptionsFromServer(opts) {
  return {
    ...opts,
    challenge: b64urlToBytes(opts.challenge),
    allowCredentials: (opts.allowCredentials || []).map((c) => ({
      ...c,
      id: b64urlToBytes(c.id),
    })),
  };
}

function serializeAttestation(credential) {
  const r = credential.response;
  const body = {
    id: credential.id,
    rawId: bytesToB64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToB64url(r.clientDataJSON),
      attestationObject: bytesToB64url(r.attestationObject),
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
  if (typeof r.getTransports === "function") {
    try {
      body.response.transports = r.getTransports();
    } catch {
      /* older browsers */
    }
  }
  return body;
}

function serializeAssertion(credential) {
  const r = credential.response;
  const body = {
    id: credential.id,
    rawId: bytesToB64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToB64url(r.clientDataJSON),
      authenticatorData: bytesToB64url(r.authenticatorData),
      signature: bytesToB64url(r.signature),
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults()
      : {},
  };
  if (r.userHandle) body.response.userHandle = bytesToB64url(r.userHandle);
  return body;
}

// ---------- Public API ----------

export function passkeysSupported() {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === "function" &&
    typeof navigator.credentials.get === "function"
  );
}

/**
 * Register a new passkey for the CURRENTLY logged in user.
 * Returns the server's public credential metadata on success.
 */
export async function registerPasskey({ label } = {}) {
  if (!passkeysSupported()) {
    throw new Error("This browser does not support passkeys.");
  }
  const opts = await api("/auth/passkey/register/generate", { method: "POST" });
  const credential = await navigator.credentials.create({
    publicKey: creationOptionsFromServer(opts),
  });
  if (!credential) throw new Error("Passkey creation cancelled.");
  return api("/auth/passkey/register/verify", {
    method: "POST",
    body: { credential: serializeAttestation(credential), label },
  });
}

/**
 * Log in via passkey. Returns the /auth/login shape { access_token, user }.
 * The session + CSRF cookies are set by the backend response.
 */
export async function loginWithPasskey(email) {
  if (!passkeysSupported()) {
    throw new Error("This browser does not support passkeys.");
  }
  const opts = await api("/auth/passkey/login/generate", {
    method: "POST",
    body: { email },
  });
  const assertion = await navigator.credentials.get({
    publicKey: requestOptionsFromServer(opts),
  });
  if (!assertion) throw new Error("Passkey sign-in cancelled.");
  return api("/auth/passkey/login/verify", {
    method: "POST",
    body: { credential: serializeAssertion(assertion) },
  });
}

export function listPasskeys() {
  return api("/auth/passkey/list");
}

export function deletePasskey(credentialId) {
  return api(`/auth/passkey/${encodeURIComponent(credentialId)}`, {
    method: "DELETE",
  });
}
