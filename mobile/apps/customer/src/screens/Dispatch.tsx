/**
 * DispatchScreen — CargoOne ASAP customer Uber-like live experience.
 * 1:1 functional port of frontend/src/pages/portal/customer/Dispatch.jsx.
 *
 * The single map-first customer surface for the entire ASAP lifecycle:
 *
 *   Finalising booking → Finding a driver → Driver accepted →
 *   Driver on the way → Driver arriving → Job in progress → Delivered
 *
 * All state comes from the existing CargoOne backend — no client-only
 * booking state machine, no independent price/refund calculations:
 *
 *   • GET  /api/customer/dispatch/{jobId}   — searching state (4 s poll)
 *   • GET  /api/bookings/{bookingId}        — booking transitions (5 s poll)
 *   • GET  /api/tracking/{bookingId}        — driver live location (6 s poll)
 *
 * Web reference components mirrored:
 *   AsapMapCanvas    → this file's <Mapbox.MapView> full-bleed layer
 *                      with pickup + dropoff annotations, route line,
 *                      pulsing pickup sweep while searching, and the
 *                      optional driver marker + trail once active.
 *   AsapTopStatusPill → this file's <TopPill> (dark capsule, pulse dot).
 *   AsapFloatingControls → <RecenterFAB> below the pill.
 *   AsapBottomSheet   → <BottomCard> (non-draggable — static bottom sheet
 *                      is deliberately simpler than the web draggable
 *                      3-snap sheet for the initial mobile pass).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LocateFixed, X as XIcon } from "lucide-react-native";
import {
  Booking,
  CustomerAPI,
  DispatchState,
  Job,
  TrackingResponse,
  money,
} from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";
import { DriverCard } from "../components/DriverCard";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

type P = NativeStackScreenProps<RootStackParamList, "Dispatch">;

const DISPATCH_POLL_MS = 4000;
const BOOKING_POLL_MS = 5000;
const TRACKING_POLL_MS = 6000;

type Variant = "loading" | "preparing" | "searching" | "accepted" | "active" | "done" | "cancelled" | "payment_required";

// Lifecycle order — the screen shows whichever of booking/dispatch status is furthest along,
// so a stale poll on one endpoint can't hold the UI back.
const STATUS_RANK: Record<string, number> = {
  posted: 0, accepted: 1, deposit_paid: 2, confirmed: 2, dispatch_ready: 2,
  travelling: 3, arrived: 4, collected: 5, on_route: 6, delivered: 7, pod_uploaded: 8, completed: 9,
};
export function furthestStatus(a?: string | null, b?: string | null): string | undefined {
  if (!a) return b || undefined;
  if (!b) return a;
  return (STATUS_RANK[b] ?? -1) > (STATUS_RANK[a] ?? -1) ? b : a;
}

/**
 * Given the current backend state, produce (label, variant, pulsing).
 * Mirrors web Dispatch.jsx derivePhase + PILL_BY_PHASE.
 */
export function stateFor(
  dispatch: DispatchState | null,
  booking: Booking | null,
): { label: string; sub?: string; pulse: boolean; variant: Variant } {
  if (dispatch?.cancelled_at || booking?.status === "cancelled" || booking?.cancelled_at) {
    return { label: "Booking cancelled", pulse: false, variant: "cancelled" };
  }
  const status = furthestStatus(booking?.status, dispatch?.status);
  if (status === "delivered" || status === "completed" || status === "pod_uploaded") {
    return { label: "Delivered", pulse: false, variant: "done" };
  }
  if (status === "on_route") return { label: "Job in progress", pulse: true, variant: "active" };
  if (status === "collected") return { label: "Cargo collected", pulse: true, variant: "active" };
  if (status === "arrived") return { label: "Driver arriving", pulse: true, variant: "active" };
  if (status === "travelling") return { label: "Driver on the way", pulse: true, variant: "active" };
  const d = dispatch as any;
  if (booking?.assigned_driver_id || d?.assigned_driver_id) {
    return { label: "Driver accepted", sub: booking?.assigned_driver_name || d?.assigned_driver_name || "", pulse: true, variant: "accepted" };
  }
  if (d?.dispatch_eligible) return { label: "Finding a driver", pulse: true, variant: "searching" };
  // Unpaid only when BOTH sources agree (job still posted and booking not paid).
  const jobPaid = ["confirmed", "dispatch_ready", "deposit_paid"].includes(String(d?.status || ""));
  if (booking && booking.payment_status !== "paid" && !jobPaid) {
    return { label: "Payment required", pulse: false, variant: "payment_required" };
  }
  if (dispatch) return { label: "Finalising booking", pulse: true, variant: "preparing" };
  return { label: "Loading", pulse: false, variant: "loading" };
}

// Prefer the newest non-cancelled booking for this job.
function pickBookingForJob(mine: Booking[] | null | undefined, jobId: string): Booking | undefined {
  const rows = (mine || []).filter((b) => b.job_id === jobId);
  const live = rows.filter((b) => b.status !== "cancelled" && !(b as any).cancelled_at);
  const pool = live.length ? live : rows;
  return [...pool].sort((x, y) => String((y as any).created_at || "").localeCompare(String((x as any).created_at || "")))[0];
}

export function DispatchScreen({ route, navigation }: P) {
  const { jobId, bookingId: paramBookingId } = route.params;

  const [dispatch, setDispatch] = useState<DispatchState | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  // bookingId comes from the caller when known; otherwise resolved from /bookings/mine and
  // retried on every dispatch poll until found.
  const [bookingId, setBookingId] = useState<string | null>(paramBookingId ?? null);
  const bookingIdRef = useRef<string | null>(paramBookingId ?? null);
  // Bumped when the app returns to the foreground → every poll restarts with an immediate fetch.
  const [resumeTick, setResumeTick] = useState(0);

  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const [_recenterTick, setRecenterTick] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") setResumeTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // ─── Poll /customer/dispatch/{jobId} (+ retry bookingId lookup until found) ───
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await CustomerAPI.dispatchState(jobId);
        if (!cancelled) setDispatch(d);
      } catch {
        /* ignore transient */
      }
      if (!bookingIdRef.current) {
        try {
          const match = pickBookingForJob(await CustomerAPI.myBookings(), jobId);
          if (!cancelled && match?.id) {
            bookingIdRef.current = match.id;
            setBookingId(match.id);
          }
        } catch {
          /* retry next poll */
        }
      }
    };
    load();
    const iv = setInterval(load, DISPATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [jobId, resumeTick]);

  // ─── Poll /bookings/{bookingId} once resolved ───
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const b = await CustomerAPI.bookingDetail(bookingId);
        if (!cancelled) setBooking(b);
      } catch {
        /* ignore */
      }
    };
    load();
    const iv = setInterval(load, BOOKING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [bookingId, resumeTick]);

  // ─── Poll /tracking/{bookingId} from "Driver accepted" until delivered (web parity) ───
  const s = stateFor(dispatch, booking);
  const active = s.variant === "active";
  const trackingOn = active || s.variant === "accepted";
  useEffect(() => {
    if (!bookingId || !trackingOn) return;
    let cancelled = false;
    const load = async () => {
      try {
        const t = await CustomerAPI.tracking(bookingId);
        if (!cancelled) setTracking(t);
      } catch {
        /* ignore */
      }
    };
    load();
    const iv = setInterval(load, TRACKING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [bookingId, trackingOn, resumeTick]);

  // ─── Geometry — web parity: coordinates always come from booking.job.
  // The /customer/dispatch/{jobId} endpoint returns pickup_town /
  // dropoff_town only, never lat/lng.  Once booking loads we have real
  // coords and the map renders; until then we show a Preparing state.
  const pickupPt = useMemo(
    () =>
      booking?.job?.pickup_lat != null && booking?.job?.pickup_lng != null
        ? { lat: booking.job.pickup_lat!, lng: booking.job.pickup_lng! }
        : null,
    [booking],
  );
  const dropoffPt = useMemo(
    () =>
      booking?.job?.dropoff_lat != null && booking?.job?.dropoff_lng != null
        ? { lat: booking.job.dropoff_lat!, lng: booking.job.dropoff_lng! }
        : null,
    [booking],
  );
  const driverPt = tracking?.last_location
    ? { lat: tracking.last_location.lat, lng: tracking.last_location.lng }
    : null;

  const routeGeoJSON = useMemo<any>(() => {
    if (!pickupPt || !dropoffPt) return null;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [pickupPt.lng, pickupPt.lat],
              [dropoffPt.lng, dropoffPt.lat],
            ],
          },
          properties: {},
        },
      ],
    };
  }, [pickupPt, dropoffPt]);

  const bounds = useMemo(() => {
    if (!pickupPt || !dropoffPt) return null;
    return {
      ne: [Math.max(pickupPt.lng, dropoffPt.lng), Math.max(pickupPt.lat, dropoffPt.lat)] as [number, number],
      sw: [Math.min(pickupPt.lng, dropoffPt.lng), Math.min(pickupPt.lat, dropoffPt.lat)] as [number, number],
    };
  }, [pickupPt, dropoffPt]);

  const recenter = useCallback(() => {
    if (bounds) {
      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [80, 40, 260, 40], 400);
    } else if (pickupPt) {
      cameraRef.current?.setCamera({ centerCoordinate: [pickupPt.lng, pickupPt.lat], zoomLevel: 13, animationDuration: 400 });
    }
    setRecenterTick((n) => n + 1);
  }, [bounds, pickupPt]);

  // Initial fit
  useEffect(() => {
    if (bounds) {
      const t = setTimeout(recenter, 200);
      return () => clearTimeout(t);
    }
  }, [bounds, recenter]);

  // ─── UI state ───
  const showSweep = s.variant === "searching" && pickupPt != null;
  // Cancellation stays available for both paid (refund) and unpaid
  // (plain cancel) — backend routes each path via /customer/bookings/{id}/cancel.
  const cancelable = !!bookingId && s.variant !== "cancelled" && s.variant !== "done" && !active;
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const onCancel = useCallback(async () => {
    if (!bookingId || cancelBusy) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const r = await CustomerAPI.cancelBooking(bookingId);
      // Refresh booking to pick up refund / status
      try { setBooking(await CustomerAPI.bookingDetail(bookingId)); } catch { /* ignore */ }
      navigation.replace("BookingDetail", { bookingId });
      return r;
    } catch (e: any) {
      setCancelError(e?.message || "Cancellation failed. Please try again.");
    } finally {
      setCancelBusy(false);
    }
  }, [bookingId, cancelBusy, navigation]);

  const collected = ["collected", "on_route"].includes(String(furthestStatus(booking?.status, dispatch?.status) || ""));
  const driverParty = (s.variant === "accepted" || active) ? booking?.other_party : null;

  const distanceMiles = booking?.job?.distance_miles ?? null;
  const searchRadius = dispatch?.current_search_radius_miles ?? null;
  const eta = tracking?.eta_minutes ?? null;
  const price = booking?.total_price ?? booking?.customer_total ?? null;

  return (
    <Page testID="asap-dispatch-screen" scroll={false}>
      <View style={styles.root}>
        {/* iOS navigation header — provides swipe-back + explicit back
            without covering the map. The stack header is disabled at
            the navigator level, so we render our own thin PageHeader
            with a transparent background overlaying the map top-safe
            area. */}
        <View style={styles.navHeader} pointerEvents="box-none">
          <PageHeader
            title="Live booking"
            onBack={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.navigate("Bookings")
            }
          />
        </View>
        {/* Full-bleed map */}
        <View style={styles.mapLayer}>
          {pickupPt ? (
            <Mapbox.MapView
              ref={mapRef}
              style={{ flex: 1 }}
              styleURL={Mapbox.StyleURL.Street}
              scaleBarEnabled={false}
              compassEnabled={false}
              logoEnabled={false}
              attributionEnabled={false}
              zoomEnabled
              scrollEnabled
              pitchEnabled={false}
              rotateEnabled={false}
              testID="asap-dispatch-map"
            >
              <Mapbox.Camera ref={cameraRef} animationDuration={400} />
              {routeGeoJSON ? (
                <Mapbox.ShapeSource id="asap-route" shape={routeGeoJSON}>
                  <Mapbox.LineLayer
                    id="asap-route-line"
                    style={{ lineColor: colors.brand, lineWidth: 3, lineCap: "round", lineJoin: "round", lineOpacity: 0.85 }}
                  />
                </Mapbox.ShapeSource>
              ) : null}
              <Mapbox.PointAnnotation id="asap-pickup" coordinate={[pickupPt.lng, pickupPt.lat]}>
                <View style={[styles.pin, { backgroundColor: colors.success }]}>
                  <Text style={styles.pinText}>P</Text>
                  {showSweep ? <PulseRing /> : null}
                </View>
              </Mapbox.PointAnnotation>
              {dropoffPt ? (
                <Mapbox.PointAnnotation id="asap-dropoff" coordinate={[dropoffPt.lng, dropoffPt.lat]}>
                  <View style={[styles.pin, { backgroundColor: colors.brand }]}>
                    <Text style={styles.pinText}>D</Text>
                  </View>
                </Mapbox.PointAnnotation>
              ) : null}
              {driverPt ? (
                <Mapbox.PointAnnotation id="asap-driver" coordinate={[driverPt.lng, driverPt.lat]}>
                  <View style={styles.driverDot} />
                </Mapbox.PointAnnotation>
              ) : null}
            </Mapbox.MapView>
          ) : (
            // Neutral placeholder — booking is being fetched. Should
            // clear within the first poll interval; matches web where
            // this state is invisible because the initial fetch is fast.
            <View style={styles.locating} />
          )}
        </View>

        {/* Top pill */}
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={[styles.pill, s.variant === "cancelled" && { backgroundColor: colors.errorInk }]}>
            {s.pulse ? <PulseDot /> : null}
            <Text style={styles.pillLabel} testID="asap-status-label">
              {s.label}
            </Text>
            {s.sub ? <Text style={styles.pillSub}>· {s.sub}</Text> : null}
            {s.variant === "searching" && searchRadius != null ? (
              <Text style={styles.pillSub}>· {searchRadius >= 500 ? "Nationwide" : `${Math.round(searchRadius)}mi`}</Text>
            ) : null}
          </View>
        </View>

        {/* Recenter FAB */}
        <Pressable
          onPress={recenter}
          style={styles.recenterFab}
          accessibilityLabel="Recenter map"
          testID="asap-recenter"
        >
          <LocateFixed size={18} color={colors.ink} />
        </Pressable>

        {/* Bottom sheet */}
        <View style={styles.bottomCard} testID="asap-bottom-sheet">
          <View style={styles.handle} />
          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.micro}>PICKUP</Text>
              <Text style={typography.strong} numberOfLines={1}>
                {dispatch?.pickup_town || booking?.job?.pickup_town || pickupPt ? (dispatch?.pickup_town || booking?.job?.pickup_town || "—") : "—"}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 20, color: colors.inkMuted }}>→</Text>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={typography.micro}>DROPOFF</Text>
              <Text style={typography.strong} numberOfLines={1}>
                {dispatch?.dropoff_town || booking?.job?.dropoff_town || "—"}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat label="Status" value={s.label} testID="asap-stat-status" />
            {eta != null ? (
              <Stat label="ETA" value={`${Math.round(eta)} min`} testID="asap-stat-eta" />
            ) : distanceMiles != null ? (
              <Stat label="Distance" value={`${Number(distanceMiles).toFixed(1)} mi`} testID="asap-stat-distance" />
            ) : null}
            {price != null ? (
              <Stat label="Total" value={money(Number(price))} testID="asap-stat-price" />
            ) : null}
          </View>

          {driverParty ? (
            <DriverCard
              name={driverParty.name || booking?.assigned_driver_name || "Driver"}
              photo={driverParty.profile_photo}
              rating={driverParty.rating ?? booking?.assigned_driver_rating ?? null}
              jobs={driverParty.total_jobs ?? 0}
              phone={driverParty.phone}
            />
          ) : null}
          {s.variant === "payment_required" && bookingId ? (
            <PrimaryButton
              title={`Retry payment${price != null ? ` · ${money(Number(price))}` : ""}`}
              onPress={() => navigation.replace("Payment", { bookingId })}
              testID="asap-retry-payment"
            />
          ) : null}
          {(active || s.variant === "accepted") && bookingId && booking?.payment_status === "paid" ? (
            <PrimaryButton
              title="Message driver"
              onPress={() => navigation.navigate("BookingDetail", { bookingId, initialTab: "chat" })}
              testID="asap-message-driver"
            />
          ) : null}
          {collected && s.variant === "active" ? (
            <Text style={{ color: colors.inkMuted, fontSize: 12, textAlign: "center", marginTop: 8 }} testID="asap-cancel-unavailable-note">
              Items collected – cancellation is no longer available. Contact support if there's a problem.
            </Text>
          ) : null}
          {cancelable ? (
            <View style={{ marginTop: 8, gap: 6 }}>
              <SecondaryButton
                title={
                  cancelBusy
                    ? "Cancelling…"
                    : booking?.payment_status === "paid"
                      ? "Cancel & request refund"
                      : "Cancel booking"
                }
                onPress={onCancel}
                testID="asap-cancel"
              />
              {cancelError ? (
                <Text style={{ color: colors.errorInk, fontSize: 12, textAlign: "center" }} testID="asap-cancel-error">
                  {cancelError}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

/* ─── leaf components ─── */

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.7, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <View style={styles.pulseDotWrap}>
      <Animated.View style={[styles.pulseDotHalo, { transform: [{ scale }] }]} />
      <View style={styles.pulseDotCore} />
    </View>
  );
}

function PulseRing() {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 3.5, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);
  return <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />;
}

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.stat} testID={testID}>
      <Text style={typography.micro}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  navHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  locating: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgSecondary },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pinText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  driverDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  pulseRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#22C55E",
    top: 0,
    left: 0,
  },
  topBar: {
    position: "absolute",
    // R71.16 — bumped from 60 to 104 so the pulsing status pill
    // ("Looking for a driver near you") no longer visually overlaps the
    // AppShell Live Booking banner sitting at the top of the screen.
    top: 104,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#171717",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pillLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  pillSub: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  pulseDotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  pulseDotHalo: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4ADE80",
    opacity: 0.5,
  },
  pulseDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" },
  recenterFab: {
    position: "absolute",
    right: 16,
    bottom: 280,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  bottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    gap: 12,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    gap: 2,
  },
  statValue: { fontSize: 14, fontWeight: "700", color: colors.ink },
});
