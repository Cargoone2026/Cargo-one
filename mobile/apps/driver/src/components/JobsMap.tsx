/**
 * JobsMap — full-bleed Mapbox map used in the Driver Available Jobs
 * "Map" view. Mirrors Driver web Jobs.jsx map behaviour: shows one
 * marker per job pickup, fits the camera to all markers, and lets the
 * user tap a marker to see a bottom-sheet preview (price, pickup →
 * dropoff, distance) with a "View job" CTA.
 *
 * Live Mode is OUT of scope here — no user-location, no permission
 * requests, no heartbeat. The map is a static-camera presentation of
 * the already-filtered jobs list produced by AvailableJobs.tsx.
 */
import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import type { Job } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Icon, PrimaryButton } from "../ui";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

export type JobsMapJob = Job & {
  pickup_lat?: number | null;
  pickup_lng?: number | null;
};

function hasCoord(j: Job): j is JobsMapJob & { pickup_lat: number; pickup_lng: number } {
  return typeof j.pickup_lat === "number"
    && typeof j.pickup_lng === "number"
    && Number.isFinite(j.pickup_lat)
    && Number.isFinite(j.pickup_lng);
}

export function JobsMap({
  jobs, onOpenJob, testID = "driver-jobs-map",
}: {
  jobs: Job[];
  onOpenJob: (job: Job) => void;
  testID?: string;
}) {
  const [selected, setSelected] = useState<Job | null>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);

  const geoJobs = useMemo(() => jobs.filter(hasCoord), [jobs]);

  // Compute bounds covering all pickup markers. If only one, keep a
  // small window around it; if none, default to a UK-wide view so the
  // user sees land not blue ocean.
  const bounds = useMemo(() => {
    if (geoJobs.length === 0) {
      return { ne: [1.76, 58.68] as [number, number], sw: [-6.42, 49.9] as [number, number] };
    }
    const lats = geoJobs.map((j) => j.pickup_lat);
    const lngs = geoJobs.map((j) => j.pickup_lng);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    if (geoJobs.length === 1) {
      // Small window around the single marker.
      return {
        ne: [ne[0] + 0.08, ne[1] + 0.08] as [number, number],
        sw: [sw[0] - 0.08, sw[1] - 0.08] as [number, number],
      };
    }
    return { ne, sw };
  }, [geoJobs]);

  const recenter = () => {
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [60, 40, 60, 40], 400);
  };
  const zoomBy = async (delta: number) => {
    const current = await mapRef.current?.getZoom();
    const next = Math.max(0, Math.min(22, (current ?? 6) + delta));
    cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 200 });
  };

  const closeSheet = () => setSelected(null);

  return (
    <View style={styles.wrap} testID={testID}>
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
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={closeSheet}
      >
        <Mapbox.Camera
          ref={cameraRef}
          bounds={{
            ne: bounds.ne,
            sw: bounds.sw,
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 60,
            paddingBottom: 60,
          }}
          animationDuration={400}
        />
        {geoJobs.map((j) => {
          const active = selected?.id === j.id;
          return (
            <Mapbox.PointAnnotation
              key={j.id}
              id={`job-${j.id}`}
              coordinate={[j.pickup_lng, j.pickup_lat]}
              onSelected={() => setSelected(j)}
            >
              <View
                style={[
                  styles.pin,
                  active && styles.pinActive,
                ]}
                testID={`jobs-map-pin-${j.id}`}
              >
                <Text style={styles.pinText}>
                  £{Math.round(Number(j.fixed_price ?? (j as any).suggested_price ?? (j as any).max_budget ?? 0))}
                </Text>
              </View>
            </Mapbox.PointAnnotation>
          );
        })}
      </Mapbox.MapView>

      {/* Zoom + recenter controls — left stack */}
      <View style={styles.ctrlStack} pointerEvents="box-none">
        <Pressable onPress={() => zoomBy(1)} style={styles.ctrlBtn} testID="jobs-map-zoom-in">
          <Text style={styles.ctrlArrow}>▲</Text>
        </Pressable>
        <Pressable onPress={() => zoomBy(-1)} style={styles.ctrlBtn} testID="jobs-map-zoom-out">
          <Text style={styles.ctrlArrow}>▼</Text>
        </Pressable>
        <Pressable onPress={recenter} style={styles.ctrlBtn} testID="jobs-map-recenter">
          <Text style={styles.recenterGlyph}>◎</Text>
        </Pressable>
      </View>

      {/* Count pill — top-right (parity with web top-right count) */}
      <View style={styles.countPill} pointerEvents="none">
        <Text style={styles.countPillText}>
          {geoJobs.length} on map · {jobs.length - geoJobs.length} hidden
        </Text>
      </View>

      {/* Empty state over the map when nothing is eligible */}
      {jobs.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none" testID="jobs-map-empty">
          <View style={styles.emptyBubble}>
            <Text style={styles.emptyBubbleText}>No eligible jobs in this filter</Text>
          </View>
        </View>
      ) : null}

      {/* Marker bottom-sheet */}
      {selected ? (
        <BottomSheet
          job={selected}
          onClose={closeSheet}
          onOpenJob={() => {
            const target = selected;
            setSelected(null);
            onOpenJob(target);
          }}
        />
      ) : null}
    </View>
  );
}

function BottomSheet({
  job, onClose, onOpenJob,
}: {
  job: Job;
  onClose: () => void;
  onOpenJob: () => void;
}) {
  const price = job.pricing_type === "fixed"
    ? job.fixed_price
    : ((job as any).suggested_price || (job as any).max_budget);
  const priceLabel = job.pricing_type === "fixed" ? "Earn" : "Max bid";
  return (
    <View style={styles.sheet} testID="jobs-map-sheet">
      <View style={styles.sheetHandle} />
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sheetEyebrow}>
            {job.service_timing === "asap" ? "ASAP" : "Scheduled"}
            {" · "}
            {job.pricing_type === "fixed" ? "Fixed" : "Bidding"}
          </Text>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {job.title || `${job.pickup_town || "—"} → ${job.dropoff_town || "—"}`}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          testID="jobs-map-sheet-close"
          style={styles.sheetClose}
        >
          <Icon name="x" size={16} color={colors.inkMuted} />
        </Pressable>
      </View>

      <View style={styles.sheetRouteRow}>
        <View style={styles.dotPickup} />
        <Text style={styles.sheetRouteText} numberOfLines={1}>
          {job.pickup_town || "—"}
        </Text>
        <Text style={styles.sheetRouteArrow}>→</Text>
        <View style={styles.dotDropoff} />
        <Text style={styles.sheetRouteText} numberOfLines={1}>
          {job.dropoff_town || "—"}
        </Text>
      </View>

      <View style={styles.sheetMetaRow}>
        {job.distance_miles != null ? (
          <Text style={typography.small}>{job.distance_miles} mi job</Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <View style={styles.pricePill}>
          <Text style={styles.pricePillLabel}>{priceLabel}</Text>
          <Text style={styles.pricePillValue}>£{Number(price || 0).toFixed(0)}</Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <PrimaryButton
          title="View job"
          onPress={onOpenJob}
          testID="jobs-map-sheet-view"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
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
  ctrlStack: { position: "absolute", top: 60, left: 12, gap: 8 },
  ctrlBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  ctrlArrow: { fontSize: 14, color: colors.ink, lineHeight: 16, fontWeight: "700" },
  recenterGlyph: { fontSize: 18, color: colors.ink, lineHeight: 20 },
  countPill: {
    position: "absolute", top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  countPillText: { fontSize: 11, fontWeight: "700", color: colors.ink },
  emptyOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  emptyBubble: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyBubbleText: { fontSize: 13, fontWeight: "700", color: colors.inkMuted },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: colors.hairline,
    marginBottom: 10,
  },
  sheetEyebrow: {
    fontSize: 10, fontWeight: "800", letterSpacing: 1.2,
    color: colors.brand, textTransform: "uppercase",
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 2 },
  sheetClose: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.bgSecondary,
  },
  sheetRouteRow: {
    marginTop: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  dotPickup: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  dotDropoff: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  sheetRouteText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink, minWidth: 0 },
  sheetRouteArrow: { fontSize: 14, color: colors.inkMuted },
  sheetMetaRow: {
    marginTop: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  pricePill: {
    flexDirection: "row", alignItems: "baseline", gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: colors.bgSecondary,
  },
  pricePillLabel: {
    fontSize: 10, fontWeight: "800", letterSpacing: 0.6,
    color: colors.inkMuted, textTransform: "uppercase",
  },
  pricePillValue: { fontSize: 14, fontWeight: "800", color: colors.ink },
});
