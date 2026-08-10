import React, { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "@/lib/api";

/**
 * DriverCancelModal — R23.
 *
 * Shared confirmation + reason picker used by:
 *   - Driver BookingDetail (scheduled fixed + bidding + ASAP after accept)
 *   - Driver JobDetail (pre-deposit accepted state — job.status === "accepted")
 *
 * Server-authoritative: submits to POST /driver/bookings/{bookingId}/cancel,
 * which handles the atomic release + block-list + reassignment. This
 * component ONLY collects reason/explanation and shows the informational
 * account-protection warning.
 *
 * Props:
 *   - open: boolean
 *   - onClose(): close without cancelling
 *   - bookingId: string (required)
 *   - onCancelled(result): success callback — result includes reassigning_to_pool
 *
 * NEVER call this without a bookingId — pre-deposit "accepted" jobs don't have
 * a booking row yet; for those cases, use the equivalent bid-withdraw or
 * job-release endpoint (not yet implemented; frontend hides the button in
 * that state).
 */
export function DriverCancelModal({ open, onClose, bookingId, onCancelled }) {
  const [reasons, setReasons] = useState([]);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [step, setStep] = useState("pick"); // pick | confirm

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setReason("");
    setExplanation("");
    setErr(null);
    (async () => {
      try {
        const r = await api("/driver/cancel-reasons");
        setReasons(r?.reasons || []);
      } catch (_e) {
        // Fall back to a static list so cancellation still works when the
        // network hiccup takes out the metadata call. Kept in sync with the
        // server-side DRIVER_CANCEL_REASONS dict.
        setReasons([
          { key: "vehicle_issue", label: "Vehicle issue" },
          { key: "breakdown", label: "Breakdown" },
          { key: "unable_to_complete", label: "Unable to safely complete the job" },
          { key: "vehicle_unsuitable", label: "Vehicle unsuitable" },
          { key: "customer_or_location", label: "Customer/location issue" },
          { key: "personal_emergency", label: "Personal emergency" },
          { key: "route_or_access", label: "Route/access issue" },
          { key: "other", label: "Other" },
        ]);
      }
    })();
  }, [open]);

  if (!open) return null;

  const needsExplanation = reason === "other";
  const canProceed = reason && (!needsExplanation || explanation.trim().length > 0);

  const submit = async () => {
    if (!bookingId) {
      setErr("Missing booking reference — please refresh and try again.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await api(`/driver/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: { reason, explanation: explanation.trim() || null },
      });
      onCancelled?.(res);
    } catch (ex) {
      setErr(ex?.message || "Could not cancel this booking. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center"
      data-testid="driver-cancel-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-t-[20px] bg-white sm:rounded-[20px]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-[16px] font-bold text-[#111111]">
            {step === "confirm" ? "Confirm cancellation" : "Cancel this job?"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="driver-cancel-modal-close"
            className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "pick" ? (
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            <p className="mb-3 text-[13px] leading-6 text-[#374151]">
              Please choose the reason that best fits. This helps us route the
              customer to the right next step and keeps your account in good standing.
            </p>
            <div className="grid grid-cols-1 gap-2" data-testid="driver-cancel-reasons-list">
              {reasons.map((r) => (
                <label
                  key={r.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-[12px] border p-3 text-[14px] ${
                    reason === r.key
                      ? "border-[#D62828] bg-[#FEF2F2] text-[#111111]"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                  }`}
                  data-testid={`driver-cancel-reason-${r.key}`}
                >
                  <input
                    type="radio"
                    name="driver_cancel_reason"
                    value={r.key}
                    checked={reason === r.key}
                    onChange={() => setReason(r.key)}
                    className="h-4 w-4 accent-[#D62828]"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
            {needsExplanation && (
              <div className="mt-3">
                <label className="mb-1 block text-[13px] font-semibold text-[#111111]">
                  Please explain briefly
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  maxLength={500}
                  rows={3}
                  data-testid="driver-cancel-explanation-input"
                  className="w-full rounded-[10px] border border-[#E5E7EB] p-2 text-[13px] focus:border-[#D62828] focus:outline-none"
                  placeholder="A short explanation helps our team understand what happened."
                />
              </div>
            )}
            {err ? (
              <p className="mt-2 text-[12px] text-[#DC2626]" data-testid="driver-cancel-error">
                {err}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                data-testid="driver-cancel-modal-back"
                className="flex-1 rounded-[12px] border border-[#E5E7EB] py-3 text-[14px] font-semibold text-[#111111] hover:bg-[#F3F4F6]"
              >
                Never mind
              </button>
              <button
                type="button"
                disabled={!canProceed || busy}
                onClick={() => setStep("confirm")}
                data-testid="driver-cancel-modal-continue"
                className="flex-1 rounded-[12px] bg-[#D62828] py-3 text-[14px] font-semibold text-white hover:bg-[#B01F1F] disabled:opacity-60"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4">
            <div className="mb-3 flex items-start gap-2 rounded-[12px] border border-[#F59E0B] bg-[#FFFBEB] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
              <div className="text-[13px] leading-6 text-[#92400E]">
                <p className="font-semibold">Please cancel only when necessary</p>
                <p className="mt-0.5">
                  Frequent or invalid cancellations may affect your driver
                  account and could result in suspension or termination after
                  manual review. Every cancellation is recorded with the reason
                  you provide.
                </p>
              </div>
            </div>
            <p className="text-[13px] leading-6 text-[#374151]">
              Reason: <strong>{reasons.find((r) => r.key === reason)?.label}</strong>
            </p>
            {explanation ? (
              <p className="mt-1 text-[12px] italic text-[#6B7280]">"{explanation}"</p>
            ) : null}
            <p className="mt-3 text-[13px] leading-6 text-[#374151]">
              Once you confirm, this booking will be released and other eligible
              drivers may accept it. You will not be able to re-accept this same booking.
            </p>
            {err ? (
              <p className="mt-2 text-[12px] text-[#DC2626]" data-testid="driver-cancel-final-error">
                {err}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("pick")}
                data-testid="driver-cancel-modal-edit"
                className="flex-1 rounded-[12px] border border-[#E5E7EB] py-3 text-[14px] font-semibold text-[#111111] hover:bg-[#F3F4F6]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                data-testid="driver-cancel-modal-confirm"
                className="flex-1 rounded-[12px] bg-[#D62828] py-3 text-[14px] font-semibold text-white hover:bg-[#B01F1F] disabled:opacity-60"
              >
                {busy ? "Cancelling…" : "Cancel this booking"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverCancelModal;
