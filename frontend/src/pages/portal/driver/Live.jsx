import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Zap, MapPin, Truck, AlertTriangle, ShieldCheck, Loader2, PowerOff,
  Signal, Radio, Search, Clock, PoundSterling, Package,
} from "lucide-react";

function formatDuration(secs) {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { DriverLiveMap } from "@/components/ui-portal/DriverLiveMap";
import { AcceptanceInfo } from "@/components/ui-portal/AcceptanceInfo";

const HEARTBEAT_INTERVAL_MS = 30000;   // send position every 30s
const OFFER_POLL_INTERVAL_MS = 5000;   // poll for offers every 5s
const OFFER_COUNTDOWN_SECONDS = 60;    // visual auto-decline hint per offer

function OfferCountdown({ readyAt }) {
  const [left, setLeft] = React.useState(() => {
    try {
      const t0 = readyAt ? new Date(readyAt).getTime() : Date.now();
      return Math.max(0, OFFER_COUNTDOWN_SECONDS - Math.floor((Date.now() - t0) / 1000));
    } catch { return OFFER_COUNTDOWN_SECONDS; }
  });
  useEffect(() => {
    if (left <= 0) return () => {};
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"
      data-testid="driver-live-offer-countdown">
      {left}s
    </span>
  );
}

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
  const [town, setTown] = useState(null);
  const [todayStats, setTodayStats] = useState({ jobs: 0, earnings: 0 });
  const [sessionSecs, setSessionSecs] = useState(0);
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

  const [missedToast, setMissedToast] = useState(null);

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
      // Round 8 — Missed-Offer Toast. Surface the count returned by the
      // /online endpoint so the driver knows what they might have missed
      // while offline. Auto-dismiss after 8 s; a manual close is also
      // available so the driver can dispatch it themselves.
      const missed = Number(r?.missed_offers_count || 0);
      if (missed > 0) {
        setMissedToast(missed);
        setTimeout(() => setMissedToast((v) => (v === missed ? null : v)), 8000);
      }
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

  // Live session-timer while online. Uses `live_online_since` from /status
  // so it survives refresh/navigation without any additional API calls.
  useEffect(() => {
    if (!online || !status?.live_online_since) { setSessionSecs(0); return () => {}; }
    let start = 0;
    try { start = new Date(status.live_online_since).getTime(); }
    catch { start = Date.now(); }
    const tick = () => setSessionSecs(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [online, status?.live_online_since]);

  // One-shot today's earnings/jobs when the driver goes online. No new
  // polling loop — this fires once per online transition.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      try {
        const mine = await api("/bookings/mine");
        if (cancelled || !Array.isArray(mine)) return;
        const today = new Date().toISOString().slice(0, 10);
        const todays = mine.filter((b) => (b?.paid_at || b?.created_at || "").startsWith(today));
        const earnings = todays
          .filter((b) => b?.payment_status === "paid")
          .reduce((sum, b) => sum + Number(b?.driver_charge || 0), 0);
        setTodayStats({ jobs: todays.length, earnings: Math.round(earnings) });
      } catch { /* silent — non-critical UI stat */ }
    })();
    return () => { cancelled = true; };
  }, [online]);

  // Reverse geocode the driver's current position → town name for the
  // idle dashboard. Uses the browser Google Maps SDK already loaded by
  // RouteMap. Zero backend calls.
  useEffect(() => {
    if (!online || !status?.live_lat || !status?.live_lng) return () => {};
    let alive = true;
    try {
      const g = window?.google?.maps;
      if (!g?.Geocoder) return () => {};
      const geocoder = new g.Geocoder();
      geocoder.geocode(
        { location: { lat: status.live_lat, lng: status.live_lng } },
        (results, s) => {
          if (!alive || s !== "OK" || !results?.[0]) return;
          const comp = (results[0].address_components || []).find(
            (c) => c.types.includes("postal_town") || c.types.includes("locality"),
          );
          if (comp) setTown(comp.long_name);
        },
      );
    } catch { /* ignore — town display is best-effort */ }
    return () => { alive = false; };
  }, [online, status?.live_lat, status?.live_lng]);

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
        {/* Round 8 — subtle "you missed N offers" banner surfaced by the
           /driver/live/online response. Auto-dismisses after 8 s; the driver
           can also close it themselves. */}
        {missedToast ? (
          <div
            role="status"
            data-testid="missed-offers-toast"
            className="mb-3 flex items-center gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 shadow-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Zap className="h-4 w-4 text-amber-600" />
            </span>
            <span className="min-w-0 flex-1">
              <strong>You missed {missedToast} offer{missedToast === 1 ? "" : "s"} while offline.</strong>
              {" "}
              <span className="text-amber-800/80">Fresh offers will appear below.</span>
            </span>
            <button
              type="button"
              onClick={() => setMissedToast(null)}
              data-testid="missed-offers-toast-dismiss"
              className="rounded-full px-2 py-1 text-[12px] font-semibold text-amber-900 hover:bg-amber-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ) : null}
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
          <div
            className="rounded-2xl bg-white border border-neutral-200 p-4 mb-4"
            data-testid="driver-live-idle-dashboard"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <MapPin className="h-4 w-4 text-neutral-500" />
                <span data-testid="driver-live-town">
                  {town || "Locating you…"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-xl bg-neutral-50 border border-neutral-100 p-3"
                data-testid="driver-live-stat-time"
              >
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
                  <Clock className="h-3 w-3" /> Time online
                </div>
                <div className="text-xl font-semibold tabular-nums">
                  {formatDuration(sessionSecs)}
                </div>
              </div>
              <div
                className="rounded-xl bg-neutral-50 border border-neutral-100 p-3"
                data-testid="driver-live-stat-jobs"
              >
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
                  <Package className="h-3 w-3" /> Today's jobs
                </div>
                <div className="text-xl font-semibold tabular-nums">
                  {todayStats.jobs}
                </div>
              </div>
              <div
                className="rounded-xl bg-neutral-50 border border-neutral-100 p-3"
                data-testid="driver-live-stat-earnings"
              >
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
                  <PoundSterling className="h-3 w-3" /> Today's earnings
                </div>
                <div className="text-xl font-semibold tabular-nums">
                  £{todayStats.earnings}
                </div>
              </div>
            </div>

            <div
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600"
              data-testid="driver-live-status-panel"
            >
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Online
              </span>
              <span className="inline-flex items-center gap-1">
                <Signal className="h-3 w-3 text-emerald-600" /> GPS connected
              </span>
              <span className="inline-flex items-center gap-1">
                <Radio className="h-3 w-3 text-emerald-600" /> Dispatch ready
              </span>
              <span className="inline-flex items-center gap-1 text-neutral-500">
                <Search className="h-3 w-3" /> Searching for nearby jobs…
              </span>
            </div>
          </div>
        )}

        {online && (
          <div className="rounded-2xl bg-white border border-neutral-200 overflow-hidden mb-4" data-testid="driver-live-searching">
            {/* Live map — always visible while online. Shows the driver's
                own position with radar-pulses; when ASAP offers arrive it
                plots each pickup as a labelled £-pin so the driver can
                gauge distance/direction before tapping Accept below. */}
            {status?.live_lat && status?.live_lng ? (
              <DriverLiveMap
                lat={status.live_lat}
                lng={status.live_lng}
                offers={offers}
                onOfferClick={(o) => {
                  const el = document.getElementById(`driver-live-offer-card-${o.job_id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="h-72 sm:h-96"
                showSweep
              />
            ) : (
              <div className="h-72 sm:h-96 relative bg-gradient-to-br from-emerald-50 via-white to-neutral-100">
                <div className="absolute inset-0 driverlive-radar-grid" aria-hidden="true" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur-sm">
                    Locating you…
                  </p>
                </div>
              </div>
            )}
            <div className="border-t border-neutral-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="font-medium">
                  {offers.length === 0
                    ? "Looking for nearby jobs…"
                    : `${offers.length} nearby ASAP offer${offers.length > 1 ? "s" : ""} — tap a pin to review`}
                </span>
              </div>
              {offersReason === "stale_location" && (
                <span className="text-xs text-amber-700">Waiting for GPS fix</span>
              )}
              {offersReason === "busy_on_asap" && offers.length === 0 && (
                <span className="text-xs text-neutral-500">On an active ASAP job</span>
              )}
            </div>
          </div>
        )}

        <ul className="space-y-3">
          {offers.map((o) => (
            <li
              key={o.job_id}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div id={`driver-live-offer-card-${o.job_id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 scroll-mt-4" data-testid={`driver-live-offer-${o.job_id}`}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Driver earnings</div>
                  <div className="flex items-baseline gap-2">
                    <OfferCountdown readyAt={o.dispatch_ready_at} />
                    <div className="text-2xl font-semibold">£{o.accepted_price}</div>
                  </div>
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
                  <span className="min-w-0 truncate">
                    {o.pickup_address || o.pickup_town} · {o.distance_to_pickup_miles} mi away
                  </span>
                </p>
                <p className="text-sm text-neutral-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-red-600" />
                  <span className="min-w-0 truncate">
                    {o.dropoff_address || o.dropoff_town} · {o.distance_miles} mi trip
                    {o.duration_minutes ? ` · ~${Math.round(o.duration_minutes)} min` : ""}
                  </span>
                </p>
                {/* Round 7 — always show Suitable Vehicle + Transport Item
                   / Recovery details before the driver taps Accept. */}
                <div className="mt-3">
                  <AcceptanceInfo
                    job={o}
                    dense
                    testIdPrefix={`live-offer-accept-${o.job_id}`}
                  />
                </div>
                {/* Customer photos strip — same info the offer card shows */}
                {Array.isArray(o.photos) && o.photos.length > 0 && (
                  <div
                    className="mt-2 flex items-center gap-2 overflow-x-auto pb-1"
                    data-testid={`live-offer-photos-${o.job_id}`}
                  >
                    {o.photos.slice(0, 4).map((p, i) => (
                      <img
                        key={i}
                        src={p}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover border border-neutral-200"
                      />
                    ))}
                    {o.photos.length > 4 && (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-600">
                        +{o.photos.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {o.customer_note && (
                  <div className="mt-2 text-xs italic text-neutral-500">"{o.customer_note}"</div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setOffers((prev) => prev.filter((x) => x.job_id !== o.job_id))}
                    disabled={claiming === o.job_id}
                    className="flex-1"
                    data-testid={`driver-live-decline-${o.job_id}`}
                  >
                    Decline
                  </Button>
                  <Button onClick={() => claimOffer(o)}
                    disabled={claiming === o.job_id}
                    className="flex-1"
                    data-testid={`driver-live-accept-${o.job_id}`}>
                    {claiming === o.job_id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Accept · £{o.accepted_price}
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
