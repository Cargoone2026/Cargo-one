/**
 * ActiveJobMap — native Mapbox composition used by Customer & Driver apps.
 *
 * Renders:
 *   • the full-bleed Mapbox map (@rnmapbox/maps)
 *   • pickup marker (green)
 *   • dropoff marker (red)
 *   • driver marker (blue) when live coords are supplied
 *   • a straight-line route between pickup/dropoff (a real Directions
 *     polyline is drawn if the caller supplies `routeCoords` — the
 *     backend already returns route coordinates via Mapbox Directions;
 *     Phase 2 will fetch that here directly)
 *   • ETA + distance destination card (matches web R68 hierarchy)
 *   • Recenter FAB (R58 parity)
 *   • Navigate CTA (driver role only, iOS = maps://, Android = google.navigation:)
 *
 * NO Google. NO react-native-maps. NO WebView. Native Mapbox is the ONLY
 * in-app map renderer. If Mapbox can't render (e.g. dev environment
 * without the download token) the screen shows a clear "Mapbox not
 * configured" state — it never silently falls back to another provider.
 */
import React, { useMemo, useRef } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import {
  bookingPhase,
  buildNativeNavigationUrl,
  buildNavigationFallbackUrl,
  eta as fmtEta,
  miles as fmtMiles,
  navigateTargetForPhase,
  type JobPoint,
} from "@cargoone/core";
import { CARGO } from "./ui";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

interface Props {
  status: string;
  pickup: JobPoint | null;
  dropoff: JobPoint | null;
  driver: { lat: number; lng: number } | null;
  etaMinutes?: number | null;
  distanceMiles?: number | null;
  role: "customer" | "driver";
  routeCoords?: [number, number][]; // [lng, lat] pairs for the polyline
}

export function ActiveJobMap({
  status,
  pickup,
  dropoff,
  driver,
  etaMinutes,
  distanceMiles,
  role,
  routeCoords,
}: Props) {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const phase = bookingPhase(status);
  const target = navigateTargetForPhase(phase, { pickup_lat: pickup?.lat, pickup_lng: pickup?.lng, dropoff_lat: dropoff?.lat, dropoff_lng: dropoff?.lng });

  const bounds = useMemo(() => {
    const pts = [pickup, dropoff, driver].filter(Boolean) as Array<{ lat: number; lng: number }>;
    if (pts.length === 0) return null;
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    };
  }, [pickup, dropoff, driver]);

  const recenter = () => {
    if (!cameraRef.current || !bounds) return;
    cameraRef.current.fitBounds(bounds.ne, bounds.sw, [80, 40, 200, 40], 800);
  };

  const straightLine = useMemo(() => {
    if (routeCoords?.length) return routeCoords;
    if (pickup && dropoff) return [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]] as [number, number][];
    return null;
  }, [pickup, dropoff, routeCoords]);

  const onNavigate = async () => {
    if (!target) return;
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "desktop";
    const primary = buildNativeNavigationUrl(target, platform);
    const fallback = buildNavigationFallbackUrl(target, platform);
    try {
      if (primary && (await Linking.canOpenURL(primary))) {
        await Linking.openURL(primary);
        return;
      }
      if (fallback) {
        await Linking.openURL(fallback);
        return;
      }
    } catch (e: any) {
      Alert.alert("Navigation error", e?.message || "Could not open your maps app");
    }
  };

  const isCompleted = phase === "completed";
  const phaseLabel = isCompleted
    ? "Job completed"
    : phase === "arrived"
      ? role === "driver" ? "Arrived on-scene" : "Driver on-scene"
      : phase === "to_dropoff"
        ? role === "driver" ? "On route to dropoff" : "Driver on route to you"
        : role === "driver" ? "On route to pickup" : "Driver on the way";

  return (
    <View style={styles.wrap}>
      <View style={styles.mapWrap}>
        <Mapbox.MapView style={StyleSheet.absoluteFill} styleURL={Mapbox.StyleURL.Street} logoEnabled={false} attributionEnabled compassEnabled>
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              bounds: bounds ?? undefined,
              zoomLevel: bounds ? undefined : 5,
              centerCoordinate: bounds ? undefined : [-1.5, 53],
            }}
            padding={{ paddingTop: 80, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 }}
            animationMode="flyTo"
            animationDuration={800}
          />
          {straightLine && (
            <Mapbox.ShapeSource id="route" shape={{ type: "Feature", geometry: { type: "LineString", coordinates: straightLine }, properties: {} } as any}>
              <Mapbox.LineLayer id="route-line" style={{ lineColor: CARGO.red, lineWidth: 4, lineCap: "round", lineJoin: "round" }} />
            </Mapbox.ShapeSource>
          )}
          {pickup && (
            <Mapbox.PointAnnotation id="pickup" coordinate={[pickup.lng, pickup.lat]}>
              <View style={[styles.marker, { backgroundColor: CARGO.green }]}>
                <Text style={styles.markerText}>P</Text>
              </View>
            </Mapbox.PointAnnotation>
          )}
          {dropoff && (
            <Mapbox.PointAnnotation id="dropoff" coordinate={[dropoff.lng, dropoff.lat]}>
              <View style={[styles.marker, { backgroundColor: CARGO.red }]}>
                <Text style={styles.markerText}>D</Text>
              </View>
            </Mapbox.PointAnnotation>
          )}
          {driver && (
            <Mapbox.PointAnnotation id="driver" coordinate={[driver.lng, driver.lat]}>
              <View style={[styles.marker, styles.markerDriver]}>
                <Text style={[styles.markerText, { color: "#fff" }]}>•</Text>
              </View>
            </Mapbox.PointAnnotation>
          )}
        </Mapbox.MapView>

        <Pressable style={styles.recenter} onPress={recenter} accessibilityLabel="Recenter map" testID="active-map-recenter">
          <Text style={{ fontSize: 18 }}>◎</Text>
        </Pressable>
        <View style={styles.topPill} pointerEvents="none">
          <Text style={styles.topPillText} testID="active-map-top-pill">{phaseLabel}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel} testID="active-map-phase-label">{phaseLabel}</Text>
        <Text style={styles.cardTitle} numberOfLines={2} testID="active-map-title">
          {phase === "to_dropoff" || phase === "arrived"
            ? dropoff?.address || dropoff?.town || "Destination"
            : pickup?.address || pickup?.town || "Pickup"}
        </Text>
        {!isCompleted && (
          <View style={styles.stats}>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>ETA</Text>
              <Text style={styles.pillValue} testID="active-map-eta">{fmtEta(etaMinutes)}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>Distance</Text>
              <Text style={styles.pillValue} testID="active-map-distance">{fmtMiles(distanceMiles)}</Text>
            </View>
          </View>
        )}
        {role === "driver" && !isCompleted && target && (
          <Pressable style={styles.navBtn} onPress={onNavigate} testID="active-map-navigate" accessibilityRole="button" accessibilityLabel="Open turn-by-turn navigation in Apple Maps">
            <Text style={styles.navBtnText}>Navigate</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: CARGO.hairline, borderRadius: 20, overflow: "hidden", backgroundColor: "#fff" },
  mapWrap: { height: 360, position: "relative" },
  recenter: {
    position: "absolute", top: 12, left: 12,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  topPill: { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center" },
  topPillText: {
    backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 999, fontSize: 12, fontWeight: "700", color: CARGO.ink,
    overflow: "hidden",
  },
  marker: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  markerDriver: { backgroundColor: "#2563EB", width: 20, height: 20 },
  markerText: { fontWeight: "800", color: "#fff", fontSize: 12 },
  card: { padding: 20 },
  cardLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: CARGO.muted },
  cardTitle: { fontSize: 20, fontWeight: "700", color: CARGO.ink, marginTop: 4 },
  stats: { flexDirection: "row", gap: 12, marginTop: 16 },
  pill: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F9FAFB" },
  pillLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", color: CARGO.muted },
  pillValue: { fontSize: 15, fontWeight: "800", color: CARGO.ink, marginTop: 2 },
  navBtn: { marginTop: 16, height: 48, borderRadius: 999, backgroundColor: CARGO.red, alignItems: "center", justifyContent: "center" },
  navBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

const CARGO_hairline = "#E5E7EB";
