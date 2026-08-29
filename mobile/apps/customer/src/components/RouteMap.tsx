/**
 * RouteMap — native equivalent of frontend
 * components/ui-portal/RouteMap.jsx. Renders a Mapbox map with pickup +
 * dropoff markers and fits the camera so both are visible. Optional
 * summary strip below the map matches the web summary layout.
 *
 * Interaction parity with ActiveJobMap (confirmed-booking map):
 *   • pinch-to-zoom + pan (Mapbox defaults, explicitly enabled)
 *   • compass control while rotated
 *   • recenter FAB to re-fit the pickup/dropoff bounds
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
  pickup,
  dropoff,
  height = 260,
  summary,
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
}) {
  const bounds = useMemo(() => {
    const ne = { lng: Math.max(pickup.lng, dropoff.lng), lat: Math.max(pickup.lat, dropoff.lat) };
    const sw = { lng: Math.min(pickup.lng, dropoff.lng), lat: Math.min(pickup.lat, dropoff.lat) };
    return { ne, sw };
  }, [pickup, dropoff]);

  const cameraRef = useRef<Mapbox.Camera>(null);
  const recenter = () => {
    cameraRef.current?.fitBounds(
      [bounds.ne.lng, bounds.ne.lat],
      [bounds.sw.lng, bounds.sw.lat],
      [40, 40, 40, 40],
      400,
    );
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
    <View style={{ borderRadius: radius.base, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
      <View style={{ height, backgroundColor: colors.bgSecondary }}>
        <Mapbox.MapView
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
        <Pressable
          onPress={recenter}
          style={styles.recenter}
          accessibilityRole="button"
          accessibilityLabel="Recenter map"
          testID="route-map-recenter"
        >
          <Text style={styles.recenterGlyph}>◎</Text>
        </Pressable>
        <View style={styles.topPill} pointerEvents="none">
          <Text style={styles.topPillText} testID="route-map-top-pill">
            Route preview
          </Text>
        </View>
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

const styles = StyleSheet.create({
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  recenter: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  recenterGlyph: { fontSize: 18, color: colors.ink, lineHeight: 20 },
  topPill: { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center" },
  topPillText: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    overflow: "hidden",
  },
  summary: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: 2,
  },
});
