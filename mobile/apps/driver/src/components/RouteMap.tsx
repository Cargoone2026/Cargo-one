/**
 * RouteMap — Driver mobile mirror of the Customer RouteMap component
 * (visual parity exact), used by Job Detail and Booking Detail to show
 * a pickup → dropoff preview with route polyline. Interactions, bounds
 * fit, zoom/compass controls, and the top COLLECTION → DELIVERY strip
 * all match the Customer source of truth.
 *
 * Driver-local copy — Customer source remains untouched.
 */
import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { colors, radius, typography } from "../theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

interface Point {
  lat: number;
  lng: number;
  label?: string;
}

export function RouteMap({
  pickup, dropoff, height = 220, summary, testID,
}: {
  pickup: Point;
  dropoff: Point;
  height?: number;
  summary?: {
    pickupTown?: string;
    dropoffTown?: string;
    distanceMiles?: number;
    durationMinutes?: number;
  };
  testID?: string;
}) {
  const bounds = useMemo(() => {
    const ne = { lng: Math.max(pickup.lng, dropoff.lng), lat: Math.max(pickup.lat, dropoff.lat) };
    const sw = { lng: Math.min(pickup.lng, dropoff.lng), lat: Math.min(pickup.lat, dropoff.lat) };
    return { ne, sw };
  }, [pickup, dropoff]);

  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const recenter = () => {
    cameraRef.current?.fitBounds(
      [bounds.ne.lng, bounds.ne.lat],
      [bounds.sw.lng, bounds.sw.lat],
      [40, 40, 40, 40],
      400,
    );
  };
  const zoomBy = async (delta: number) => {
    const current = await mapRef.current?.getZoom();
    const next = Math.max(0, Math.min(22, (current ?? 10) + delta));
    cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 200 });
  };
  const zoomIn = () => zoomBy(1);
  const zoomOut = () => zoomBy(-1);
  const resetBearing = () => {
    cameraRef.current?.setCamera({ heading: 0, pitch: 0, animationDuration: 250 });
  };

  const routeGeoJSON: any = useMemo(
    () => ({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [pickup.lng, pickup.lat],
              [dropoff.lng, dropoff.lat],
            ],
          },
          properties: {},
        },
      ],
    }),
    [pickup, dropoff],
  );

  return (
    <View
      style={{ borderRadius: radius.base, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}
      testID={testID}
    >
      <View style={{ height, backgroundColor: colors.bgSecondary }}>
        <Mapbox.MapView
          ref={mapRef}
          style={{ flex: 1 }}
          styleURL={Mapbox.StyleURL.Street}
          scaleBarEnabled={false}
          compassEnabled={true}
          logoEnabled={false}
          attributionEnabled={false}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          onMapLoadingError={((e: any) =>
            console.log('[DriverMapError]', JSON.stringify(e?.nativeEvent))) as any}
        >
          <Mapbox.Camera
            ref={cameraRef}
            bounds={{
              ne: [bounds.ne.lng, bounds.ne.lat],
              sw: [bounds.sw.lng, bounds.sw.lat],
              paddingLeft: 40,
              paddingRight: 40,
              paddingTop: 40,
              paddingBottom: 40,
            }}
            animationDuration={400}
          />
          <Mapbox.ShapeSource id="route" shape={routeGeoJSON}>
            <Mapbox.LineLayer
              id="routeLine"
              style={{ lineColor: colors.brand, lineWidth: 3, lineCap: "round", lineJoin: "round" }}
            />
          </Mapbox.ShapeSource>
          <Mapbox.PointAnnotation id="pickup" coordinate={[pickup.lng, pickup.lat]}>
            <View style={[styles.pin, { backgroundColor: colors.success }]}>
              <Text style={styles.pinText}>P</Text>
            </View>
          </Mapbox.PointAnnotation>
          <Mapbox.PointAnnotation id="dropoff" coordinate={[dropoff.lng, dropoff.lat]}>
            <View style={[styles.pin, { backgroundColor: colors.brand }]}>
              <Text style={styles.pinText}>D</Text>
            </View>
          </Mapbox.PointAnnotation>
        </Mapbox.MapView>

        {/* Zoom / compass / recenter stack — left side */}
        <View style={styles.ctrlStack} pointerEvents="box-none">
          <Pressable onPress={zoomIn} style={styles.ctrlBtn} testID="route-map-zoom-in">
            <Text style={styles.ctrlArrow}>▲</Text>
          </Pressable>
          <Pressable onPress={zoomOut} style={styles.ctrlBtn} testID="route-map-zoom-out">
            <Text style={styles.ctrlArrow}>▼</Text>
          </Pressable>
          <Pressable onPress={resetBearing} style={styles.ctrlBtn} testID="route-map-compass">
            <Text style={styles.ctrlCompass}>N</Text>
          </Pressable>
          <Pressable onPress={recenter} style={styles.ctrlBtn} testID="route-map-recenter">
            <Text style={styles.recenterGlyph}>◎</Text>
          </Pressable>
        </View>

        {/* Full-width top COLLECTION → DELIVERY strip (parity w/ Customer) */}
        {summary?.pickupTown || summary?.dropoffTown ? (
          <View style={styles.topStrip} pointerEvents="none" testID="route-map-top-strip">
            <View style={styles.topStripCol}>
              <Text style={styles.topStripLabel}>COLLECTION</Text>
              <Text style={styles.topStripTown} numberOfLines={1}>
                {summary?.pickupTown || "—"}
              </Text>
            </View>
            <Text style={styles.topStripArrow}>→</Text>
            <View style={[styles.topStripCol, { alignItems: "flex-end" }]}>
              <Text style={styles.topStripLabel}>DELIVERY</Text>
              <Text style={styles.topStripTown} numberOfLines={1}>
                {summary?.dropoffTown || "—"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.topPill} pointerEvents="none">
            <Text style={styles.topPillText} testID="route-map-top-pill">Route preview</Text>
          </View>
        )}
      </View>

      {summary ? (
        <View style={styles.summary}>
          {summary.pickupTown || summary.dropoffTown ? (
            <Text style={[typography.small, { color: colors.ink, fontWeight: "600" }]}>
              {(summary.pickupTown || "—") + "  →  " + (summary.dropoffTown || "—")}
            </Text>
          ) : null}
          {summary.distanceMiles != null || summary.durationMinutes != null ? (
            <Text style={typography.small}>
              {summary.distanceMiles != null ? `${summary.distanceMiles} mi` : ""}
              {summary.distanceMiles != null && summary.durationMinutes != null ? "  ·  " : ""}
              {summary.durationMinutes != null
                ? summary.durationMinutes < 60
                  ? `${Math.round(summary.durationMinutes)} min`
                  : `${Math.floor(summary.durationMinutes / 60)}h ${Math.round(summary.durationMinutes % 60)}m`
                : ""}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * MapFallback — graceful placeholder when a job has no coordinates.
 * Visual parity: a soft card with pickup/dropoff towns inline.
 */
export function MapFallback({
  pickupTown, dropoffTown, height = 160, testID,
}: {
  pickupTown?: string | null;
  dropoffTown?: string | null;
  height?: number;
  testID?: string;
}) {
  return (
    <View
      style={[styles.fallback, { height }]}
      testID={testID}
    >
      <Text style={styles.fallbackLabel}>MAP UNAVAILABLE</Text>
      <Text style={styles.fallbackBody} numberOfLines={2}>
        {(pickupTown || "—") + "   →   " + (dropoffTown || "—")}
      </Text>
      <Text style={styles.fallbackHint}>Location coordinates are missing for this job.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  pinText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  recenterGlyph: { fontSize: 18, color: colors.ink, lineHeight: 20 },
  ctrlStack: { position: "absolute", top: 68, left: 12, gap: 8 },
  ctrlBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  ctrlArrow: { fontSize: 14, color: colors.ink, lineHeight: 16, fontWeight: "700" },
  ctrlCompass: { fontSize: 13, color: colors.brand, lineHeight: 15, fontWeight: "800" },
  topPill: { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center" },
  topPillText: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
    fontSize: 12, fontWeight: "700", color: colors.ink, overflow: "hidden",
  },
  topStrip: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  topStripCol: { flex: 1, minWidth: 0 },
  topStripLabel: {
    fontSize: 10, fontWeight: "800", letterSpacing: 1,
    color: colors.inkMuted, marginBottom: 2,
  },
  topStripTown: { fontSize: 14, fontWeight: "700", color: colors.ink },
  topStripArrow: { fontSize: 20, color: colors.brand, fontWeight: "700" },
  summary: {
    padding: 12, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg, gap: 2,
  },
  fallback: {
    borderRadius: radius.base,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
    padding: 16, gap: 6,
  },
  fallbackLabel: {
    fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: colors.inkMuted,
  },
  fallbackBody: {
    fontSize: 14, fontWeight: "700", color: colors.ink, textAlign: "center",
  },
  fallbackHint: {
    fontSize: 12, color: colors.inkMuted, textAlign: "center",
  },
});
