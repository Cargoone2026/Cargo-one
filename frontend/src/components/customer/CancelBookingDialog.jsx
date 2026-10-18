import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

const money = (n) => `£${Number(n || 0).toFixed(2)}`;

// Customer "Cancel booking" confirm dialog: shows the server cancel-preview, then POSTs /cancel.
export function CancelBookingDialog({ open, booking, onClose, onCancelled }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const paid = booking?.payment_status === "paid";

  useEffect(() => {
    if (!open || !booking) return;
    setErr(null);
    setPreview(null);
    if (paid) {
      api(`/customer/bookings/${booking.id}/cancel-preview`).then(setPreview).catch((e) => setErr(e?.message || "Could not load the cancellation details."));
    }
  }, [open, booking, paid]);

  if (!open || !booking) return null;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/customer/bookings/${booking.id}/cancel`, { method: "POST", body: {} });
      onCancelled?.();
    } catch (e) {
      setErr(e?.message || "Could not cancel this booking.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" data-testid="cancel-booking-dialog" role="dialog" aria-modal="true">
      <div className="w-full max-w-[460px] overflow-hidden rounded-t-[20px] bg-white sm:rounded-[20px]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-[16px] font-bold text-[#111111]">Cancel booking?</h2>
          <button type="button" onClick={onClose} aria-label="Close" data-testid="cancel-booking-dialog-close" className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4 text-[13px] text-[#374151]">
          {!paid ? (
            <p data-testid="cancel-booking-unpaid-note">No deposit has been taken, so nothing will be charged or refunded.</p>
          ) : preview ? (
            <div className="space-y-1.5 rounded-[12px] bg-[#F9FAFB] p-3" data-testid="cancel-booking-preview">
              <Row label="Deposit paid" value={money(preview.deposit_paid)} />
              <Row label="Cancellation fee" value={money(preview.cancellation_fee)} testId="cancel-booking-fee" />
              <div className="border-t border-[#E5E7EB]" />
              <Row label="Refund to your card" value={money(preview.refund_amount)} strong testId="cancel-booking-refund" />
            </div>
          ) : !err ? (
            <p>Loading cancellation details…</p>
          ) : null}
          {err ? <p className="text-[12px] text-[#DC2626]" data-testid="cancel-booking-error">{err}</p> : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} data-testid="cancel-booking-keep" className="flex-1 rounded-[12px] border border-[#E5E7EB] py-3 text-[14px] font-semibold text-[#111111] hover:bg-[#F3F4F6]">
              Keep booking
            </button>
            <button
              type="button"
              disabled={busy || (paid && !preview)}
              onClick={submit}
              data-testid="cancel-booking-confirm"
              className="flex-1 rounded-[12px] bg-[#D62828] py-3 text-[14px] font-semibold text-white hover:bg-[#B01F1F] disabled:opacity-60"
            >
              {busy ? "Cancelling…" : "Cancel booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, testId }) {
  return (
    <div className="flex items-center justify-between" data-testid={testId}>
      <span>{label}</span>
      <span className={strong ? "font-bold text-[#111111]" : "text-[#111111]"}>{value}</span>
    </div>
  );
}
