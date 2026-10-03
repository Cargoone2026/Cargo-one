/**
 * LiveMap — full-bleed Mapbox canvas used by the Driver Live Mode
 * screen. Shows the driver's own heartbeat position as a blue puck and
 * one price pin per nearby ASAP offer. Tapping a pin raises
 * `onOfferPress(jobId)` so the parent can open the bottom sheet.
 *
 * Does NOT request location permission or read the device GPS — the
 * driver's lat/lng is supplied by the parent (which owns the Go-Online
 * flow and the 30s heartbeat loop). Keeps Phase-5 JobsMap/RouteMap
 * untouched; this is a new, Live-Mode-only component.
 */
import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { colors } from "../theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

export type LiveOffer = {
  job_id: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  accepted_price?: number | null;
};

export function LiveMap({
  driver,
  offers,
  onOfferPress,
  selectedJobId,
  recenterSignal,
  testID = "driver-live-map",
}: {
  driver: { lat: number; lng: number } | null;
  offers: LiveOffer[];
  onOfferPress: (jobId: string) => void;
  selectedJobId?: string | null;
  recenterSignal?: number;
  testID?: string;
}) {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);

  const geoOffers = useMemo(
    () =>
      offers.filter(
        (o) =>
          typeof o.pickup_lat === "number" &&
          typeof o.pickup_lng === "number" &&
          Number.isFinite(o.pickup_lat) &&
          Number.isFinite(o.pickup_lng),
      ),
    [offers],
  );

  // Camera default: tight around the driver when we have a fix,
  // UK-wide otherwise so the user never sees blank ocean.
  const defaultSettings = useMemo(() => {
    if (driver) {
      return {
        centerCoordinate: [driver.lng, driver.lat] as [number, number],
        zoomLevel: 13,
      };
    }
    return {
      centerCoordinate: [-1.5, 53] as [number, number],
      zoomLevel: 5,
    };
  }, [driver]);

  // Recenter on driver whenever recenterSignal bumps.
  React.useEffect(() => {
    if (!recenterSignal || !driver) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [driver.lng, driver.lat],
      zoomLevel: 14,
      animationDuration: 500,
    });
  }, [recenterSignal, driver]);

  const zoomBy = async (delta: number) => {
    const current = await mapRef.current?.getZoom();
    const next = Math.max(0, Math.min(22, (current ?? 13) + delta));
    cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 200 });
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Mapbox.MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.Street}
        scaleBarEnabled={false}
        compassEnabled
        logoEnabled={false}
        attributionEnabled={false}
        zoomEnabled
        scrollEnabled
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={defaultSettings}
          animationMode="flyTo"
          animationDuration={400}
        />

        {driver ? (
          <Mapbox.PointAnnotation
            id="driver-self"
            coordinate={[driver.lng, driver.lat]}
          >
            <View style={styles.selfOuter} testID="live-map-self">
              <View style={styles.selfInner} />
            </View>
          </Mapbox.PointAnnotation>
        ) : null}

        {geoOffers.map((o) => {
          const active = selectedJobId === o.job_id;
          const price = Math.round(Number(o.accepted_price || 0));
          return (
            <Mapbox.PointAnnotation
              key={o.job_id}
              id={`live-offer-${o.job_id}`}
              coordinate={[o.pickup_lng as number, o.pickup_lat as number]}
              onSelected={() => onOfferPress(o.job_id)}
            >
              <View
                style={[styles.pin, active && styles.pinActive]}
                testID={`live-map-pin-${o.job_id}`}
              >
                <Text style={styles.pinText}>£{price}</Text>
              </View>
            </Mapbox.PointAnnotation>
          );
        })}
      </Mapbox.MapView>

      {/* Left zoom controls — same hierarchy as Phase-5 JobsMap. */}
      <View style={styles.ctrlStack} pointerEvents="box-none">
        <Pressable
          onPress={() => zoomBy(1)}
          style={styles.ctrlBtn}
          testID="live-map-zoom-in"
        >
          <Text style={styles.ctrlArrow}>▲</Text>
        </Pressable>
        <Pressable
          onPress={() => zoomBy(-1)}
          style={styles.ctrlBtn}
          testID="live-map-zoom-out"
        >
          <Text style={styles.ctrlArrow}>▼</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgSecondary,
  },
  selfOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(37,99,235,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  selfInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pin: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinActive: {
    backgroundColor: colors.ink,
    transform: [{ scale: 1.1 }],
  },
  pinText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  ctrlStack: { position: "absolute", top: 90, left: 12, gap: 8 },
  ctrlBtn: {
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
  ctrlArrow: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 16,
    fontWeight: "700",
  },
});
