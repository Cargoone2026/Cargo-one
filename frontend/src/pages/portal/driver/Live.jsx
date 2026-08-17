import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Zap, MapPin, Truck, AlertTriangle, ShieldCheck, Loader2, PowerOff,
  Clock, PoundSterling, Package, Bell, List, X, ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { AcceptanceInfo } from "@/components/ui-portal/AcceptanceInfo";
import {
  AsapMapCanvas,
  AsapTopStatusPill,
  AsapFloatingControls,
  AsapBottomSheet,
} from "@/components/asap-uber";

/**
 * DriverLive — CargoOne ASAP Live Mode (Uber-style, map-first).
 *
 * The visual/interaction layer for the driver's ASAP experience:
 *   • Full-screen live map
 *   • Top pill: online state + today's earnings + jobs count
 *   • Right-side floating controls (list / notifications)
 *   • Bottom sheet: draggable — peek/half/full snap points
 *   • Snap auto-expands to `half` when a new ASAP offer arrives
 *
 * All CargoOne business logic (heartbeat, offer polling, contact
 * privacy, claim, dispatch fairness, cancellation, pricing) is
 * unchanged — this file consumes the same endpoints the classic
 * `LiveClassic.jsx` did. Rolling back is one import swap in `App.js`.
 *
 * Preserves (do NOT change):
 *   • GET  /driver/live/status
 *   • POST /driver/live/online   (returns missed_offers_count)
 *   • POST /driver/live/offline
 *   • POST /driver/live/heartbeat
 *   • GET  /driver/live/offers   (5s poll)
 *   • POST /jobs/{id}/claim
 *   • R37 contact-privacy — driver only sees customer contact AFTER claim
 *   • R34 offer ordering — newest first (dispatch_ready_at DESC)
 */

const HEARTBEAT_INTERVAL_MS = 30000;
const OFFER_POLL_INTERVAL_MS = 5000;
const OFFER_COUNTDOWN_SECONDS = 60;

function formatDuration(secs) {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

function OfferCountdown({ readyAt }) {
  const [left, setLeft] = useState(() => {
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
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
      data-testid="driver-live-offer-countdown"
    >
      <Clock className="h-3 w-3" />{left}s
    </span>
  );
}

/** Compact card rendered inside the bottom sheet for each nearby ASAP offer. */
function OfferCard({ offer, onAccept, onDecline, claiming }) {
  const isRecovery = offer.service_type === "breakdown_recovery";
  return (
    <div
      id={`driver-live-offer-card-${offer.job_id}`}
      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-300"
      data-testid={`driver-live-offer-${offer.job_id}`}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          {isRecovery ? (
            <><AlertTriangle className="h-4 w-4 text-amber-600" /> ASAP Vehicle Recovery</>
          ) : (
            <><Truck className="h-4 w-4 text-neutral-800" /> ASAP Transport</>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <OfferCountdown readyAt={offer.dispatch_ready_at} />
          <div className="text-[22px] font-bold tracking-tight">£{offer.accepted_price}</div>
        </div>
      </div>
      <p className="flex items-center gap-1 text-[13px] text-neutral-700">
        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
        <span className="min-w-0 truncate">
          {offer.pickup_address || offer.pickup_town}
          <span className="ml-1 text-neutral-500">· {offer.distance_to_pickup_miles} mi away</span>
        </span>
      </p>
      <p className="flex items-center gap-1 text-[13px] text-neutral-700">
        <MapPin className="h-3.5 w-3.5 text-red-600" />
        <span className="min-w-0 truncate">
          {offer.dropoff_address || offer.dropoff_town}
          <span className="ml-1 text-neutral-500">
            · {offer.distance_miles} mi trip
            {offer.duration_minutes ? ` · ~${Math.round(offer.duration_minutes)} min` : ""}
          </span>
        </span>
      </p>
      <div className="mt-3">
        <AcceptanceInfo job={offer} dense testIdPrefix={`live-offer-accept-${offer.job_id}`} />
      </div>
      {Array.isArray(offer.photos) && offer.photos.length > 0 && (
        <div
          className="mt-2 flex items-center gap-2 overflow-x-auto pb-1"
          data-testid={`live-offer-photos-${offer.job_id}`}
        >
          {offer.photos.slice(0, 4).map((p, i) => (
            <img key={i} src={p} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-neutral-200 object-cover" />
          ))}
          {offer.photos.length > 4 && (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-600">
              +{offer.photos.length - 4}
            </span>
          )}
        </div>
      )}
      {offer.customer_note && (
        <div className="mt-2 text-xs italic text-neutral-500">"{offer.customer_note}"</div>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          onClick={() => onDecline(offer)}
          disabled={claiming === offer.job_id}
          className="flex-1"
          data-testid={`driver-live-decline-${offer.job_id}`}
        >
          Decline
        </Button>
        <Button
          onClick={() => onAccept(offer)}
          disabled={claiming === offer.job_id}
          className="flex-1"
          data-testid={`driver-live-accept-${offer.job_id}`}
        >
          {claiming === offer.job_id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Accept · £{offer.accepted_price}
        </Button>
      </div>
    </div>
  );
}

/** Idle-when-online body: today's stats + reassurance. */
function OnlineIdleBody({ town, sessionSecs, todayStats, offersReason }) {
  return (
    <div className="space-y-4 pt-2" data-testid="driver-live-idle-dashboard">
      <div className="flex items-center gap-2 text-[13px] text-neutral-700">
        <MapPin className="h-4 w-4 text-neutral-500" />
        <span className="truncate" data-testid="driver-live-town">
          {town || "Locating you…"}
        </span>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
        <p className="text-[15px] font-semibold text-neutral-900">Looking for nearby ASAP jobs…</p>
        <p className="mt-1 text-[13px] text-neutral-500">
          We'll surface the freshest jobs in your area the instant they land.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-3" data-testid="driver-live-stat-time">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
            <Clock className="h-3 w-3" /> Online
          </div>
          <div className="text-[16px] font-semibold tabular-nums">{formatDuration(sessionSecs)}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3" data-testid="driver-live-stat-jobs">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
            <Package className="h-3 w-3" /> Jobs
          </div>
          <div className="text-[16px] font-semibold tabular-nums">{todayStats.jobs}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3" data-testid="driver-live-stat-earnings">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.6px] text-neutral-500">
            <PoundSterling className="h-3 w-3" /> Earnings
          </div>
          <div className="text-[16px] font-semibold tabular-nums">£{todayStats.earnings}</div>
        </div>
      </div>

      {offersReason === "busy_on_asap" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          You're currently on an active ASAP job — new offers pause until it's completed.
        </div>
      ) : null}
      {offersReason === "stale_location" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          Waiting for a fresh GPS fix — new offers will resume once we have it.
        </div>
      ) : null}

      <p className="flex items-center gap-1 text-[11px] text-neutral-500">
        <ShieldCheck className="h-3 w-3" />
        Your live location is only used while you're online.
      </p>
    </div>
  );
}

/** Offline body: Go online CTA + last known session/earnings summary. */
function OfflineBody({ onGoOnline, busy, locError }) {
  return (
    <div className="space-y-4 pt-2" data-testid="driver-live-offline-body">
      <div>
        <p className="text-[16px] font-semibold text-neutral-900">You're offline</p>
        <p className="mt-1 text-[13px] text-neutral-500">
          Go online to receive nearby CargoOne ASAP jobs. Your location is only used while online.
        </p>
      </div>
      {locError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-800" data-testid="driver-live-loc-error">
          {locError}
        </div>
      ) : null}
      <Button
        onClick={onGoOnline}
        disabled={busy}
        className="w-full h-12 text-[15px] font-semibold"
        data-testid="driver-live-go-online"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
        Go online
      </Button>
      <p className="flex items-center gap-1 text-[11px] text-neutral-500">
        <ShieldCheck className="h-3 w-3" />
        Contact details of customers are only released after you accept a job.
      </p>
    </div>
  );
}

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
  const [missedToast, setMissedToast] = useState(null);
  const [sheetSnap, setSheetSnap] = useState("peek");
  const positionRef = useRef(null);
  const priorOfferCountRef = useRef(0);

  // R34 — newest ASAP offers first (dispatch_ready_at DESC).
  const sortedOffers = useMemo(() => {
    const arr = [...offers];
    arr.sort((a, b) => {
      const ta = a?.dispatch_ready_at ? String(a.dispatch_ready_at) : "";
      const tb = b?.dispatch_ready_at ? String(b.dispatch_ready_at) : "";
      if (tb !== ta) return tb < ta ? -1 : 1;
      const ia = String(a?.job_id || "");
      const ib = String(b?.job_id || "");
      return ib < ia ? -1 : ib > ia ? 1 : 0;
    });
    return arr;
  }, [offers]);

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
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy }),
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
      setStatus((prev) => ({ ...(prev || {}), live_online: true, live_lat: pos.lat, live_lng: pos.lng }));
      const missed = Number(r?.missed_offers_count || 0);
      if (missed > 0) {
        setMissedToast(missed);
        setTimeout(() => setMissedToast((v) => (v === missed ? null : v)), 8000);
      }
      setSheetSnap("peek");
    } catch (e) {
      setLocError(e.message || "Could not go online");
    } finally {
      setBusy(false);
    }
  }, [getPosition]);

  const goOffline = useCallback(async () => {
    setBusy(true);
    try {
      await api("/driver/live/offline", { method: "POST" });
      setOnline(false);
      setOffers([]);
      setOffersReason(null);
      setStatus((prev) => ({ ...(prev || {}), live_online: false }));
      setSheetSnap("peek");
    } catch (e) {
      setErr(e?.message || "Could not go offline");
    } finally {
      setBusy(false);
    }
  }, []);

  // Initial status.
  useEffect(() => { readOwnStatus(); }, [readOwnStatus]);

  // Session timer.
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

  // Today's earnings/jobs (fires once per online transition).
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
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [online]);

  // Reverse geocode town — best-effort.
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
    } catch { /* ignore */ }
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
      } catch { /* silent */ }
      finally {
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

  // Auto-expand the bottom sheet when a new offer arrives so the driver
  // sees the accept CTA without an extra tap. Skips if the sheet is
  // already at full (driver is actively browsing).
  useEffect(() => {
    const prev = priorOfferCountRef.current;
    priorOfferCountRef.current = offers.length;
    if (offers.length > prev && sheetSnap !== "full") {
      setSheetSnap("half");
    }
    // Auto-shrink back to peek only when the LAST offer disappears
    // (i.e. we previously had offers and now have none). We deliberately
    // do NOT collapse when the driver has manually expanded the sheet
    // with no offers on screen — that would fight their intent.
    if (offers.length === 0 && prev > 0 && sheetSnap === "half") {
      setSheetSnap("peek");
    }
  }, [offers.length, sheetSnap]);

  const claimOffer = useCallback(async (offer) => {
    setClaiming(offer.job_id);
    setErr(null);
    try {
      await api(`/jobs/${offer.job_id}/claim`, { method: "POST" });
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

  const declineOffer = useCallback((offer) => {
    setOffers((prev) => prev.filter((x) => x.job_id !== offer.job_id));
  }, []);

  const focusOffer = useCallback((offer) => {
    setSheetSnap("half");
    setTimeout(() => {
      const el = document.getElementById(`driver-live-offer-card-${offer.job_id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 220);
  }, []);

  // Viewer point for the map: driver's live position when online, else
  // the last-known live_lat/live_lng from /status so the offline surface
  // still shows something recognisable.
  const viewer = useMemo(() => {
    const lat = Number(status?.live_lat);
    const lng = Number(status?.live_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [status?.live_lat, status?.live_lng]);

  // Build the top-pill content based on state.
  const topPill = useMemo(() => {
    if (!online) {
      return {
        icon: PowerOff,
        left: "Offline",
        main: null,
        right: null,
        variant: "muted",
        pulse: false,
      };
    }
    const hasOffers = offers.length > 0;
    return {
      icon: Zap,
      left: hasOffers ? `${offers.length} nearby` : "Online",
      main: `£${todayStats.earnings}`,
      right: `${todayStats.jobs} jobs`,
      variant: "dark",
      pulse: true,
    };
  }, [online, offers.length, todayStats]);

  return (
    <div
      className="relative w-full bg-neutral-900"
      style={{ height: "calc(100dvh - 72px)", minHeight: 560 }}
      data-testid="driver-live"
    >
      {/* Map layer (behind everything) */}
      <AsapMapCanvas
        viewer={online ? viewer : null}
        offers={online ? sortedOffers : []}
        onOfferClick={focusOffer}
        showSweep={online}
        data-testid="driver-live-map"
      />

      {/* Top pill row */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-2 px-3">
        <AsapTopStatusPill
          icon={topPill.icon}
          left={topPill.left}
          main={topPill.main}
          right={topPill.right}
          variant={topPill.variant}
          pulse={topPill.pulse}
          data-testid="driver-live-status-pill"
        />
        {missedToast ? (
          <div
            role="status"
            data-testid="missed-offers-toast"
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[12px] text-amber-900 shadow-md backdrop-blur"
          >
            <Zap className="h-3.5 w-3.5 text-amber-600" />
            <span className="min-w-0 flex-1">
              You missed <strong>{missedToast}</strong> offer{missedToast === 1 ? "" : "s"} while offline.
            </span>
            <button
              type="button"
              onClick={() => setMissedToast(null)}
              data-testid="missed-offers-toast-dismiss"
              aria-label="Dismiss"
              className="rounded-full p-0.5 hover:bg-amber-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Floating controls (right side) */}
      <div className="absolute inset-y-0 right-0 z-20 flex flex-col justify-center">
        <AsapFloatingControls
          buttons={[
            {
              id: "list",
              icon: sheetSnap === "full" ? ChevronUp : List,
              label: sheetSnap === "full" ? "Collapse list" : "Expand list",
              onClick: () => setSheetSnap(sheetSnap === "full" ? "peek" : "full"),
              testId: "driver-live-fab-list",
              active: sheetSnap === "full",
            },
            {
              id: "notif",
              icon: Bell,
              label: "Notifications",
              badge: offers.length || null,
              onClick: () => setSheetSnap("half"),
              testId: "driver-live-fab-notif",
            },
            online ? {
              id: "offline",
              icon: PowerOff,
              label: "Go offline",
              onClick: goOffline,
              disabled: busy,
              variant: "danger",
              testId: "driver-live-fab-go-offline",
            } : null,
          ].filter(Boolean)}
          data-testid="driver-live-floating-controls"
        />
      </div>

      {/* Bottom sheet */}
      <AsapBottomSheet
        snap={sheetSnap}
        onSnapChange={setSheetSnap}
        sheetTestId="driver-live-sheet"
        header={
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {online ? (
                <>
                  <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="min-w-0 truncate text-[14px] font-semibold text-neutral-900">
                    {offers.length === 0
                      ? "Looking for nearby jobs…"
                      : `${offers.length} nearby ASAP offer${offers.length > 1 ? "s" : ""}`}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-neutral-400" aria-hidden="true" />
                  <span className="min-w-0 truncate text-[14px] font-semibold text-neutral-900">
                    You're offline
                  </span>
                </>
              )}
            </div>
            {online ? (
              <span className="text-[11px] text-neutral-500 tabular-nums">
                {formatDuration(sessionSecs)}
              </span>
            ) : null}
          </div>
        }
      >
        {!online ? (
          <OfflineBody onGoOnline={goOnline} busy={busy} locError={locError} />
        ) : offers.length === 0 ? (
          <OnlineIdleBody
            town={town}
            sessionSecs={sessionSecs}
            todayStats={todayStats}
            offersReason={offersReason}
          />
        ) : (
          <ul className="space-y-3 pt-2" data-testid="driver-live-offers-list">
            {sortedOffers.map((o) => (
              <li key={o.job_id}>
                <OfferCard
                  offer={o}
                  onAccept={claimOffer}
                  onDecline={declineOffer}
                  claiming={claiming}
                />
              </li>
            ))}
          </ul>
        )}
        {err ? (
          <p className="mt-3 text-sm text-red-600" data-testid="driver-live-error">{err}</p>
        ) : null}
      </AsapBottomSheet>
    </div>
  );
}
