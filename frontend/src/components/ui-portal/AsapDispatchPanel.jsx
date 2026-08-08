import React, { useCallback, useEffect, useState } from "react";
import { MapPin, User, ShieldCheck, Navigation, X as XIcon, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

/**
 * AsapDispatchPanel — the "Finding a driver" experience used by
 * `/customer/dispatch/:jobId` AND embedded inline on `/customer/booking/:id`
 * whenever the booking is ASAP + paid + unclaimed. Server-authoritative:
 * every field on the screen is sourced from `/api/customer/dispatch/{job_id}`.
 *
 * Props:
 *   jobId          — the associated job id (required).
 *   onDriverFound  — callback fired when the poll first sees an
 *                    assigned_driver_id. Consumer decides whether to
 *                    navigate away or refresh the parent booking state.
 *   onCancelled    — callback fired after the customer confirms the
 *                    cancel-and-refund flow. Consumer usually navigates
 *                    to /customer/bookings.
 *   showCancel     — controls whether the "Cancel & Request Full Refund"
 *                    button renders (defaults to true).
 *   bookingId      — required if showCancel is true (customer cancel
 *                    endpoint is booking-scoped, not job-scoped).
 */
export function AsapDispatchPanel({
  jobId, bookingId, onDriverFound, onCancelled, showCancel = true,
}) {
  const [state, setState] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState(null);

  useEffect(() => {
    let alive = true;
    let timer = null;
    async function poll() {
      try {
        const s = await api(`/customer/dispatch/${jobId}`);
        if (!alive) return;
        setState(s);
        if (s.assigned_driver_id && onDriverFound) onDriverFound(s);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not read dispatch state");
      } finally {
        if (alive) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    poll();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [jobId, onDriverFound]);

  const doCancel = useCallback(async () => {
    if (!bookingId) return;
    setCancelling(true);
    setCancelErr(null);
    try {
      const r = await api(`/customer/bookings/${bookingId}/cancel-and-refund`, { method: "POST" });
      setConfirmOpen(false);
      if (onCancelled) onCancelled(r);
    } catch (e) {
      setCancelErr(e?.message || "Cancellation failed. Please try again or contact support.");
    } finally {
      setCancelling(false);
    }
  }, [bookingId, onCancelled]);

  const cancelled = state?.cancelled_at;
  const searching = state?.dispatch_eligible && !state?.assigned_driver_id;
  const notReady = state && !state.dispatch_eligible && !state.assigned_driver_id && !cancelled;
  const loading = !state && !err;
  const nationwide = (state?.current_search_radius_miles || 0) >= 500;

  return (
    <div className="min-h-[640px] bg-[#0A0A0A] text-white rounded-2xl overflow-hidden" data-testid="asap-dispatch-panel">
      <div className="mx-auto flex min-h-[640px] w-full max-w-2xl flex-col px-6 pt-8 pb-8">
        <header className="mb-2">
          <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-tight text-white sm:text-[38px]">
            {nationwide ? "Still looking for a driver" : "Finding a driver"}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-[14px] text-white/60">
            <span className="truncate">{state?.pickup_town || "…"}</span>
            <Navigation className="h-3.5 w-3.5 -rotate-45 shrink-0 text-white/40" />
            <span className="truncate">{state?.dropoff_town || "…"}</span>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          {loading && (
            <div className="flex flex-col items-center text-center" data-testid="dispatch-loading">
              <PulsePin muted />
              <p className="mt-6 text-[14px] text-white/50">Loading dispatch status…</p>
            </div>
          )}

          {cancelled && (
            <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center" data-testid="dispatch-cancelled">
              <p className="text-[15px] font-semibold text-red-300">This request was cancelled.</p>
            </div>
          )}

          {notReady && !cancelled && (
            <div className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center" data-testid="dispatch-not-ready">
              <p className="text-[14px] text-amber-200">
                Waiting for payment confirmation before we broadcast to drivers…
              </p>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center text-center" data-testid="dispatch-searching">
              <PulsePin />
              <p className="mt-8 text-[22px] font-bold text-white">
                {nationwide ? "We're now searching nationwide." : "Looking for nearby drivers…"}
              </p>
              {state?.current_search_radius_miles ? (
                <div className="mt-3 flex flex-col items-center gap-1" data-testid="dispatch-radius-status">
                  <p className="text-[14px] text-white/60">
                    Searching within{" "}
                    <strong className="text-white">
                      {nationwide ? "the UK" : `${state.current_search_radius_miles} miles`}
                    </strong>{" "}
                    · {state.drivers_notified_count || 0} driver
                    {(state.drivers_notified_count || 0) === 1 ? "" : "s"} notified
                  </p>
                  {state.next_radius_expansion_at && !nationwide ? (
                    <p className="text-[12px] text-white/40">
                      Widening the search {formatIn(state.next_radius_expansion_at)}
                    </p>
                  ) : (
                    <p className="text-[12px] text-white/40">
                      We'll keep looking until a driver accepts or you cancel.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {state?.assigned_driver_id && (
            <div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6" data-testid="dispatch-driver-found">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/20">
                  <User className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-white">{state.assigned_driver_name}</p>
                  <p className="text-[12px] text-white/60">Rating {state.assigned_driver_rating || "5.0"}</p>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[13px] text-white/70">
                <MapPin className="h-3.5 w-3.5" /> Driver is on their way to your pickup location.
              </p>
              <p className="mt-3 flex items-center gap-1 text-[12px] text-white/50">
                <ShieldCheck className="h-3 w-3" /> Booking confirmed.
              </p>
            </div>
          )}
        </div>

        {err && (
          <p className="mb-3 text-center text-[12px] text-red-400" data-testid="dispatch-error">{err}</p>
        )}

        {searching && showCancel && bookingId && (
          <div className="mt-auto space-y-2">
            <button
              type="button"
              onClick={() => { /* Keep waiting — no-op, poll continues */ }}
              disabled
              data-testid="dispatch-keep-waiting"
              className="w-full rounded-full bg-[#EA580C] px-6 py-4 text-[15px] font-bold text-black shadow-[0_8px_24px_-8px_rgba(234,88,12,0.6)] cursor-default"
            >
              Keep waiting for a driver
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              data-testid="dispatch-cancel-refund"
              className="w-full rounded-full border border-white/20 px-6 py-3.5 text-[14px] font-semibold text-white/80 hover:bg-white/5"
            >
              Cancel booking & request full refund
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => !cancelling && setConfirmOpen(false)}
          data-testid="dispatch-cancel-confirm"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-bold">Cancel ASAP booking?</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-700">
                  No driver has accepted this booking yet. You can keep waiting for a driver
                  or cancel now and request a full refund of the amount you paid. Refund timing
                  depends on your payment provider.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !cancelling && setConfirmOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 hover:bg-neutral-100"
              >
                <XIcon className="h-4 w-4 text-neutral-500" />
              </button>
            </div>
            {cancelErr && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700" data-testid="dispatch-cancel-error">
                {cancelErr}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                data-testid="dispatch-cancel-keep-waiting"
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
              >
                Keep waiting
              </button>
              <button
                type="button"
                onClick={doCancel}
                disabled={cancelling}
                data-testid="dispatch-cancel-confirm-button"
                className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Cancel & request full refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PulsePin({ muted = false }) {
  return (
    <div className={`relative flex items-center justify-center ${muted ? "opacity-40" : ""}`}>
      <span className="absolute h-40 w-40 animate-ping rounded-full bg-[#EA580C]/20 [animation-duration:2.6s]" />
      <span className="absolute h-28 w-28 animate-ping rounded-full bg-[#EA580C]/30 [animation-duration:2s]" />
      <span className="absolute h-32 w-32 rounded-full bg-[#EA580C]/15 blur-2xl" />
      <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#EA580C] shadow-[0_10px_40px_-8px_rgba(234,88,12,0.7)]">
        <MapPin className="h-10 w-10 text-black" strokeWidth={2.4} />
      </span>
    </div>
  );
}

function formatIn(iso) {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((t - Date.now()) / 1000));
  if (s <= 0) return "any moment";
  if (s < 60) return `in ${s} s`;
  return `in ${Math.floor(s / 60)} m ${s % 60} s`;
}

export default AsapDispatchPanel;
