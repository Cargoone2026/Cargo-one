import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MapPin, Navigation, ShieldCheck, User, Phone, MessageCircle,
  Package, X as XIcon, AlertTriangle, ChevronUp, List, PoundSterling,
  CheckCircle2, Clock, Loader2, ExternalLink, Star,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  AsapMapCanvas,
  AsapTopStatusPill,
  AsapFloatingControls,
  AsapBottomSheet,
} from "@/components/asap-uber";

/**
 * CustomerDispatch — CargoOne ASAP live booking / tracking (Uber-style).
 *
 * The single map-first customer surface for the entire ASAP lifecycle:
 *
 *   Finalising booking → Finding a driver → Driver accepted →
 *   Driver on the way → Driver arriving → Job in progress → Delivered
 *
 * All state comes from the existing CargoOne backend — no frontend-only
 * booking state machine, no independent price/refund calculations:
 *
 *   • GET  /api/customer/dispatch/{jobId}   — searching state
 *   • GET  /api/bookings/{bookingId}        — booking + driver info
 *   • GET  /api/tracking/{bookingId}        — driver live location + ETA
 *   • GET  /api/customer/bookings/{id}/cancel-preview  — R35/R36 fee
 *   • POST /api/customer/bookings/{id}/cancel-and-refund
 *
 * Preserved (do NOT change):
 *   • R26 pricing — the sheet renders whatever the backend returns; no
 *     recalculation.
 *   • R35/R36 cancellation — fee = % × deposit paid; sourced from the
 *     preview endpoint.
 *   • R37 contact privacy — `other_party` is null until the backend
 *     releases it (driver accepted AND payment_status === "paid"). The
 *     "Contact driver" action only renders when `other_party` is set.
 *   • R27 iOS Safari Mapbox fallback — the map is rendered via
 *     AsapMapCanvas which owns the fallback.
 *
 * DispatchClassic.jsx is preserved verbatim next to this file as an
 * emergency rollback — swap the import in App.js to switch back.
 */

const DISPATCH_POLL_MS = 4000;   // searching-state radius updates
const BOOKING_POLL_MS = 5000;    // booking + status transitions
const TRACKING_POLL_MS = 6000;   // driver location + ETA (only when active)

function useVisibleTab() {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/**
 * Derive a stable visual phase from the backend truth. Never invents
 * state — every branch is anchored to fields the backend already sets.
 */
function derivePhase({ dispatch, booking }) {
  if (booking?.status === "cancelled" || dispatch?.cancelled_at) return "cancelled";
  const bookingStatus = booking?.status;
  if (bookingStatus === "delivered" || bookingStatus === "completed") return "delivered";
  if (bookingStatus === "on_route") return "on_route";        // cargo picked up, heading to dropoff
  if (bookingStatus === "collected") return "collected";      // cargo secured
  if (bookingStatus === "arrived") return "arriving";         // driver at pickup
  if (bookingStatus === "travelling") return "en_route";      // heading to pickup
  const assigned = dispatch?.assigned_driver_id || booking?.assigned_driver_id;
  if (assigned) return "accepted";
  if (dispatch?.dispatch_eligible) return "searching";
  if (dispatch) return "preparing";
  return "loading";
}

const PILL_BY_PHASE = {
  loading:    { left: "Loading",           variant: "muted",   pulse: false },
  preparing:  { left: "Finalising booking",variant: "muted",   pulse: true  },
  searching:  { left: "Finding a driver",  variant: "dark",    pulse: true  },
  accepted:   { left: "Driver accepted",   variant: "success", pulse: true  },
  en_route:   { left: "Driver on the way", variant: "dark",    pulse: true  },
  arriving:   { left: "Driver arriving",   variant: "dark",    pulse: true  },
  collected:  { left: "Cargo collected",   variant: "dark",    pulse: true  },
  on_route:   { left: "Job in progress",   variant: "dark",    pulse: true  },
  delivered:  { left: "Delivered",         variant: "success", pulse: false },
  cancelled:  { left: "Cancelled",         variant: "muted",   pulse: false },
};

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `£${Number(n).toFixed(2)}`;
}

function DispatchBadgeRow({ label, value, testId }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 text-[13px]">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold text-neutral-900 tabular-nums" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

function RouteBlock({ booking, dispatch }) {
  const pickupTown = booking?.job?.pickup_town || dispatch?.pickup_town || "Pickup";
  const dropoffTown = booking?.job?.dropoff_town || dispatch?.dropoff_town || "Destination";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3" data-testid="dispatch-route-block">
      <div className="flex items-start gap-2.5">
        <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.7px] text-neutral-500">Pickup</p>
          <p className="truncate text-[14px] font-semibold text-neutral-900">{pickupTown}</p>
        </div>
      </div>
      <div className="my-1.5 ml-1.5 h-4 w-px bg-neutral-200" aria-hidden="true" />
      <div className="flex items-start gap-2.5">
        <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.7px] text-neutral-500">Destination</p>
          <p className="truncate text-[14px] font-semibold text-neutral-900">{dropoffTown}</p>
        </div>
      </div>
    </div>
  );
}

function formatIn(iso) {
  if (!iso) return null;
  try {
    const t = new Date(iso).getTime();
    const s = Math.max(0, Math.round((t - Date.now()) / 1000));
    if (s <= 0) return "any moment";
    if (s < 60) return `in ${s}s`;
    return `in ${Math.floor(s / 60)}m ${s % 60}s`;
  } catch { return null; }
}

function SearchingBody({ dispatch, booking, onOpenCancel }) {
  const nationwide = (dispatch?.current_search_radius_miles || 0) >= 500;
  const notified = dispatch?.drivers_notified_count || 0;
  const widenIn = !nationwide ? formatIn(dispatch?.next_radius_expansion_at) : null;
  return (
    <div className="space-y-4 pt-2" data-testid="dispatch-searching-body">
      <div>
        <p className="text-[16px] font-semibold text-neutral-900">
          {nationwide ? "Searching nationwide" : "Looking for nearby drivers"}
        </p>
        <p className="mt-1 text-[13px] text-neutral-500" data-testid="dispatch-widen-hint">
          {nationwide
            ? "We're now looking across the whole UK. We'll keep going until a driver accepts or you cancel."
            : widenIn
              ? `Widening the search ${widenIn}.`
              : "We'll widen the search automatically until a driver accepts."}
        </p>
      </div>
      <RouteBlock booking={booking} dispatch={dispatch} />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
            <Navigation className="h-3 w-3" /> Search radius
          </div>
          <div className="text-[16px] font-semibold" data-testid="dispatch-radius">
            {nationwide ? "Nationwide" : `${dispatch?.current_search_radius_miles || 0} mi`}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
            <User className="h-3 w-3" /> Drivers notified
          </div>
          <div className="text-[16px] font-semibold" data-testid="dispatch-notified">
            {notified}
          </div>
        </div>
      </div>
      {booking?.customer_total != null ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
          <DispatchBadgeRow label="Deposit paid" value={money(booking.deposit_amount)} testId="dispatch-deposit" />
          <DispatchBadgeRow label="Booking total" value={money(booking.customer_total)} testId="dispatch-total" />
        </div>
      ) : null}
      {booking?.id ? (
        <button
          type="button"
          onClick={onOpenCancel}
          data-testid="dispatch-cancel-refund"
          className="w-full rounded-full border border-red-200 bg-white px-4 py-3 text-[13px] font-semibold text-red-700 hover:bg-red-50"
        >
          Cancel & request refund
        </button>
      ) : null}
      <p className="flex items-center gap-1 text-[11px] text-neutral-500">
        <ShieldCheck className="h-3 w-3" />
        Driver contact details will appear only after a driver accepts your job.
      </p>
    </div>
  );
}

function DriverCard({ booking, tracking, phase }) {
  const dName = booking?.assigned_driver_name || "Your driver";
  const dRating = booking?.assigned_driver_rating;
  const other = booking?.other_party;  // R37 — server-gated
  const canContact = Boolean(other?.phone || other?.email);
  const vehicle = booking?.job?.vehicle_type
    ? booking.job.vehicle_type.replace(/_/g, " ")
    : booking?.job?.recommended_vehicle;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4" data-testid="dispatch-driver-card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white">
          <User className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-neutral-900" data-testid="dispatch-driver-name">
            {dName}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-[12px] text-neutral-500">
            {dRating ? (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span data-testid="dispatch-driver-rating">{Number(dRating).toFixed(1)}</span>
              </span>
            ) : null}
            {vehicle ? <span className="capitalize">{vehicle}</span> : null}
          </p>
        </div>
        {tracking?.eta_minutes != null && phase !== "delivered" ? (
          <div className="text-right" data-testid="dispatch-eta">
            <p className="text-[10px] uppercase tracking-[0.7px] text-neutral-500">
              {phase === "on_route" ? "Drop-off" : "Pickup"} ETA
            </p>
            <p className="text-[16px] font-bold tabular-nums text-neutral-900">
              {Math.max(0, Math.round(tracking.eta_minutes))} min
            </p>
          </div>
        ) : null}
      </div>
      {canContact ? (
        <div className="mt-3 flex gap-2">
          {other?.phone ? (
            <a
              href={`tel:${other.phone}`}
              data-testid="dispatch-driver-call"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-neutral-800"
            >
              <Phone className="h-4 w-4" /> Call driver
            </a>
          ) : null}
          {booking?.id ? (
            <a
              href={`/customer/booking/${booking.id}#messages`}
              data-testid="dispatch-driver-message"
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <MessageCircle className="h-4 w-4" /> Message
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1 text-[11px] text-neutral-500" data-testid="dispatch-contact-locked">
          <ShieldCheck className="h-3 w-3" /> Contact details will appear here once released.
        </p>
      )}
    </div>
  );
}

function TrackingBody({ booking, tracking, dispatch, phase, onOpenCancel }) {
  return (
    <div className="space-y-4 pt-2" data-testid="dispatch-tracking-body">
      <DriverCard booking={booking} tracking={tracking} phase={phase} />
      <RouteBlock booking={booking} dispatch={dispatch} />
      {tracking?.remaining_miles != null || booking?.job?.distance_miles != null ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
              <Navigation className="h-3 w-3" /> Distance
            </div>
            <div className="text-[16px] font-semibold" data-testid="dispatch-distance">
              {tracking?.remaining_miles != null
                ? `${tracking.remaining_miles} mi`
                : `${booking.job.distance_miles} mi`}
            </div>
          </div>
          {tracking?.eta_minutes != null && phase !== "delivered" ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
                <Clock className="h-3 w-3" /> ETA
              </div>
              <div className="text-[16px] font-semibold tabular-nums">
                {Math.max(0, Math.round(tracking.eta_minutes))} min
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
                <Package className="h-3 w-3" /> Service
              </div>
              <div className="truncate text-[13px] font-semibold capitalize">
                {booking?.job?.service_type?.replace(/_/g, " ") || "ASAP"}
              </div>
            </div>
          )}
        </div>
      ) : null}
      {booking?.customer_total != null ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
          <DispatchBadgeRow label="Deposit paid" value={money(booking.deposit_amount)} testId="dispatch-deposit-track" />
          <DispatchBadgeRow label="Booking total" value={money(booking.customer_total)} testId="dispatch-total-track" />
          {booking?.driver_charge != null ? (
            <DispatchBadgeRow label="Balance to driver (cash)" value={money(booking.driver_charge)} testId="dispatch-driver-charge" />
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        {booking?.id ? (
          <a
            href={`/customer/booking/${booking.id}`}
            data-testid="dispatch-view-booking"
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            <ExternalLink className="h-4 w-4" /> Full booking
          </a>
        ) : null}
        {phase !== "on_route" && phase !== "collected" && booking?.id ? (
          <button
            type="button"
            onClick={onOpenCancel}
            data-testid="dispatch-cancel-refund"
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-red-700 hover:bg-red-50"
          >
            Cancel booking
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeliveredBody({ booking }) {
  return (
    <div className="space-y-4 pt-2" data-testid="dispatch-delivered-body">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-700" />
        <div>
          <p className="text-[16px] font-semibold text-emerald-900">Delivered</p>
          <p className="mt-0.5 text-[13px] text-emerald-800/80">
            Thanks for booking with CargoOne. Your driver has marked the job as delivered.
          </p>
        </div>
      </div>
      {booking?.assigned_driver_name ? (
        <DriverCard booking={booking} tracking={null} phase="delivered" />
      ) : null}
      <RouteBlock booking={booking} dispatch={null} />
      {booking?.customer_total != null ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
          <DispatchBadgeRow label="Total paid" value={money(booking.customer_total)} testId="dispatch-delivered-total" />
        </div>
      ) : null}
      {booking?.id ? (
        <a
          href={`/customer/booking/${booking.id}`}
          data-testid="dispatch-view-booking"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
        >
          View booking details
        </a>
      ) : null}
    </div>
  );
}

function CancelledBody({ booking }) {
  return (
    <div className="space-y-4 pt-2" data-testid="dispatch-cancelled-body">
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
        <AlertTriangle className="h-6 w-6 shrink-0 text-red-700" />
        <div>
          <p className="text-[16px] font-semibold text-red-900">Cancelled</p>
          <p className="mt-0.5 text-[13px] text-red-800/80">
            This ASAP booking was cancelled. Any applicable refund will appear on your original payment method.
          </p>
        </div>
      </div>
      {booking?.cancellation_refund != null ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
          <DispatchBadgeRow label="Refund issued" value={money(booking.cancellation_refund)} testId="dispatch-cancel-refund-amount" />
          {booking.cancellation_fee != null ? (
            <DispatchBadgeRow label="Cancellation fee" value={money(booking.cancellation_fee)} testId="dispatch-cancel-fee" />
          ) : null}
        </div>
      ) : null}
      <a
        href="/customer/bookings"
        data-testid="dispatch-back-to-bookings"
        className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-3 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50"
      >
        Back to my bookings
      </a>
    </div>
  );
}

function CancelPreviewModal({ open, onClose, bookingId, onCancelled }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) { setPreview(null); return () => {}; }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const p = await api(`/customer/bookings/${bookingId}/cancel-preview`);
        if (!cancelled) setPreview(p);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Could not load cancellation preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, bookingId]);

  const doCancel = useCallback(async () => {
    if (!bookingId) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api(`/customer/bookings/${bookingId}/cancel-and-refund`, { method: "POST" });
      onCancelled && onCancelled(r);
    } catch (e) {
      setErr(e?.message || "Cancellation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [bookingId, onCancelled]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={() => !busy && onClose()}
      data-testid="dispatch-cancel-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-bold text-neutral-900">Cancel this booking?</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-700">
              {preview?.requires_fee
                ? "A driver has accepted your booking, so a cancellation fee applies. Your fee is calculated from the deposit you've already paid — you will NOT be charged the remaining booking balance."
                : "You'll receive a full refund of the deposit you paid. Refund timing depends on your payment provider."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="rounded-full p-1 hover:bg-neutral-100"
          >
            <XIcon className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
        {loading && (
          <p className="mt-3 text-[12px] text-neutral-500" data-testid="dispatch-cancel-preview-loading">
            Calculating cancellation…
          </p>
        )}
        {preview && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3" data-testid="dispatch-cancel-preview">
            <DispatchBadgeRow label="Deposit paid" value={money(preview.deposit_paid)} testId="dispatch-cancel-preview-deposit" />
            {preview.requires_fee ? (
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-neutral-500">Cancellation fee ({Number(preview.cancellation_pct).toFixed(0)}%)</span>
                <span className="font-semibold text-red-700 tabular-nums" data-testid="dispatch-cancel-preview-fee">
                  −{money(preview.cancellation_fee)}
                </span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between border-t border-neutral-200 pt-2 text-[14px]">
              <span className="font-semibold text-neutral-900">Refund</span>
              <span className="font-bold text-neutral-900 tabular-nums" data-testid="dispatch-cancel-preview-refund">
                {money(preview.refund_amount)}
              </span>
            </div>
            {preview.requires_fee ? (
              <p className="mt-2 text-[11px] leading-tight text-neutral-500">
                The remaining booking balance is <strong>not</strong> charged — it is cancelled with the job.
              </p>
            ) : null}
          </div>
        )}
        {err && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700" data-testid="dispatch-cancel-error">
            {err}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            data-testid="dispatch-cancel-keep-waiting"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
          >
            Keep booking
          </button>
          <button
            type="button"
            onClick={doCancel}
            disabled={busy || loading}
            data-testid="dispatch-cancel-confirm-button"
            className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy
              ? <><Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />Cancelling…</>
              : preview?.requires_fee
                ? `Confirm · refund ${money(preview.refund_amount)}`
                : "Cancel & request refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDispatch() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const visible = useVisibleTab();

  const [dispatch, setDispatch] = useState(null);   // /customer/dispatch/{jobId}
  const [booking, setBooking] = useState(null);     // /bookings/{bookingId}
  const [tracking, setTracking] = useState(null);   // /tracking/{bookingId}
  const [err, setErr] = useState(null);
  const [sheetSnap, setSheetSnap] = useState("half");
  const [cancelOpen, setCancelOpen] = useState(false);
  const priorPhaseRef = useRef(null);

  // Resolve bookingId once from /bookings/mine on mount.
  const [bookingId, setBookingId] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mine = await api("/bookings/mine");
        if (!alive) return;
        const match = (mine || []).find((b) => b.job_id === jobId);
        if (match) setBookingId(match.id);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not read your bookings");
      }
    })();
    return () => { alive = false; };
  }, [jobId]);

  // Dispatch poll — for radius/notified count during searching.
  useEffect(() => {
    if (!visible) return () => {};
    let alive = true;
    let timer = null;
    async function poll() {
      try {
        const s = await api(`/customer/dispatch/${jobId}`);
        if (!alive) return;
        setDispatch(s);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not read dispatch state");
      } finally {
        if (alive) timer = setTimeout(poll, DISPATCH_POLL_MS);
      }
    }
    poll();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [jobId, visible]);

  // Booking poll — status transitions + driver info + coords.
  useEffect(() => {
    if (!bookingId || !visible) return () => {};
    let alive = true;
    let timer = null;
    async function poll() {
      try {
        const b = await api(`/bookings/${bookingId}`);
        if (!alive) return;
        setBooking(b);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not read booking");
      } finally {
        if (alive) timer = setTimeout(poll, BOOKING_POLL_MS);
      }
    }
    poll();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [bookingId, visible]);

  const phase = useMemo(() => derivePhase({ dispatch, booking }), [dispatch, booking]);

  // Tracking poll — only active once a driver is assigned and the trip
  // is actually moving (or about to). Avoids hitting the endpoint during
  // pure searching state or after delivery.
  const trackingActive = ["en_route", "arriving", "collected", "on_route", "accepted"].includes(phase);
  useEffect(() => {
    if (!bookingId || !visible || !trackingActive) return () => {};
    let alive = true;
    let timer = null;
    async function poll() {
      try {
        const t = await api(`/tracking/${bookingId}`);
        if (!alive) return;
        setTracking(t);
      } catch { /* silent — tracking is nice-to-have */ }
      finally {
        if (alive) timer = setTimeout(poll, TRACKING_POLL_MS);
      }
    }
    poll();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [bookingId, visible, trackingActive]);

  // Snap the sheet to `half` when the phase changes (except delivered/
  // cancelled which are terminal — user probably wants full details).
  useEffect(() => {
    if (priorPhaseRef.current === phase) return;
    priorPhaseRef.current = phase;
    if (phase === "delivered" || phase === "cancelled") {
      setSheetSnap("half");
    } else if (phase === "accepted") {
      // A driver just accepted — briefly bump the sheet to make the
      // driver card visible without hiding the map.
      setSheetSnap("half");
    }
  }, [phase]);

  const pickupPt = booking?.job?.pickup_lat != null
    ? { lat: booking.job.pickup_lat, lng: booking.job.pickup_lng }
    : null;
  const dropoffPt = booking?.job?.dropoff_lat != null
    ? { lat: booking.job.dropoff_lat, lng: booking.job.dropoff_lng }
    : null;
  const driverPt = tracking?.last_location
    ? { lat: tracking.last_location.lat, lng: tracking.last_location.lng }
    : null;

  const pillConfig = PILL_BY_PHASE[phase] || PILL_BY_PHASE.loading;
  const pillRight = booking?.customer_total != null
    ? money(booking.customer_total)
    : null;

  const handleCancelled = useCallback((res) => {
    setCancelOpen(false);
    // Optimistic — the poll will overwrite anyway.
    setBooking((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    setDispatch((prev) => prev ? { ...prev, cancelled_at: new Date().toISOString() } : prev);
    // Keep the user on this screen; they can leave via "Back to bookings".
  }, []);

  return (
    <div
      className="relative w-full bg-neutral-900"
      style={{ height: "calc(100dvh - 72px)", minHeight: 560 }}
      data-testid="customer-dispatch"
    >
      <AsapMapCanvas
        mode="customer"
        pickup={pickupPt}
        dropoff={dropoffPt}
        driver={driverPt}
        trail={tracking?.trail}
        showSweep={phase === "searching"}
        sweepColor="#EA580C"
        data-testid="customer-dispatch-map"
      />

      {/* Top pill */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3">
        <AsapTopStatusPill
          left={pillConfig.left}
          right={pillRight}
          variant={pillConfig.variant}
          pulse={pillConfig.pulse}
          data-testid="customer-dispatch-status-pill"
        />
      </div>

      {/* Right-side floating controls */}
      <div className="absolute inset-y-0 right-0 z-20 flex flex-col justify-center">
        <AsapFloatingControls
          buttons={[
            {
              id: "list",
              icon: sheetSnap === "full" ? ChevronUp : List,
              label: sheetSnap === "full" ? "Collapse details" : "Show details",
              onClick: () => setSheetSnap(sheetSnap === "full" ? "half" : "full"),
              testId: "customer-dispatch-fab-list",
              active: sheetSnap === "full",
            },
            booking?.id ? {
              id: "booking",
              icon: ExternalLink,
              label: "Open full booking",
              onClick: () => navigate(`/customer/booking/${booking.id}`),
              testId: "customer-dispatch-fab-booking",
            } : null,
          ].filter(Boolean)}
          data-testid="customer-dispatch-floating-controls"
        />
      </div>

      {/* Bottom sheet */}
      <AsapBottomSheet
        snap={sheetSnap}
        onSnapChange={setSheetSnap}
        sheetTestId="customer-dispatch-sheet"
        header={
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {pillConfig.pulse ? (
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${
                    phase === "searching" ? "bg-[#EA580C]" :
                    phase === "delivered" ? "bg-emerald-400" :
                    "bg-neutral-800"}`}
                  />
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    phase === "searching" ? "bg-[#EA580C]" :
                    phase === "delivered" ? "bg-emerald-500" :
                    "bg-neutral-900"}`}
                  />
                </span>
              ) : (
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  phase === "delivered" ? "bg-emerald-500" :
                  phase === "cancelled" ? "bg-red-400" :
                  "bg-neutral-400"}`}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 truncate text-[14px] font-semibold text-neutral-900" data-testid="customer-dispatch-phase-label">
                {pillConfig.left}
              </span>
            </div>
            {booking?.job?.pickup_town && booking?.job?.dropoff_town ? (
              <span className="ml-3 flex min-w-0 items-center gap-1 truncate text-[11px] text-neutral-500">
                <span className="truncate">{booking.job.pickup_town}</span>
                <MapPin className="h-3 w-3 shrink-0 text-neutral-400" />
                <span className="truncate">{booking.job.dropoff_town}</span>
              </span>
            ) : null}
          </div>
        }
      >
        {phase === "cancelled" ? (
          <CancelledBody booking={booking} />
        ) : phase === "delivered" ? (
          <DeliveredBody booking={booking} />
        ) : phase === "searching" || phase === "preparing" || phase === "loading" ? (
          <SearchingBody dispatch={dispatch} booking={booking} onOpenCancel={() => setCancelOpen(true)} />
        ) : (
          <TrackingBody booking={booking} tracking={tracking} dispatch={dispatch} phase={phase} onOpenCancel={() => setCancelOpen(true)} />
        )}
        {err ? (
          <p className="mt-3 text-sm text-red-600" data-testid="dispatch-error">{err}</p>
        ) : null}
      </AsapBottomSheet>

      <CancelPreviewModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        bookingId={bookingId}
        onCancelled={handleCancelled}
      />
    </div>
  );
}
