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
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LocateFixed, X as XIcon } from "lucide-react-native";
import {
  Booking,
  CustomerAPI,
  DispatchState,
  Job,
  TrackingResponse,
  bookingPhase,
  money,
} from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { Page, PrimaryButton, SecondaryButton } from "../ui";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

type P = NativeStackScreenProps<RootStackParamList, "Dispatch">;

const DISPATCH_POLL_MS = 4000;
const BOOKING_POLL_MS = 5000;
const TRACKING_POLL_MS = 6000;

/**
 * Given the current backend state, produce (label, variant, pulsing).
 * Mirrors the copy from web Dispatch.jsx state machine.
 */
function stateFor(
  dispatch: DispatchState | null,
  booking: Booking | null,
): { label: string; sub?: string; pulse: boolean; variant: "searching" | "accepted" | "active" | "done" | "cancelled" } {
  if (dispatch?.cancelled_at || booking?.status === "cancelled") {
    return { label: "Booking cancelled", pulse: false, variant: "cancelled" };
  }
  const status = booking?.status || dispatch?.status;
  if (status === "delivered" || status === "completed") {
    return { label: "Delivered", pulse: false, variant: "done" };
  }
  const phase = bookingPhase(status);
  if (phase === "to_pickup") return { label: "Driver on the way", pulse: true, variant: "active" };
  if (phase === "arrived") return { label: "Driver arriving", pulse: true, variant: "active" };
  if (phase === "to_dropoff") return { label: "Job in progress", pulse: true, variant: "active" };
  if (booking?.assigned_driver_id || dispatch?.assigned_driver_id) {
    return { label: "Driver accepted", sub: booking?.assigned_driver_name || dispatch?.assigned_driver_name || "", pulse: false, variant: "accepted" };
  }
  if (!booking?.paid_at && booking?.payment_status !== "paid") {
    return { label: "Finalising booking", pulse: true, variant: "searching" };
  }
  return { label: "Looking for a driver near you", pulse: true, variant: "searching" };
}

export function DispatchScreen({ route, navigation }: P) {
  const { jobId } = route.params;

  const [dispatch, setDispatch] = useState<DispatchState | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);

  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const [recenterTick, setRecenterTick] = useState(0);

  // ─── Poll /customer/dispatch/{jobId} ───
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await CustomerAPI.dispatchState(jobId);
        if (!cancelled) setDispatch(d);
      } catch {
        /* ignore transient */
      }
    };
    load();
    const iv = setInterval(load, DISPATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [jobId]);

  // ─── Poll /bookings/{bookingId} once we know the booking id ───
  const bookingId = booking?.id || dispatch?.booking_id || null;
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
  }, [bookingId]);

  // ─── Poll /tracking/{bookingId} only while active ───
  const status = booking?.status || dispatch?.status;
  const active = !!bookingPhase(status);
  useEffect(() => {
    if (!bookingId || !active) return;
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
  }, [bookingId, active]);

  // ─── Geometry ───
  const pickupPt = useMemo(
    () =>
      dispatch?.pickup_lat != null && dispatch?.pickup_lng != null
        ? { lat: dispatch.pickup_lat, lng: dispatch.pickup_lng }
        : booking?.job?.pickup_lat != null && booking?.job?.pickup_lng != null
        ? { lat: booking.job.pickup_lat!, lng: booking.job.pickup_lng! }
        : null,
    [dispatch, booking],
  );
  const dropoffPt = useMemo(
    () =>
      dispatch?.dropoff_lat != null && dispatch?.dropoff_lng != null
        ? { lat: dispatch.dropoff_lat, lng: dispatch.dropoff_lng }
        : booking?.job?.dropoff_lat != null && booking?.job?.dropoff_lng != null
        ? { lat: booking.job.dropoff_lat!, lng: booking.job.dropoff_lng! }
        : null,
    [dispatch, booking],
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
  const s = stateFor(dispatch, booking);
  const showSweep = s.variant === "searching" && pickupPt != null;
  const cancelable = !!bookingId && !s.variant.startsWith("done") && s.variant !== "cancelled" && !active;

  const onCancel = useCallback(async () => {
    if (!bookingId) return;
    try {
      await CustomerAPI.cancelBooking(bookingId);
    } catch {
      /* ignore — user can retry from BookingDetail */
    }
    navigation.replace("BookingDetail", { bookingId });
  }, [bookingId, navigation]);

  const distanceMiles = booking?.job?.distance_miles ?? dispatch?.search_radius_miles ?? null;
  const eta = tracking?.eta_minutes ?? null;
  const price = booking?.total_price ?? booking?.customer_total ?? null;

  return (
    <Page testID="asap-dispatch-screen" scroll={false}>
      <View style={styles.root}>
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
            <View style={styles.locating}>
              <Text style={typography.small}>Preparing your route…</Text>
            </View>
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

          {active || s.variant === "accepted" ? (
            <PrimaryButton
              title="Open live tracking"
              onPress={() => bookingId && navigation.replace("BookingDetail", { bookingId })}
              testID="asap-open-tracking"
            />
          ) : null}
          {cancelable ? (
            <View style={{ marginTop: 8 }}>
              <SecondaryButton title="Cancel booking" onPress={onCancel} testID="asap-cancel" />
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
    top: 12,
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
