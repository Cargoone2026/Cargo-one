import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, User, ShieldCheck, Navigation } from "lucide-react";
import { api } from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

/**
 * Customer-side dispatch screen — the "Finding a driver" / "Driver Found" /
 * "Driver Approaching" view for an ASAP job. Polls `/customer/dispatch/{id}`
 * until an `assigned_driver_id` appears; then reuses the existing tracking
 * infrastructure via the associated booking id.
 *
 * R18 — display-only upgrade: dark premium look with a layered ring pulse
 * and refined typography. Behaviour, polling, and every data-testid are
 * intentionally unchanged so downstream automation keeps working.
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
  const notReady = state && !state.dispatch_eligible && !state.assigned_driver_id && !cancelled;
  const loading = !state && !err;

  return (
    <div
      className="min-h-screen bg-[#0A0A0A] text-white"
      data-testid="customer-dispatch"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 pt-8 pb-8">
        <header className="mb-2">
          <h1 className="text-[36px] font-bold tracking-[-0.02em] leading-tight text-white sm:text-[44px]">
            Finding a driver
          </h1>
          <div className="mt-2 flex items-center gap-2 text-[15px] text-white/60">
            <span className="truncate">{state?.pickup_town || "…"}</span>
            <Navigation className="h-3.5 w-3.5 -rotate-45 shrink-0 text-white/40" />
            <span className="truncate">{state?.dropoff_town || "…"}</span>
          </div>
        </header>

        {/* Central stage — hero pin with concentric ripples */}
        <div className="flex flex-1 flex-col items-center justify-center py-12">
          {loading && (
            <div className="flex flex-col items-center text-center" data-testid="dispatch-loading">
              <PulsePin muted />
              <p className="mt-6 text-[15px] text-white/50">Loading dispatch status…</p>
            </div>
          )}

          {cancelled && (
            <div
              className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center"
              data-testid="dispatch-cancelled"
            >
              <p className="text-[15px] font-semibold text-red-300">
                This request was cancelled.
              </p>
            </div>
          )}

          {notReady && !cancelled && (
            <div
              className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center"
              data-testid="dispatch-not-ready"
            >
              <p className="text-[14px] text-amber-200">
                Waiting for payment confirmation before we broadcast to drivers…
              </p>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center text-center" data-testid="dispatch-searching">
              <PulsePin />
              <p className="mt-10 text-[24px] font-bold text-white">
                Looking for nearby drivers…
              </p>
              {state?.current_search_radius_miles ? (
                <div
                  className="mt-3 flex flex-col items-center gap-1"
                  data-testid="dispatch-radius-status"
                >
                  <p className="text-[14px] text-white/60">
                    Searching within{" "}
                    <strong className="text-white">
                      {state.current_search_radius_miles} miles
                    </strong>{" "}
                    · {state.drivers_notified_count || 0} driver
                    {(state.drivers_notified_count || 0) === 1 ? "" : "s"} notified
                  </p>
                  {state.next_radius_expansion_at ? (
                    <p className="text-[12px] text-white/40">
                      Widening the search {formatIn(state.next_radius_expansion_at)}
                    </p>
                  ) : (
                    <p className="text-[12px] text-white/40">
                      Search is nationwide — we'll never stop looking.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[14px] text-white/50">
                  This usually takes under 2 minutes.
                </p>
              )}
            </div>
          )}

          {state?.assigned_driver_id && (
            <div
              className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6"
              data-testid="dispatch-driver-found"
            >
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/20">
                  <User className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-white">
                    {state.assigned_driver_name}
                  </p>
                  <p className="text-[12px] text-white/60">
                    Rating {state.assigned_driver_rating || "5.0"}
                  </p>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[13px] text-white/70">
                <MapPin className="h-3.5 w-3.5" /> Driver is on their way to your pickup location.
              </p>
              <p className="mt-3 flex items-center gap-1 text-[12px] text-white/50">
                <ShieldCheck className="h-3 w-3" /> Redirecting to your booking…
              </p>
            </div>
          )}
        </div>

        {err && (
          <p
            className="mb-3 text-center text-[12px] text-red-400"
            data-testid="dispatch-error"
          >
            {err}
          </p>
        )}

        {searching && (
          <button
            type="button"
            onClick={() => navigate("/customer")}
            data-testid="dispatch-keep-waiting"
            className="mt-auto w-full rounded-full bg-[#EA580C] px-6 py-4 text-[16px] font-bold text-black shadow-[0_8px_24px_-8px_rgba(234,88,12,0.6)] transition-colors hover:bg-[#F97316] active:bg-[#C2410C]"
          >
            Keep waiting in the background
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * PulsePin — hero visual: orange pin surrounded by two concentric expanding
 * rings + a soft glow. Pure CSS/Tailwind, no external assets. `muted` fades
 * the whole element for loading / stopped states.
 */
function PulsePin({ muted = false }) {
  return (
    <div className={`relative flex items-center justify-center ${muted ? "opacity-40" : ""}`}>
      {/* Outer ripple */}
      <span className="absolute h-40 w-40 animate-ping rounded-full bg-[#EA580C]/20 [animation-duration:2.6s]" />
      {/* Inner ripple */}
      <span className="absolute h-28 w-28 animate-ping rounded-full bg-[#EA580C]/30 [animation-duration:2s]" />
      {/* Soft glow */}
      <span className="absolute h-32 w-32 rounded-full bg-[#EA580C]/15 blur-2xl" />
      {/* Core pin */}
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
