import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Truck, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";

/**
 * Post-payment celebration screen — the moment the signed Stripe webhook
 * (or /payments/status poller) confirms the deposit is paid, the customer
 * lands here for ~2 seconds of positive feedback before we hand off to the
 * existing dispatch / booking-detail flow.
 *
 * We intentionally keep this VERY light: no polling, no forms — just a
 * confirmation and a primary CTA. All the heavy lifting (dispatch handoff,
 * driver assignment tracking) is already owned by /customer/dispatch/:jobId
 * and /customer/booking/:id.
 */
export default function CustomerBookingConfirmed() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [b, setB] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const bk = await api(`/bookings/${id}`);
        if (!alive) return;
        setB(bk);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not load your booking");
      }
    }
    load();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    // Auto-forward after 2.5s to the appropriate live experience.
    if (!b) return undefined;
    const t = setTimeout(() => {
      if (b.service_timing === "asap" && !b.assigned_driver_id) {
        navigate(`/customer/dispatch/${b.job_id}`, { replace: true });
      } else {
        navigate(`/customer/booking/${b.id}`, { replace: true });
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [b, navigate]);

  if (err) {
    return (
      <div className="mx-auto max-w-md p-6 text-center" data-testid="booking-confirmed-error">
        <p className="text-sm text-red-600">{err}</p>
        <Button
          onClick={() => navigate(`/customer/booking/${id}`, { replace: true })}
          className="mt-4"
          data-testid="booking-confirmed-fallback-cta"
        >
          View booking
        </Button>
      </div>
    );
  }

  if (!b) {
    return (
      <div className="mx-auto max-w-md p-10 text-center" data-testid="booking-confirmed-loading">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-neutral-400" />
        <p className="text-sm text-neutral-500 mt-3">Confirming your booking…</p>
      </div>
    );
  }

  const isRecovery = b.service_type === "breakdown_recovery";
  const isAsap = b.service_timing === "asap";

  return (
    <div className="mx-auto max-w-md p-6 text-center" data-testid="booking-confirmed">
      <div className="mx-auto mb-4 relative">
        <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping w-24 h-24 mx-auto" />
        <CheckCircle2 className="relative mx-auto h-24 w-24 text-emerald-500" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Booking confirmed
      </h1>
      <p className="text-neutral-500 mb-6">
        {isAsap
          ? isRecovery
            ? "Your recovery driver is being dispatched. Sit tight — we'll be with you soon."
            : "Your driver is being dispatched. Sit tight — we'll be with you soon."
          : "We've received your deposit. Your driver will be in touch shortly."}
      </p>
      <div className="rounded-2xl bg-white border border-neutral-200 p-4 mb-4 text-left">
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
          {isRecovery ? <Truck className="h-4 w-4 text-amber-600" /> : <Truck className="h-4 w-4 text-emerald-600" />}
          <span className="uppercase tracking-wide text-[11px] font-medium">
            {isRecovery ? "Vehicle Recovery" : (isAsap ? "ASAP Transport" : "Scheduled Booking")}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <span className="truncate">{b.job?.pickup_town || "Pickup"}</span>
          <ArrowRight className="h-3 w-3 text-neutral-400" />
          <MapPin className="h-4 w-4 text-red-600" />
          <span className="truncate">{b.job?.dropoff_town || "Destination"}</span>
        </div>
        {(b.job?.recommended_vehicle || b.job?.vehicle_label) && (
          <div
            className="mt-2 flex items-center gap-2 text-sm text-neutral-700"
            data-testid="booking-confirmed-vehicle"
          >
            <Truck className="h-4 w-4 text-neutral-500" />
            <span className="text-neutral-500">
              {isRecovery ? "Recovery Vehicle" : "Suitable Vehicle"}:
            </span>
            <span className="font-medium">
              {b.job?.recommended_vehicle || b.job?.vehicle_label}
            </span>
          </div>
        )}
        <div className="mt-3 text-sm text-neutral-600">
          <span className="font-medium">£{Number(b.deposit_amount || 0).toFixed(2)}</span> deposit paid
          <span className="text-neutral-400 mx-2">·</span>
          <span>£{Number(b.balance_due || 0).toFixed(2)} due on delivery</span>
        </div>
      </div>
      <p className="text-xs text-neutral-400">Redirecting you to live dispatch…</p>
    </div>
  );
}
