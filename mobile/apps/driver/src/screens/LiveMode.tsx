/**
 * LiveMode — CargoOne Driver ASAP Live Mode (map-first, Uber-style).
 *
 * Phase 6. Mirrors the EXISTING Driver Web implementation at
 * `frontend/src/pages/portal/driver/Live.jsx` and reuses the same
 * backend endpoints (NO backend changes):
 *   • GET  /driver/live/status
 *   • POST /driver/live/online      (returns { missed_offers_count })
 *   • POST /driver/live/offline
 *   • POST /driver/live/heartbeat
 *   • GET  /driver/live/offers      (5 s poll)
 *   • POST /jobs/{id}/claim         (inlined via core `api` helper to
 *                                    keep packages/core locked)
 *
 * Native integration:
 *   • Mapbox tile canvas via `@rnmapbox/maps` (Phase-5 configuration).
 *   • `expo-location` foreground permission only. One-shot
 *     `getCurrentPositionAsync` on Go-Online + for each 30 s
 *     heartbeat. No `watchPositionAsync`, no background, no `Always`.
 *
 * Live Mode is the ONLY screen that uses `expo-location` today — the
 * Phase-5 map screens (JobsMap/RouteMap, AvailableJobs, JobDetail,
 * BookingDetail map preview) remain untouched.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { api, DriverAPI, type Booking, type Job } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import {
  Icon,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  colors,
  radius,
  space,
  typography,
} from "../ui";
import { LiveMap, type LiveOffer } from "../components/LiveMap";
import { LiveBottomSheet, type SheetSnap } from "../components/LiveBottomSheet";

type Nav = NativeStackNavigationProp<RootStackParamList, "LiveMode">;

const HEARTBEAT_INTERVAL_MS = 30_000;
const OFFER_POLL_INTERVAL_MS = 5_000;
const OFFER_COUNTDOWN_SECONDS = 60;

type LiveStatus = {
  live_online?: boolean;
  live_lat?: number | null;
  live_lng?: number | null;
  live_online_since?: string | null;
};

type AsapOffer = LiveOffer & {
  title?: string | null;
  pickup_address?: string | null;
  pickup_town?: string | null;
  dropoff_address?: string | null;
  dropoff_town?: string | null;
  distance_miles?: number | null;
  duration_minutes?: number | null;
  distance_to_pickup_miles?: number | null;
  service_type?: string | null;
  dispatch_ready_at?: string | null;
  photos?: string[];
};

type TodayStats = { jobs: number; earnings: number };

function formatSession(secs: number) {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

/** Live Mode's offer card — mirrors the web OfferCard. */
function OfferCard({
  offer,
  claiming,
  onAccept,
  onDecline,
}: {
  offer: AsapOffer;
  claiming: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isRecovery = offer.service_type === "breakdown_recovery";
  // 60s countdown from dispatch_ready_at.
  const [left, setLeft] = useState(() => {
    try {
      const t0 = offer.dispatch_ready_at
        ? new Date(offer.dispatch_ready_at).getTime()
        : Date.now();
      return Math.max(
        0,
        OFFER_COUNTDOWN_SECONDS - Math.floor((Date.now() - t0) / 1000),
      );
    } catch {
      return OFFER_COUNTDOWN_SECONDS;
    }
  });
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);

  return (
    <View
      style={styles.offerCard}
      testID={`driver-live-offer-${offer.job_id}`}
    >
      <View style={styles.offerHeader}>
        <View style={styles.offerKind}>
          <Icon
            name={isRecovery ? "alert-triangle" : "truck"}
            size={14}
            color={isRecovery ? "#B45309" : colors.ink}
          />
          <Text style={styles.offerKindText}>
            {isRecovery ? "ASAP Vehicle Recovery" : "ASAP Transport"}
          </Text>
        </View>
        <View style={styles.offerCountRow}>
          <View style={styles.countdown}>
            <Icon name="clock" size={12} color="#92400E" />
            <Text style={styles.countdownText}>{left}s</Text>
          </View>
          <Text style={styles.offerPrice}>£{offer.accepted_price ?? 0}</Text>
        </View>
      </View>

      <View style={styles.offerRow}>
        <View style={styles.dotPickup} />
        <Text style={styles.offerRowText} numberOfLines={1}>
          {offer.pickup_address || offer.pickup_town || "Pickup"}
          {offer.distance_to_pickup_miles != null ? (
            <Text style={styles.offerRowMuted}>
              {"  "}· {offer.distance_to_pickup_miles} mi away
            </Text>
          ) : null}
        </Text>
      </View>
      <View style={styles.offerRow}>
        <View style={styles.dotDropoff} />
        <Text style={styles.offerRowText} numberOfLines={1}>
          {offer.dropoff_address || offer.dropoff_town || "Dropoff"}
          {offer.distance_miles != null ? (
            <Text style={styles.offerRowMuted}>
              {"  "}· {offer.distance_miles} mi trip
              {offer.duration_minutes
                ? ` · ~${Math.round(offer.duration_minutes)} min`
                : ""}
            </Text>
          ) : null}
        </Text>
      </View>

      <View style={styles.offerActions}>
        <SecondaryButton
          title="Decline"
          onPress={onDecline}
          disabled={claiming}
          testID={`driver-live-decline-${offer.job_id}`}
          style={{ flex: 1 }}
        />
        <PrimaryButton
          title={claiming ? "…" : `Accept · £${offer.accepted_price ?? 0}`}
          onPress={onAccept}
          disabled={claiming}
          testID={`driver-live-accept-${offer.job_id}`}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

export default function LiveModeScreen() {
  const nav = useNavigation<Nav>();

  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [offers, setOffers] = useState<AsapOffer[]>([]);
  const [offersReason, setOffersReason] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [missedToast, setMissedToast] = useState<number | null>(null);

  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const [sessionSecs, setSessionSecs] = useState(0);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    jobs: 0,
    earnings: 0,
  });

  const positionRef = useRef<{ lat: number; lng: number } | null>(null);
  const priorOfferCountRef = useRef(0);

  // ── Initial status read ──────────────────────────────────────────
  const readOwnStatus = useCallback(async () => {
    try {
      const s = (await DriverAPI.liveStatus()) as LiveStatus;
      setStatus(s);
      setOnline(!!s.live_online);
      if (
        typeof s.live_lat === "number" &&
        typeof s.live_lng === "number" &&
        Number.isFinite(s.live_lat) &&
        Number.isFinite(s.live_lng)
      ) {
        positionRef.current = { lat: s.live_lat, lng: s.live_lng };
      }
    } catch (e: any) {
      setErr(e?.message || "Could not read status");
    }
  }, []);

  useEffect(() => {
    readOwnStatus();
  }, [readOwnStatus]);

  // ── One-shot foreground position fix ────────────────────────────
  const getPosition = useCallback(async (): Promise<{
    lat: number;
    lng: number;
    accuracy_m?: number;
  }> => {
    const perm = await Location.getForegroundPermissionsAsync();
    let granted = perm.granted;
    if (!granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) {
      setPermDenied(true);
      throw new Error("Location permission denied");
    }
    setPermDenied(false);
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy ?? undefined,
    };
  }, []);

  // ── Go online / offline ─────────────────────────────────────────
  const goOnline = useCallback(async () => {
    setBusy(true);
    setLocError(null);
    setErr(null);
    try {
      const pos = await getPosition();
      positionRef.current = { lat: pos.lat, lng: pos.lng };
      const r = (await DriverAPI.goOnline(
        pos.lat,
        pos.lng,
        pos.accuracy_m,
      )) as { missed_offers_count?: number };
      setOnline(true);
      setStatus((prev) => ({
        ...(prev || {}),
        live_online: true,
        live_lat: pos.lat,
        live_lng: pos.lng,
        live_online_since: new Date().toISOString(),
      }));
      const missed = Number(r?.missed_offers_count || 0);
      if (missed > 0) {
        setMissedToast(missed);
        setTimeout(
          () => setMissedToast((v) => (v === missed ? null : v)),
          8000,
        );
      }
      setSheetSnap("peek");
    } catch (e: any) {
      setLocError(e?.message || "Could not go online");
    } finally {
      setBusy(false);
    }
  }, [getPosition]);

  const goOffline = useCallback(async () => {
    setBusy(true);
    try {
      await DriverAPI.goOffline();
      setOnline(false);
      setOffers([]);
      setOffersReason(null);
      setSelectedJobId(null);
      setStatus((prev) => ({ ...(prev || {}), live_online: false }));
      setSheetSnap("peek");
    } catch (e: any) {
      setErr(e?.message || "Could not go offline");
    } finally {
      setBusy(false);
    }
  }, []);

  // ── Session timer ───────────────────────────────────────────────
  useEffect(() => {
    if (!online || !status?.live_online_since) {
      setSessionSecs(0);
      return;
    }
    let start = 0;
    try {
      start = new Date(status.live_online_since).getTime();
    } catch {
      start = Date.now();
    }
    const tick = () =>
      setSessionSecs(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [online, status?.live_online_since]);

  // ── Today's earnings/jobs (fires once per online transition) ────
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      try {
        const mine = (await DriverAPI.myBookings()) as Booking[];
        if (cancelled || !Array.isArray(mine)) return;
        const today = new Date().toISOString().slice(0, 10);
        const todays = mine.filter((b) =>
          String((b as any).paid_at || b.created_at || "").startsWith(today),
        );
        const earnings = todays
          .filter((b) => b.payment_status === "paid")
          .reduce(
            (sum, b) => sum + Number((b as any).driver_charge || 0),
            0,
          );
        if (!cancelled) {
          setTodayStats({
            jobs: todays.length,
            earnings: Math.round(earnings),
          });
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  // ── Heartbeat (30 s) + Offer poll (5 s) loops while online ──────
  useEffect(() => {
    if (!online) return;
    let alive = true;
    let hbTimer: ReturnType<typeof setTimeout> | null = null;
    let offerTimer: ReturnType<typeof setTimeout> | null = null;

    const heartbeatOnce = async () => {
      try {
        const pos = await getPosition();
        positionRef.current = { lat: pos.lat, lng: pos.lng };
        await DriverAPI.heartbeat(pos.lat, pos.lng, pos.accuracy_m);
        if (alive) {
          setStatus((prev) => ({
            ...(prev || {}),
            live_lat: pos.lat,
            live_lng: pos.lng,
          }));
        }
      } catch (e: any) {
        if (alive) setLocError(e?.message || "Location error");
      } finally {
        if (alive) hbTimer = setTimeout(heartbeatOnce, HEARTBEAT_INTERVAL_MS);
      }
    };

    const offersOnce = async () => {
      try {
        const r = (await DriverAPI.asapOffers()) as unknown as {
          offers?: AsapOffer[];
          reason?: string | null;
        };
        if (!alive) return;
        setOffers(Array.isArray(r?.offers) ? r.offers : []);
        setOffersReason(r?.reason || null);
      } catch {
        /* silent */
      } finally {
        if (alive) offerTimer = setTimeout(offersOnce, OFFER_POLL_INTERVAL_MS);
      }
    };

    heartbeatOnce();
    offersOnce();
    return () => {
      alive = false;
      if (hbTimer) clearTimeout(hbTimer);
      if (offerTimer) clearTimeout(offerTimer);
    };
  }, [online, getPosition]);

  // ── Auto-expand sheet when a new offer arrives ──────────────────
  useEffect(() => {
    const prev = priorOfferCountRef.current;
    priorOfferCountRef.current = offers.length;
    if (offers.length > prev && sheetSnap !== "full") setSheetSnap("half");
    if (offers.length === 0 && prev > 0 && sheetSnap === "half")
      setSheetSnap("peek");
  }, [offers.length, sheetSnap]);

  // ── Accept / decline ────────────────────────────────────────────
  const claimOffer = useCallback(
    async (offer: AsapOffer) => {
      setClaiming(offer.job_id);
      setErr(null);
      try {
        // Inline the existing /jobs/{id}/claim call via the shared core
        // api helper so packages/core stays locked (no new wrapper).
        await api(`/jobs/${offer.job_id}/claim`, { method: "POST" });
        // After claim, look up the resulting booking so the stack can
        // deep-link into BookingDetail (same as the web redirect).
        try {
          const mine = (await DriverAPI.myBookings()) as Booking[];
          const match = (mine || []).find(
            (b) => (b as any).job_id === offer.job_id,
          );
          if (match) {
            nav.navigate("BookingDetail", { bookingId: match.id });
            return;
          }
        } catch {
          /* fall through to JobDetail */
        }
        nav.navigate("JobDetail", { jobId: offer.job_id });
      } catch (e: any) {
        const msg = e?.message || "Could not claim";
        const code = e?.status || e?.code;
        if (code === 409 || /409/.test(String(msg)) || /already claimed/i.test(String(msg))) {
          setErr("Another driver just took this job.");
          try {
            const r = (await DriverAPI.asapOffers()) as unknown as {
              offers?: AsapOffer[];
            };
            setOffers(Array.isArray(r?.offers) ? r.offers : []);
          } catch {
            /* ignore */
          }
        } else {
          setErr(msg);
        }
      } finally {
        setClaiming(null);
      }
    },
    [nav],
  );

  const declineOffer = useCallback((offer: AsapOffer) => {
    setOffers((prev) => prev.filter((x) => x.job_id !== offer.job_id));
  }, []);

  // ── Map interactions ────────────────────────────────────────────
  const onPinPress = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId);
      setSheetSnap("half");
    },
    [],
  );
  const recenter = useCallback(() => {
    if (!positionRef.current) return;
    setRecenterSignal((n) => n + 1);
  }, []);

  // Sort offers newest-first (dispatch_ready_at DESC) — mirrors web R34.
  const sortedOffers = useMemo(() => {
    const arr = offers.slice();
    arr.sort((a, b) => {
      const at = a.dispatch_ready_at
        ? new Date(a.dispatch_ready_at).getTime()
        : 0;
      const bt = b.dispatch_ready_at
        ? new Date(b.dispatch_ready_at).getTime()
        : 0;
      return bt - at;
    });
    return arr;
  }, [offers]);

  const driver = useMemo(() => {
    const lat = Number(status?.live_lat);
    const lng = Number(status?.live_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [status?.live_lat, status?.live_lng]);

  // Top-pill content ------------------------------------------------
  const pillTint = online
    ? { bg: "rgba(17,17,17,0.92)", fg: "#FFFFFF" }
    : { bg: "rgba(255,255,255,0.95)", fg: colors.ink };
  const pillLeft = !online
    ? "Offline"
    : offers.length > 0
      ? `${offers.length} nearby`
      : "Online";

  const openIosSettings = () => Linking.openURL("app-settings:");

  return (
    <View style={styles.root} testID="driver-live-mode">
      <PageHeader title="Live Mode" />

      <View style={styles.canvas}>
        <LiveMap
          driver={online ? driver : driver /* always show last-known when we have it */}
          offers={online ? sortedOffers : []}
          onOfferPress={onPinPress}
          selectedJobId={selectedJobId}
          recenterSignal={recenterSignal}
        />

        {/* Top pill */}
        <View style={styles.topPillWrap} pointerEvents="none">
          <View style={[styles.topPill, { backgroundColor: pillTint.bg }]}>
            <Icon
              name={online ? "zap" : "power"}
              size={14}
              color={pillTint.fg}
            />
            <Text style={[styles.topPillLeft, { color: pillTint.fg }]}>
              {pillLeft}
            </Text>
            {online ? (
              <>
                <Text style={[styles.topPillMain, { color: pillTint.fg }]}>
                  £{todayStats.earnings}
                </Text>
                <Text style={[styles.topPillRight, { color: pillTint.fg }]}>
                  {todayStats.jobs} jobs
                </Text>
              </>
            ) : null}
          </View>
          {missedToast ? (
            <View style={styles.missedToast} testID="missed-offers-toast">
              <Icon name="zap" size={12} color="#92400E" />
              <Text style={styles.missedToastText}>
                You missed {missedToast} offer{missedToast === 1 ? "" : "s"}{" "}
                while offline.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right-side FABs */}
        <View style={styles.fabStack} pointerEvents="box-none">
          {online ? (
            <Pressable
              onPress={recenter}
              style={styles.fab}
              testID="driver-live-fab-recenter"
            >
              <Icon name="crosshair" size={18} color={colors.ink} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() =>
              setSheetSnap(sheetSnap === "full" ? "peek" : "full")
            }
            style={styles.fab}
            testID="driver-live-fab-list"
          >
            <Icon
              name={sheetSnap === "full" ? "chevron-down" : "list"}
              size={18}
              color={colors.ink}
            />
          </Pressable>
          {online ? (
            <Pressable
              onPress={goOffline}
              disabled={busy}
              style={[styles.fab, styles.fabDanger]}
              testID="driver-live-fab-go-offline"
            >
              <Icon name="power" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>

        {/* Bottom sheet */}
        <LiveBottomSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          headerLeft={
            online ? (
              <View style={styles.sheetHeaderRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {offers.length === 0
                    ? "Looking for nearby jobs…"
                    : `${offers.length} nearby ASAP offer${
                        offers.length > 1 ? "s" : ""
                      }`}
                </Text>
              </View>
            ) : (
              <View style={styles.sheetHeaderRow}>
                <View style={styles.staticDot} />
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  You're offline
                </Text>
              </View>
            )
          }
          headerRight={
            online ? (
              <Text style={styles.sessionText}>
                {formatSession(sessionSecs)}
              </Text>
            ) : null
          }
        >
          {!online ? (
            <View style={{ gap: space[3] }}>
              <Text style={typography.body}>
                Go online to receive nearby CargoOne ASAP jobs. Your location
                is only used while you're online.
              </Text>
              {permDenied ? (
                <View style={styles.permBox}>
                  <Text style={typography.caption}>
                    Location permission is turned off. Enable it in iOS
                    Settings to go online.
                  </Text>
                  <SecondaryButton
                    title="Open Settings"
                    onPress={openIosSettings}
                    testID="driver-live-open-settings"
                  />
                </View>
              ) : null}
              {locError ? (
                <Text style={styles.errText}>{locError}</Text>
              ) : null}
              <PrimaryButton
                title={busy ? "Starting…" : "Go online"}
                onPress={goOnline}
                disabled={busy}
                testID="driver-live-go-online"
              />
            </View>
          ) : offers.length === 0 ? (
            <View style={{ gap: space[3] }}>
              <View style={styles.idleRow}>
                <ActivityIndicator color={colors.brand} />
                <Text style={typography.body}>Looking for nearby jobs…</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statTile}>
                  <Text style={typography.micro}>Today</Text>
                  <Text style={typography.priceBig}>
                    £{todayStats.earnings}
                  </Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={typography.micro}>Jobs</Text>
                  <Text style={typography.priceBig}>{todayStats.jobs}</Text>
                </View>
              </View>
              {offersReason === "stale_location" ? (
                <Text style={typography.caption}>
                  Your location is a bit old — we'll refresh it on the next
                  heartbeat.
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: space[3] }}>
              {sortedOffers.map((o) => (
                <OfferCard
                  key={o.job_id}
                  offer={o}
                  claiming={claiming === o.job_id}
                  onAccept={() => claimOffer(o)}
                  onDecline={() => declineOffer(o)}
                />
              ))}
            </View>
          )}

          {err ? (
            <Text
              style={[styles.errText, { marginTop: space[3] }]}
              testID="driver-live-error"
            >
              {err}
            </Text>
          ) : null}
        </LiveBottomSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  canvas: { flex: 1, position: "relative", overflow: "hidden" },

  topPillWrap: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
  },
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  topPillLeft: { fontSize: 12, fontWeight: "700" },
  topPillMain: { fontSize: 14, fontWeight: "800", marginLeft: 6 },
  topPillRight: { fontSize: 12, fontWeight: "600", opacity: 0.8 },

  missedToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "92%",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(254,243,199,0.95)",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  missedToastText: { fontSize: 12, color: "#92400E", flexShrink: 1 },

  fabStack: {
    position: "absolute",
    right: 12,
    top: 90,
    gap: 10,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fabDanger: { backgroundColor: colors.brand },

  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    flex: 1,
    minWidth: 0,
  },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  staticDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.inkFaint },
  sessionText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    color: colors.inkMuted,
  },

  idleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statsRow: { flexDirection: "row", gap: space[3] },
  statTile: {
    flex: 1,
    padding: space[3],
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
  },

  // Offer card
  offerCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: space[3],
    gap: space[2],
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  offerKind: { flexDirection: "row", alignItems: "center", gap: 6 },
  offerKindText: { fontSize: 12, fontWeight: "700", color: colors.ink },
  offerCountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  countdownText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  offerPrice: { fontSize: 20, fontWeight: "800", color: colors.ink },

  offerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dotPickup: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  dotDropoff: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  offerRowText: { fontSize: 13, color: colors.ink, flex: 1, minWidth: 0 },
  offerRowMuted: { color: colors.inkMuted },

  offerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: space[2],
  },

  permBox: {
    padding: space[3],
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
    gap: space[2],
  },
  errText: { color: colors.error, fontSize: 13 },
});

// Helper so TS doesn't complain that `Job` is unused when the file is
// read in isolation. Shared type kept intentionally for future
// extensions.
export type { Job };
