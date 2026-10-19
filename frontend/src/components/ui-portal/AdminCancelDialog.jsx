import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

const money = (n) => `£${Number(n || 0).toFixed(2)}`;

// Admin-only cancel (or retry=true: re-run a failed refund only). Amounts come from the server preview.
export function AdminCancelDialog({ booking, onClose, onDone, retry = false }) {
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("full");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!booking) return;
    setReason("");
    setErr(null);
    setPreview(null);
    api(`/admin/bookings/${booking.id}/cancel-preview`)
      .then((p) => {
        setPreview(p);
        const done = ["succeeded", "refunded", "pending"].includes(p?.refund_status);
        setRefund(retry ? "full" : p?.payment_status !== "paid" || done ? "none" : "full");
      })
      .catch((e) => setErr(e?.message || "Could not load the booking"));
  }, [booking]);

  if (!booking) return null;
  const paid = preview?.payment_status === "paid";
  const alreadyRefunded = ["succeeded", "refunded", "pending"].includes(preview?.refund_status);
  const options = [
    { key: "full", label: "Full refund", amount: preview?.deposit_paid, disabled: !paid || (!retry && alreadyRefunded) },
    { key: "minus_fee", label: "Refund minus cancellation fee", amount: preview?.refund_minus_fee, disabled: !paid || (!retry && alreadyRefunded) },
    { key: "none", label: alreadyRefunded ? "No refund (already refunded)" : "No refund", amount: null, disabled: false },
  ].filter((o) => !retry || o.key !== "none");

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = retry
        ? await api(`/admin/bookings/${booking.id}/retry-refund`, { method: "POST", body: { refund } })
        : await api(`/admin/bookings/${booking.id}/cancel`, { method: "POST", body: { reason: reason.trim(), refund } });
      onDone?.(r);
    } catch (e) {
      setErr(e?.message || "Could not cancel this booking");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="admin-cancel-dialog" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[16px] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <h2 className="text-[17px] font-bold text-[#111111]">{retry ? "Retry refund" : "Cancel booking (admin)"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" data-testid="admin-cancel-close" className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-[13px]">
          <p className="text-[#374151]">
            {retry
              ? "Runs the refund again for this cancelled booking. Nothing else changes and no cancellation notices are sent."
              : "The booking and job are cancelled, the driver is released, and the customer and driver are notified."}
          </p>
          {preview?.refund_status ? (
            <p className="text-[12px] text-[#6B7280]" data-testid="admin-cancel-refund-status">Current refund status: {preview.refund_status}</p>
          ) : null}
          {!retry && <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Reason (required)"
            data-testid="admin-cancel-reason"
            className="w-full rounded-[10px] border border-[#E5E7EB] p-2 focus:border-[#111111] focus:outline-none"
          />}
          <div className="space-y-2">
            {options.map((o) => (
              <label
                key={o.key}
                className={`flex items-center justify-between gap-2 rounded-[10px] border p-2.5 ${
                  refund === o.key ? "border-[#111111] bg-[#F9FAFB]" : "border-[#E5E7EB]"
                } ${o.disabled ? "opacity-50" : "cursor-pointer"}`}
                data-testid={`admin-cancel-refund-${o.key}`}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="admin_cancel_refund" disabled={o.disabled} checked={refund === o.key} onChange={() => setRefund(o.key)} />
                  {o.label}
                </span>
                {o.amount != null ? <span className="font-semibold">{money(o.amount)}</span> : null}
              </label>
            ))}
          </div>
          {err ? <p className="text-[12px] text-[#DC2626]" data-testid="admin-cancel-error">{err}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-full border border-[#E5E7EB] px-4 py-2 font-medium hover:bg-[#F9FAFB]" data-testid="admin-cancel-keep">
              {retry ? "Back" : "Keep booking"}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || (!retry && !reason.trim()) || !preview}
              className="rounded-full bg-[#B91C1C] px-4 py-2 font-semibold text-white hover:bg-[#991B1B] disabled:opacity-60"
              data-testid="admin-cancel-confirm"
            >
              {busy ? (retry ? "Refunding…" : "Cancelling…") : retry ? "Retry refund" : "Cancel booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
