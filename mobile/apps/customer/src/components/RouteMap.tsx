/**
 * RouteMap — native equivalent of frontend
 * components/ui-portal/RouteMap.jsx. Renders a Mapbox map with pickup +
 * dropoff markers and fits the camera so both are visible. Optional
 * summary strip below the map matches the web summary layout.
 */
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  height = 180,
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
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <Mapbox.Camera
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
  summary: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: 2,
  },
});
