import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Zap, MapPin, Truck, AlertTriangle, ShieldCheck, Loader2, PowerOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { RouteMap } from "@/components/ui-portal/RouteMap";

const HEARTBEAT_INTERVAL_MS = 30000;   // send position every 30s
const OFFER_POLL_INTERVAL_MS = 5000;   // poll for offers every 5s

/**
 * CargoOne — Driver Live Mode.
 *
 * Map-first, honest privacy story. Location is only collected while the
 * driver is deliberately ONLINE. Going offline stops the heartbeat and
 * clears server-side location. Offers are polled every 5 s; a single tap
 * on the first offer atomically claims the job.
 */
export default function DriverLive() {
  const [online, setOnline] = useState(false);
  const [status, setStatus] = useState(null);
  const [offers, setOffers] = useState([]);
  const [offersReason, setOffersReason] = useState(null);
  const [locError, setLocError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const positionRef = useRef(null);

  const readOwnStatus = useCallback(async () => {
    try {
      const s = await api("/driver/live/status");
      setStatus(s);
      setOnline(!!s.live_online);
    } catch (e) {
      setErr(e?.message || "Could not read status");
    }
  }, []);

  const getPosition = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude,
                         accuracy_m: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? "Location permission denied" : "GPS unavailable")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }), []);

  const goOnline = useCallback(async () => {
    setBusy(true);
    setLocError(null);
    setErr(null);
    try {
      const pos = await getPosition();
      positionRef.current = pos;
      const r = await api("/driver/live/online", { method: "POST", body: pos });
      setOnline(true);
      setStatus({ ...status, live_online: true, live_lat: pos.lat, live_lng: pos.lng });
    } catch (e) {
      setLocError(e.message || "Could not go online");
    } finally {
      setBusy(false);
    }
  }, [getPosition, status]);

  const goOffline = useCallback(async () => {
    setBusy(true);
    try {
      await api("/driver/live/offline", { method: "POST" });
      setOnline(false);
      setOffers([]);
      setOffersReason(null);
      setStatus({ ...status, live_online: false });
    } catch (e) {
      setErr(e?.message || "Could not go offline");
    } finally {
      setBusy(false);
    }
  }, [status]);

  // Read initial status on mount.
  useEffect(() => { readOwnStatus(); }, [readOwnStatus]);

  // Heartbeat + offer poll while online.
  useEffect(() => {
    if (!online) return () => {};
    let alive = true;
    let hbTimer = null;
    let offerTimer = null;
    async function heartbeatOnce() {
      try {
        const pos = await getPosition();
        positionRef.current = pos;
        await api("/driver/live/heartbeat", { method: "POST", body: pos });
      } catch (e) {
        setLocError(e.message);
      } finally {
        if (alive) hbTimer = setTimeout(heartbeatOnce, HEARTBEAT_INTERVAL_MS);
      }
    }
    async function offersOnce() {
      try {
        const r = await api("/driver/live/offers");
        if (!alive) return;
        setOffers(r.offers || []);
        setOffersReason(r.reason || null);
      } catch (e) {
        // silent — polling errors shouldn't blast the UI
      } finally {
        if (alive) offerTimer = setTimeout(offersOnce, OFFER_POLL_INTERVAL_MS);
      }
    }
    heartbeatOnce();
    offersOnce();
    return () => {
      alive = false;
      if (hbTimer) clearTimeout(hbTimer);
      if (offerTimer) clearTimeout(offerTimer);
    };
  }, [online, getPosition]);

  const claimOffer = useCallback(async (offer) => {
    setClaiming(offer.job_id);
    setErr(null);
    try {
      await api(`/jobs/${offer.job_id}/claim`, { method: "POST" });
      // Redirect to the driver's existing job/booking detail page.
      // BookingDetail is auto-discovered via bookings/mine.
      try {
        const mine = await api("/bookings/mine");
        const match = (mine || []).find((b) => b.job_id === offer.job_id);
        if (match) {
          window.location.href = `/driver/booking/${match.id}`;
          return;
        }
      } catch { /* fall through */ }
      window.location.href = `/driver/job/${offer.job_id}`;
    } catch (e) {
      const msg = e?.message || "Could not claim";
      if (/409/.test(msg) || /already claimed/i.test(msg)) {
        setErr("Another driver just took this job.");
        // Refresh offers immediately.
        try {
          const r = await api("/driver/live/offers");
          setOffers(r.offers || []);
        } catch { /* ignore */ }
      } else {
        setErr(msg);
      }
    } finally {
      setClaiming(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50" data-testid="driver-live">
      <div className="mx-auto max-w-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Live Mode
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {online ? "You're online — nearby jobs will appear below." : "Go online to receive nearby CargoOne jobs."}
            </p>
          </div>
          {online ? (
            <Button variant="secondary" onClick={goOffline} disabled={busy}
              data-testid="driver-live-go-offline">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PowerOff className="h-4 w-4 mr-2" />}
              Go offline
            </Button>
          ) : (
            <Button onClick={goOnline} disabled={busy} data-testid="driver-live-go-online">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Go online
            </Button>
          )}
        </div>

        <p className="text-xs text-neutral-500 mb-4 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Your live location is only used while you're online. Going offline clears it.
        </p>

        {locError && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-800" data-testid="driver-live-loc-error">
            {locError}
          </div>
        )}

        {online && offers.length === 0 && (
          <div className="rounded-2xl bg-white border border-neutral-200 p-6 text-center" data-testid="driver-live-searching">
            <div className="relative w-16 h-16 mx-auto mb-3">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-sm font-medium">Looking for nearby jobs…</p>
            {offersReason === "stale_location" && (
              <p className="text-xs text-neutral-500 mt-1">Waiting for a fresh GPS fix.</p>
            )}
            {offersReason === "busy_on_asap" && (
              <p className="text-xs text-neutral-500 mt-1">You're already on an active ASAP job.</p>
            )}
          </div>
        )}

        <ul className="space-y-3">
          {offers.map((o) => (
            <li key={o.job_id}>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4" data-testid={`driver-live-offer-${o.job_id}`}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Driver earnings</div>
                  <div className="text-2xl font-semibold">£{o.accepted_price}</div>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  {o.service_type === "breakdown_recovery" ? (
                    <><AlertTriangle className="h-4 w-4 text-amber-600" /> ASAP Vehicle Recovery</>
                  ) : (
                    <><Truck className="h-4 w-4 text-neutral-700" /> ASAP Transport</>
                  )}
                </div>
                <p className="text-sm text-neutral-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-emerald-600" />
                  {o.pickup_town} · {o.distance_to_pickup_miles} mi away
                </p>
                <p className="text-sm text-neutral-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-red-600" />
                  {o.dropoff_town} · {o.distance_miles} mi total
                </p>
                {o.vehicle_details && (
                  <div className="mt-2 text-xs text-neutral-600">
                    {o.vehicle_details.make} {o.vehicle_details.model} — {(o.vehicle_details.condition || "").replace(/_/g, " ")}
                  </div>
                )}
                {o.customer_note && (
                  <div className="mt-1 text-xs italic text-neutral-500">"{o.customer_note}"</div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => claimOffer(o)}
                    disabled={claiming === o.job_id}
                    className="flex-1"
                    data-testid={`driver-live-accept-${o.job_id}`}>
                    {claiming === o.job_id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Accept £{o.accepted_price}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {err && (
          <p className="text-sm text-red-600 mt-4" data-testid="driver-live-error">{err}</p>
        )}
      </div>
    </div>
  );
}
