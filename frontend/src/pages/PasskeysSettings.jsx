import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, KeyRound, Trash2, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  listPasskeys,
  registerPasskey,
  deletePasskey,
  passkeysSupported,
} from "@/lib/passkeys";

/**
 * R66 — Passkey management page. Available to all authenticated roles
 * (customer, driver, admin). Renders the user's active passkeys and
 * lets them register a new one or remove an existing one.
 *
 * Route: /settings/passkeys (rendered here via a dedicated page instead
 * of reusing the Settings hub — passkey management is stateful and needs
 * its own data fetching + error surface).
 */
export default function PasskeysSettings() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const supported = passkeysSupported();

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await listPasskeys();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Could not load passkeys");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth/login", { replace: true });
      return;
    }
    refresh();
  }, [loading, user, navigate, refresh]);

  async function onRegister() {
    setError(null);
    setNotice(null);
    setRegistering(true);
    try {
      const label = window.prompt(
        "Name this passkey (e.g. iPhone, MacBook)",
        `${navigator.platform || "Passkey"}`,
      );
      if (label === null) {
        setRegistering(false);
        return;
      }
      await registerPasskey({ label: label.trim() || undefined });
      setNotice("Passkey registered. You can now sign in with Face ID / Touch ID.");
      refresh();
    } catch (e) {
      if (e?.name === "InvalidStateError") {
        setError("This device already has a passkey for your account.");
      } else if (e?.name === "NotAllowedError") {
        setError("Passkey setup was cancelled.");
      } else {
        setError(e?.message || "Passkey setup failed");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function onDelete(id) {
    if (!window.confirm("Remove this passkey? You will no longer be able to sign in with it on this device.")) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await deletePasskey(id);
      setNotice("Passkey removed.");
      refresh();
    } catch (e) {
      setError(e?.message || "Could not remove passkey");
    }
  }

  return (
    <div className="min-h-screen bg-white pb-8" data-testid="passkeys-settings-page">
      <header className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="passkeys-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">Passkeys</h1>
      </header>

      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">
        <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-[#D1FAE5] bg-[#ECFDF5] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#059669]" />
          <p className="text-[13px] leading-relaxed text-[#064E3B]">
            Passkeys let you sign in with Face ID, Touch ID or your device
            passcode instead of typing a password. They can&apos;t be phished
            and never leave your device.
          </p>
        </div>

        {!supported && (
          <p
            data-testid="passkeys-unsupported"
            className="mb-4 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[13px] text-[#7F1D1D]"
          >
            This browser does not support passkeys. Try Safari on iOS, or the
            latest Chrome / Edge / Firefox.
          </p>
        )}

        {error && (
          <p data-testid="passkeys-error" className="mb-3 text-[14px] font-medium text-[#DC2626]">
            {error}
          </p>
        )}
        {notice && (
          <p data-testid="passkeys-notice" className="mb-3 text-[14px] font-medium text-[#059669]">
            {notice}
          </p>
        )}

        <button
          type="button"
          onClick={onRegister}
          disabled={registering || !supported}
          data-testid="passkey-register-button"
          className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#D62828] text-[15px] font-bold text-white transition-colors hover:bg-[#B01F1F] disabled:opacity-60"
        >
          <Plus className="h-5 w-5" />
          {registering ? "Waiting for device…" : "Add a passkey"}
        </button>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
          Your passkeys ({items.length})
        </p>
        <div
          className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white"
          data-testid="passkeys-list"
        >
          {busy && items.length === 0 && (
            <p className="px-4 py-4 text-[13px] text-[#6B7280]">Loading…</p>
          )}
          {!busy && items.length === 0 && (
            <p className="px-4 py-4 text-[13px] text-[#6B7280]" data-testid="passkeys-empty">
              You haven&apos;t added any passkeys yet.
            </p>
          )}
          {items.map((p) => (
            <div
              key={p.id}
              data-testid={`passkey-row-${p.id.slice(0, 12)}`}
              className="flex items-center gap-3 border-b border-[#F3F4F6] px-4 py-3 last:border-b-0"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F4]">
                <KeyRound className="h-5 w-5 text-[#111111]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[14px] font-semibold text-[#111111]">
                  {p.label || "Passkey"}
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  Added {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                  {p.last_used_at
                    ? ` · Last used ${new Date(p.last_used_at).toLocaleDateString()}`
                    : " · Not used yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                data-testid={`passkey-delete-${p.id.slice(0, 12)}`}
                aria-label={`Remove ${p.label || "passkey"}`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#DC2626] hover:bg-[#FEE2E2]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
