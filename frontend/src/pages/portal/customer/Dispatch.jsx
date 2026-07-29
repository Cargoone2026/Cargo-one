import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Radar, User, Phone, MapPin, ShieldCheck, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { RouteMap } from "@/components/ui-portal/RouteMap";
import { Button } from "@/components/ui-portal/Button";

const POLL_INTERVAL_MS = 4000;

/**
 * Customer-side dispatch screen — the "Finding a driver" / "Driver Found" /
 * "Driver Approaching" view for an ASAP job. Polls `/customer/dispatch/{id}`
 * until an `assigned_driver_id` appears; then reuses the existing tracking
 * infrastructure via the associated booking id.
 */
export default function CustomerDispatch() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    let timer = null;
    async function poll() {
      try {
        const s = await api(`/customer/dispatch/${jobId}`);
        if (!alive) return;
        setState(s);
        // Once a driver is assigned, the existing BookingDetail page owns
        // approach + tracking UX. We navigate there.
        if (s.assigned_driver_id) {
          try {
            const bookings = await api("/bookings/mine");
            const match = (bookings || []).find((b) => b.job_id === jobId);
            if (match) {
              navigate(`/customer/booking/${match.id}`);
              return;
            }
          } catch { /* fall through — keep polling */ }
        }
      } catch (e) {
        setErr(e?.message || "Could not read dispatch state");
      } finally {
        if (alive) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    poll();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [jobId, navigate]);

  const cancelled = state?.cancelled_at;
  const searching = state?.dispatch_eligible && !state?.assigned_driver_id;
  const notReady = !state?.dispatch_eligible && !state?.assigned_driver_id && !cancelled;

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="customer-dispatch">
      <div className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Finding a driver</h1>
        <p className="text-sm text-neutral-500 mb-6">
          {state?.pickup_town} → {state?.dropoff_town}
        </p>

        {cancelled && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 mb-4" data-testid="dispatch-cancelled">
            <p className="text-sm font-medium text-red-800">This request was cancelled.</p>
          </div>
        )}

        {notReady && !cancelled && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-4" data-testid="dispatch-not-ready">
            <p className="text-sm text-amber-900">Waiting for payment confirmation before we broadcast to drivers…</p>
          </div>
        )}

        {searching && (
          <div className="rounded-2xl bg-white border border-neutral-200 p-6 mb-4 flex flex-col items-center text-center" data-testid="dispatch-searching">
            <div className="relative w-24 h-24 mb-4">
              <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-amber-200 animate-pulse" />
              <Radar className="absolute inset-0 m-auto h-8 w-8 text-amber-600" />
            </div>
            <p className="text-lg font-medium">Looking for nearby drivers…</p>
            <p className="text-sm text-neutral-500 mt-1">This usually takes under 2 minutes.</p>
          </div>
        )}

        {state?.assigned_driver_id && (
          <div className="rounded-2xl bg-white border border-emerald-200 p-6 mb-4" data-testid="dispatch-driver-found">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <User className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="font-semibold">{state.assigned_driver_name}</p>
                <p className="text-xs text-neutral-500">Rating {state.assigned_driver_rating || "5.0"}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 flex items-center gap-1 mt-2">
              <MapPin className="h-3 w-3" /> Driver is on their way to your pickup location.
            </p>
            <p className="text-xs text-neutral-500 mt-3 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Redirecting to your booking…
            </p>
          </div>
        )}

        {err && (
          <p className="text-xs text-red-600 mb-3" data-testid="dispatch-error">{err}</p>
        )}

        {searching && (
          <Button variant="secondary" onClick={() => navigate("/customer")} className="w-full" data-testid="dispatch-keep-waiting">
            Keep waiting in the background
          </Button>
        )}
      </div>
    </div>
  );
}
