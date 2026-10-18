import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

// Driver "Report a problem" once items are on board (collected / on_route).
export function DriverReportProblemModal({ open, onClose, bookingId, onReported }) {
  const [reasons, setReasons] = useState([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setNote("");
    setErr(null);
    api("/driver/problem-reasons").then((r) => setReasons(r?.reasons || [])).catch(() => setReasons([]));
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/driver/bookings/${bookingId}/report-problem`, {
        method: "POST",
        body: { reason, note: note.trim() },
      });
      onReported?.();
    } catch (ex) {
      setErr(ex?.message || "Could not send your report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center"
      data-testid="driver-problem-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-t-[20px] bg-white sm:rounded-[20px]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-[16px] font-bold text-[#111111]">Report a problem</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="driver-problem-modal-close"
            className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          <p className="mb-3 text-[13px] leading-6 text-[#374151]">
            Items are on board. Tell support what&apos;s wrong and they&apos;ll arrange the next steps.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {reasons.map((r) => (
              <label
                key={r.key}
                className={`flex cursor-pointer items-center gap-2 rounded-[12px] border p-3 text-[14px] ${
                  reason === r.key
                    ? "border-[#D62828] bg-[#FEF2F2] text-[#111111]"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
                data-testid={`driver-problem-reason-${r.key}`}
              >
                <input
                  type="radio"
                  name="driver_problem_reason"
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className="h-4 w-4 accent-[#D62828]"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            data-testid="driver-problem-note"
            className="mt-3 w-full rounded-[10px] border border-[#E5E7EB] p-2 text-[13px] focus:border-[#D62828] focus:outline-none"
            placeholder="Short note for support (required)"
          />
          {err ? (
            <p className="mt-2 text-[12px] text-[#DC2626]" data-testid="driver-problem-error">{err}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[12px] border border-[#E5E7EB] py-3 text-[14px] font-semibold text-[#111111] hover:bg-[#F3F4F6]"
              data-testid="driver-problem-back"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!reason || !note.trim() || busy}
              onClick={submit}
              data-testid="driver-problem-submit"
              className="flex-1 rounded-[12px] bg-[#D62828] py-3 text-[14px] font-semibold text-white hover:bg-[#B01F1F] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send to support"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
