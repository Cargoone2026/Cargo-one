import React, { useState } from "react";
import { X as XIcon, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";

/**
 * ChangePasswordModal — shared account-security modal for customer / driver /
 * admin portals.
 *
 * Uses the authenticated `POST /api/auth/me/change-password` endpoint which
 * validates the caller's CURRENT password before rotating the session token.
 * Email address remains READ-ONLY across the platform until a verified
 * email-change flow (with email delivery infrastructure) is approved by the
 * owner. Forgot / reset password likewise stays OWNER_DECISION_REQUIRED.
 */
export function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    current.length > 0 &&
    next.length >= 8 &&
    next === confirm &&
    next !== current;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    try {
      await api("/auth/me/change-password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      setDone(true);
      setTimeout(onClose, 900);
    } catch (ex) {
      setErr(ex?.message || "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      data-testid="change-password-modal"
      style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-t-[20px] bg-white sm:max-w-[440px] sm:rounded-[20px]"
        style={{ maxHeight: "min(92dvh, calc(100dvh - env(safe-area-inset-top) - 8px))" }}
      >
        <header className="flex flex-shrink-0 items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F4]">
            <Lock className="h-4 w-4 text-[#111111]" />
          </span>
          <div className="flex-1">
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#D62828]">
              ACCOUNT SECURITY
            </p>
            <h2 className="text-[18px] font-bold text-[#111111]">
              Change password
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="change-password-close"
            className="rounded-full p-2 hover:bg-[#F4F4F4]"
          >
            <XIcon className="h-5 w-5 text-[#111111]" />
          </button>
        </header>

        {done ? (
          <div className="flex-1 space-y-2 px-4 py-6 text-center">
            <p className="text-[18px] font-bold text-[#16A34A]">
              Password updated
            </p>
            <p className="text-[13px] text-[#6B7280]">
              Use your new password next time you sign in.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            <Input
              label="Current password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              testID="change-password-current"
              required
            />
            <Input
              label="New password"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              testID="change-password-new"
              required
            />
            <p className="-mt-2 text-[12px] text-[#6B7280]">
              At least 8 characters. Must differ from current password.
            </p>
            <Input
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              testID="change-password-confirm"
              required
            />
            {confirm && next && confirm !== next ? (
              <p className="text-[12px] text-[#DC2626]">Passwords do not match.</p>
            ) : null}
            {err ? (
              <p className="text-[13px] text-[#DC2626]" data-testid="change-password-error">
                {err}
              </p>
            ) : null}
            <div className="flex gap-2 pt-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}>
              <Button
                title="Cancel"
                variant="ghost"
                fullWidth={false}
                onClick={onClose}
                testID="change-password-cancel"
              />
              <Button
                type="submit"
                title="Update password"
                variant="primary"
                loading={saving}
                disabled={!canSubmit}
                testID="change-password-submit"
              />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
