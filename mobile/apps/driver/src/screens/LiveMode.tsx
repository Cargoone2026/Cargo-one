/**
 * LiveModeScreen — Cargo One Driver ASAP Live Mode.
 *
 * Faithful port of the web page (frontend/src/pages/portal/driver/Live.jsx)
 * to React Native. Preserves the exact business rules the web/backend
 * already enforce; NO new server behaviour is invented.
 *
 * Endpoints (all pre-existing, add-only wrappers in DriverAPI):
 *   • GET  /driver/live/status
 *   • POST /driver/live/online   body { lat, lng, accuracy_m }
 *                                 returns { missed_offers_count }
 *   • POST /driver/live/offline
 *   • POST /driver/live/heartbeat body { lat, lng, accuracy_m }
 *   • GET  /driver/live/offers    returns { offers, reason }
 *   • POST /jobs/{id}/claim
 *
 * Intervals — identical to web:
 *   • Heartbeat: 30 s
 *   • Offer poll: 5 s
 *   • Offer countdown display: 60 s
 *
 * Lifecycle:
 *   • On mount:  read /driver/live/status → hydrate online/offline.
 *   • Toggle online: request foreground location → call /online with
 *     coords + accuracy → begin heartbeat + offer polling.
 *   • Toggle offline: call /offline → stop timers → clear offers.
 *   • Screen unmount / effect deps change: `alive = false` prevents
 *     stale timers/subscriptions; every setTimeout id is cleared.
 *   • Duplicate timers are prevented by the effect's single-instance
 *     start + cleanup pattern (see useEffect with `online` dep).
 *   • Location watch subscription is removed in cleanup.
 *
 * Location handling:
 *   • granted     → coords flow into /online + heartbeat.
 *   • denied      → surfaced inline; user cannot go online.
 *   • unavailable → same handling as denied; screen remains stable.
 *   • No background location — matches web/backend requirements.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import Mapbox from "@rnmapbox/maps";
import {
  AlertTriangle,
  Bell,
  Clock,
  LocateFixed,
  MapPin,
  PowerOff,
  Truck,
  Zap,
} from "lucide-react-native";
import { DriverAPI, type Job } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page } from "../ui";
import { useShellMenu } from "../components/AppShell";
import type { RootStackParamList } from "../App";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

const HEARTBEAT_INTERVAL_MS = 30_000;
const OFFER_POLL_INTERVAL_MS = 5_000;
const OFFER_COUNTDOWN_SECONDS = 60;

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Offer = Job & Record<string, any>;
type LocState = "idle" | "granted" | "denied" | "unavailable";

function formatDuration(secs: number) {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

async function currentPosition(): Promise<{ lat: number; lng: number; accuracy_m?: number }> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy_m: pos.coords.accuracy ?? undefined,
  };
}

export function LiveModeScreen() {
  const nav = useNavigation<Nav>();
  const { openDrawer, showMenu } = useShellMenu();

  const [online, setOnline] = useState(false);
  const [status, setStatus] = useState<any | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersReason, setOffersReason] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locState, setLocState] = useState<LocState>("idle");
  const [locError, setLocError] = useState<string | null>(null);
  const [missedToast, setMissedToast] = useState<number | null>(null);
  const [sessionSecs, setSessionSecs] = useState(0);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  const positionRef = useRef<{ lat: number; lng: number; accuracy_m?: number } | null>(null);
  const claimingRef = useRef<string | null>(null);

  // R34 — newest ASAP offers first.
  const sortedOffers = useMemo(() => {
    const arr = [...offers];
    arr.sort((a, b) => {
      const ta = a?.dispatch_ready_at ? String(a.dispatch_ready_at) : "";
      const tb = b?.dispatch_ready_at ? String(b.dispatch_ready_at) : "";
      if (tb !== ta) return tb < ta ? -1 : 1;
      const ia = String(a?.job_id || a?.id || "");
      const ib = String(b?.job_id || b?.id || "");
      return ib < ia ? -1 : ib > ia ? 1 : 0;
    });
    return arr;
  }, [offers]);

  /* ── status hydration ───────────────────────────────────────────── */
  const readOwnStatus = useCallback(async () => {
    try {
      const s = await DriverAPI.liveStatus();
      setStatus(s);
      setOnline(!!s?.live_online);
      if (s?.live_lat != null && s?.live_lng != null) {
        setPos({ lat: Number(s.live_lat), lng: Number(s.live_lng) });
      }
    } catch (e: any) {
      setErr(e?.message || "Could not read status");
    }
  }, []);

  useEffect(() => {
    readOwnStatus();
  }, [readOwnStatus]);

  /* ── goOnline / goOffline ──────────────────────────────────────── */
  const goOnline = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setLocError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setLocState("denied");
        setLocError(
          "Location permission denied. Enable location in Settings to go online.",
        );
        return;
      }
      let pos0: { lat: number; lng: number; accuracy_m?: number };
      try {
        pos0 = await currentPosition();
      } catch (e: any) {
        setLocState("unavailable");
        setLocError(e?.message || "GPS unavailable");
        return;
      }
      setLocState("granted");
      positionRef.current = pos0;
      setPos({ lat: pos0.lat, lng: pos0.lng });
      const r = await DriverAPI.goOnline(pos0.lat, pos0.lng, pos0.accuracy_m);
      setOnline(true);
      setStatus((prev: any) => ({
        ...(prev || {}),
        live_online: true,
        live_online_since: new Date().toISOString(),
        live_lat: pos0.lat,
        live_lng: pos0.lng,
      }));
      const missed = Number(r?.missed_offers_count || 0);
      if (missed > 0) {
        setMissedToast(missed);
        setTimeout(() => setMissedToast((v) => (v === missed ? null : v)), 8000);
      }
    } catch (e: any) {
      setErr(e?.message || "Could not go online");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const goOffline = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await DriverAPI.goOffline();
      setOnline(false);
      setOffers([]);
      setOffersReason(null);
      setStatus((prev: any) => ({ ...(prev || {}), live_online: false }));
    } catch (e: any) {
      setErr(e?.message || "Could not go offline");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  /* ── session timer while online ────────────────────────────────── */
  useEffect(() => {
    if (!online || !status?.live_online_since) {
      setSessionSecs(0);
      return () => {};
    }
    let start = Date.now();
    try {
      start = new Date(status.live_online_since).getTime();
    } catch { /* ignore */ }
    const tick = () => setSessionSecs(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [online, status?.live_online_since]);

  /* ── heartbeat + offer polling ────────────────────────────────── */
  useEffect(() => {
    if (!online) return () => {};
    let alive = true;
    let hbTimer: ReturnType<typeof setTimeout> | null = null;
    let offerTimer: ReturnType<typeof setTimeout> | null = null;

    async function heartbeatOnce() {
      try {
        const p = await currentPosition();
        if (!alive) return;
        positionRef.current = p;
        setPos({ lat: p.lat, lng: p.lng });
        await DriverAPI.heartbeat(p.lat, p.lng, p.accuracy_m);
      } catch (e: any) {
        if (alive) setLocError(e?.message || "GPS unavailable");
      } finally {
        if (alive) hbTimer = setTimeout(heartbeatOnce, HEARTBEAT_INTERVAL_MS);
      }
    }
    async function offersOnce() {
      try {
        const r = await DriverAPI.asapOffers();
        if (!alive) return;
        setOffers(Array.isArray((r as any)?.offers) ? ((r as any).offers as Offer[]) : []);
        setOffersReason((r as any)?.reason || null);
      } catch {
        /* silent — offline blip does not need a banner */
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
  }, [online]);

  /* ── claim offer ───────────────────────────────────────────────── */
  const claimOffer = useCallback(
    async (offer: Offer) => {
      const jobId = String(offer.job_id || offer.id || "");
      if (!jobId) return;
      if (claimingRef.current) return; // dedupe
      claimingRef.current = jobId;
      setClaiming(jobId);
      setErr(null);
      try {
        await DriverAPI.claimAsap(jobId);
        // Follow web navigation: try to resolve to /bookings/mine
        // first so the driver lands on the freshly-created booking.
        try {
          const mine = await DriverAPI.myBookings();
          const match = (mine || []).find((b: any) => b?.job_id === jobId);
          if (match) {
            (nav as any).reset({ index: 0, routes: [{ name: "ActiveBooking", params: { bookingId: match.id } }] });
            return;
          }
        } catch {
          /* fall through to job-detail */
        }
        (nav as any).reset({ index: 0, routes: [{ name: "JobDetail", params: { jobId } }] });
      } catch (e: any) {
        const msg = e?.message || "Could not claim";
        if (/409/.test(msg) || /already claimed/i.test(msg) || /unavailable/i.test(msg)) {
          setErr("Another driver just took this job.");
          // Force a fresh offers fetch so the taken job disappears.
          try {
            const r = await DriverAPI.asapOffers();
            setOffers(Array.isArray((r as any)?.offers) ? ((r as any).offers as Offer[]) : []);
          } catch {
            /* ignore */
          }
        } else {
          setErr(msg);
        }
      } finally {
        claimingRef.current = null;
        setClaiming(null);
      }
    },
    [nav],
  );

  /* ── render ────────────────────────────────────────────────────── */
  return (
    <Page testID="driver-live">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={readOwnStatus}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={styles.header}>
          {showMenu ? (
            <Pressable
              onPress={openDrawer}
              style={styles.headerMenu}
              testID="live-open-drawer"
              accessibilityLabel="Open menu"
            >
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>≡</Text>
            </Pressable>
          ) : null}
          <Text style={typography.h1Large}>Live Mode</Text>
          <View
            style={[styles.pill, { backgroundColor: online ? "#16A34A" : "#111111" }]}
            testID="driver-live-state-pill"
          >
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>{online ? "Online" : "Offline"}</Text>
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapWrap} testID="driver-live-map">
          <Mapbox.MapView style={StyleSheet.absoluteFillObject} styleURL={Mapbox.StyleURL.Street}>
            <Mapbox.Camera
              zoomLevel={12}
              centerCoordinate={pos ? [pos.lng, pos.lat] : [-0.1278, 51.5074]}
              animationDuration={0}
            />
            {pos ? (
              <Mapbox.PointAnnotation id="me" coordinate={[pos.lng, pos.lat]}>
                <View style={styles.mePin}>
                  <View style={styles.mePinInner} />
                </View>
              </Mapbox.PointAnnotation>
            ) : null}
            {sortedOffers.map((o) => {
              const lat = Number(o.pickup_lat);
              const lng = Number(o.pickup_lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              const id = String(o.job_id || o.id);
              return (
                <Mapbox.PointAnnotation
                  key={`ofr-${id}`}
                  id={`ofr-${id}`}
                  coordinate={[lng, lat]}
                  onSelected={() => claimOffer(o)}
                >
                  <View style={styles.offerPin}>
                    <Zap size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </Mapbox.PointAnnotation>
              );
            })}
          </Mapbox.MapView>
        </View>

        {/* Body */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          {/* Online/offline toggle */}
          <View style={styles.toggleCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.toggleTitle}>
                {online ? "You're online" : "You're offline"}
              </Text>
              <Text style={styles.toggleBody} testID="driver-live-town">
                {online
                  ? `Session ${formatDuration(sessionSecs)} · ${sortedOffers.length} offer${
                      sortedOffers.length === 1 ? "" : "s"
                    } nearby`
                  : "Go online to receive ASAP jobs."}
              </Text>
              {locError ? (
                <Text style={styles.errText} testID="driver-live-loc-error">
                  {locError}
                </Text>
              ) : null}
              {err ? (
                <Text style={styles.errText} testID="driver-live-error">
                  {err}
                </Text>
              ) : null}
            </View>
            {online ? (
              <Pressable
                onPress={goOffline}
                style={[styles.actionBtn, styles.offlineBtn]}
                disabled={busy}
                testID="driver-live-go-offline"
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <PowerOff size={14} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Go offline</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={goOnline}
                style={[styles.actionBtn, styles.onlineBtn]}
                disabled={busy}
                testID="driver-live-go-online"
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <LocateFixed size={14} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Go online</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* Missed-offers toast */}
          {missedToast ? (
            <View style={styles.missedToast} testID="driver-live-missed-toast">
              <Bell size={16} color="#78350F" />
              <Text style={{ fontSize: 13, color: "#78350F", flex: 1 }}>
                {missedToast} offer{missedToast === 1 ? "" : "s"} landed while you were away.
              </Text>
            </View>
          ) : null}

          {/* Offers list */}
          {online && sortedOffers.length === 0 ? (
            <View style={styles.emptyBox} testID="driver-live-empty">
              <Zap size={28} color="#9CA3AF" />
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>
                Looking for ASAP jobs near you…
              </Text>
              <Text style={{ fontSize: 13, color: colors.inkMuted, textAlign: "center" }}>
                {offersReason === "busy_on_asap"
                  ? "You're currently on an ASAP delivery — finish it to receive new offers."
                  : "We'll surface the freshest jobs the instant they land."}
              </Text>
            </View>
          ) : null}

          {online && sortedOffers.length > 0 ? (
            <View style={{ gap: 10 }} testID="driver-live-offers">
              {sortedOffers.map((o) => (
                <OfferCard
                  key={String(o.job_id || o.id)}
                  offer={o}
                  onAccept={() => claimOffer(o)}
                  claiming={claiming === String(o.job_id || o.id)}
                  disabled={!!claiming}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Page>
  );
}

/* ── OfferCard ─────────────────────────────────────────────────────── */

function OfferCountdown({ readyAt }: { readyAt?: string }) {
  const [left, setLeft] = useState<number>(() => {
    try {
      const t0 = readyAt ? new Date(readyAt).getTime() : Date.now();
      return Math.max(0, OFFER_COUNTDOWN_SECONDS - Math.floor((Date.now() - t0) / 1000));
    } catch {
      return OFFER_COUNTDOWN_SECONDS;
    }
  });
  useEffect(() => {
    if (left <= 0) return () => {};
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);
  return (
    <View style={styles.countdown} testID="driver-live-offer-countdown">
      <Clock size={11} color="#78350F" />
      <Text style={styles.countdownText}>{left}s</Text>
    </View>
  );
}

function OfferCard({
  offer,
  onAccept,
  claiming,
  disabled,
}: {
  offer: Offer;
  onAccept: () => void;
  claiming: boolean;
  disabled: boolean;
}) {
  const isRecovery = String(offer.service_type || "") === "breakdown_recovery";
  const jobId = String(offer.job_id || offer.id);
  return (
    <View style={styles.offerCard} testID={`driver-live-offer-${jobId}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isRecovery ? (
            <AlertTriangle size={14} color="#B45309" />
          ) : (
            <Truck size={14} color={colors.ink} />
          )}
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>
            {isRecovery ? "ASAP Vehicle Recovery" : "ASAP Transport"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <OfferCountdown readyAt={offer.dispatch_ready_at} />
          <Text style={styles.offerPrice}>£{Number(offer.accepted_price || 0)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <MapPin size={13} color="#16A34A" />
        <Text style={styles.offerAddr} numberOfLines={1}>
          {offer.pickup_address || offer.pickup_town}
          {offer.distance_to_pickup_miles != null ? (
            <Text style={styles.offerMeta}>
              {"  · "}{Number(offer.distance_to_pickup_miles).toFixed(1)} mi away
            </Text>
          ) : null}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
        <MapPin size={13} color="#D62828" />
        <Text style={styles.offerAddr} numberOfLines={1}>
          {offer.dropoff_address || offer.dropoff_town}
          {offer.distance_miles != null ? (
            <Text style={styles.offerMeta}>
              {"  · "}{Number(offer.distance_miles).toFixed(0)} mi trip
              {offer.duration_minutes ? `  · ~${Math.round(offer.duration_minutes)} min` : ""}
            </Text>
          ) : null}
        </Text>
      </View>

      {offer.recommended_vehicle ? (
        <Text style={styles.offerVehicle}>Suitable: {offer.recommended_vehicle}</Text>
      ) : null}
      {offer.customer_note ? (
        <Text style={styles.offerNote}>"{offer.customer_note}"</Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={onAccept}
          disabled={disabled}
          style={[styles.acceptBtn, disabled && { opacity: 0.7 }]}
          testID={`driver-live-accept-${jobId}`}
        >
          {claiming ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptBtnText}>
              Accept · £{Number(offer.accepted_price || 0)}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ── styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerMenu: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F4F4F4",
    alignItems: "center", justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  pillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  mapWrap: {
    height: 260,
    marginTop: 4,
    borderRadius: 0,
    overflow: "hidden",
  },
  mePin: {
    width: 22, height: 22, borderRadius: 999,
    backgroundColor: "rgba(37,99,235,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  mePinInner: {
    width: 12, height: 12, borderRadius: 999,
    backgroundColor: "#2563EB",
    borderWidth: 2, borderColor: "#FFFFFF",
  },
  offerPin: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: colors.brand,
    borderWidth: 2, borderColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  toggleTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  toggleBody: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999,
  },
  onlineBtn: { backgroundColor: "#16A34A" },
  offlineBtn: { backgroundColor: "#111111" },
  actionBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  emptyBox: {
    alignItems: "center",
    padding: 24,
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: "#F9FAFB",
  },
  errText: { fontSize: 12, color: "#DC2626", marginTop: 4 },

  missedToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1, borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },

  offerCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  offerPrice: { fontSize: 20, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  offerAddr: { fontSize: 13, color: colors.ink, flex: 1 },
  offerMeta: { color: colors.inkMuted },
  offerVehicle: { fontSize: 12, color: colors.inkMuted, marginTop: 6 },
  offerNote: { fontSize: 12, color: colors.inkMuted, fontStyle: "italic", marginTop: 6 },
  acceptBtn: {
    flex: 1,
    alignItems: "center", justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  acceptBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  countdownText: { fontSize: 11, fontWeight: "700", color: "#78350F" },
});
