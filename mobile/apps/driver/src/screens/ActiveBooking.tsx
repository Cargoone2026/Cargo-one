/**
 * ActiveBookingScreen — driver's live POD / progression flow.
 * Uses shared Cargo One primitives + ActiveJobMap. Preserves the
 * status-progression state machine and background location push
 * exactly as before.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { MapPin } from "lucide-react-native";
import { Booking, DriverAPI, SharedAPI, TrackingResponse } from "@cargoone/core";
import { Page, PageHeader, PrimaryButton, StatusPill, SummaryRow } from "../ui";
import { colors, radius, typography } from "../theme";
import { ActiveJobMap } from "../ActiveJobMap";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "ActiveBooking">;

const NEXT: Record<string, { key: string; label: string }> = {
  confirmed: { key: "travelling", label: "Start trip to pickup" },
  deposit_paid: { key: "travelling", label: "Start trip to pickup" },
  travelling: { key: "arrived", label: "Arrived at pickup" },
  arrived: { key: "collected", label: "Collected cargo" },
  collected: { key: "on_route", label: "On route to dropoff" },
  on_route: { key: "delivered", label: "Delivered" },
};

export function ActiveBookingScreen({ route }: P) {
  const { bookingId } = route.params;
  const [b, setB] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);

  const load = useCallback(async () => {
    setB(await DriverAPI.bookingDetail(bookingId));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!b || !["travelling", "arrived", "collected", "on_route"].includes(b.status)) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 8000 },
        (loc) => DriverAPI.pushLocation(loc.coords.latitude, loc.coords.longitude).catch(() => {}),
      );
    })();
    return () => {
      if (sub) sub.remove();
    };
  }, [b?.status]);

  useEffect(() => {
    if (!b) return;
    const iv = setInterval(async () => {
      try {
        setTracking(await SharedAPI.tracking(b.id));
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [b?.id]);

  if (!b) {
    return (
      <Page>
        <PageHeader title="Active job" />
        <Text style={{ padding: 16, color: colors.inkMuted }}>Loading booking…</Text>
      </Page>
    );
  }

  const next = NEXT[b.status];
  const currentBooking = b;
  const job = b.job;

  async function advance() {
    if (!next) return;
    try {
      const updated = await DriverAPI.progressStatus(currentBooking.id, next.key);
      setB(updated);
      if (next.key === "delivered") {
        Alert.alert("Job completed", "Nice work — your earnings are updated.");
      }
    } catch (e: any) {
      Alert.alert("Could not update status", e?.message || "");
    }
  }

  return (
    <Page testID="driver-active-booking">
      <ScrollView>
        <PageHeader title={job?.title || "Active job"} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StatusPill status={b.status} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MapPin size={14} color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.inkMuted, flex: 1 }} numberOfLines={1}>
              {job?.pickup_town || "—"} → {job?.dropoff_town || "—"}
            </Text>
          </View>

          <ActiveJobMap
            status={b.status}
            pickup={
              job?.pickup_lat != null
                ? { lat: job.pickup_lat!, lng: job.pickup_lng!, town: job.pickup_town, address: job.pickup_address }
                : null
            }
            dropoff={
              job?.dropoff_lat != null
                ? { lat: job.dropoff_lat!, lng: job.dropoff_lng!, town: job.dropoff_town, address: job.dropoff_address }
                : null
            }
            driver={tracking?.last_location ? { lat: tracking.last_location.lat, lng: tracking.last_location.lng } : null}
            etaMinutes={tracking?.eta_minutes ?? job?.duration_minutes ?? null}
            distanceMiles={tracking?.remaining_miles ?? job?.distance_miles ?? null}
            role="driver"
          />

          <View style={styles.card}>
            <Text style={typography.micro}>Booking details</Text>
            <View style={{ marginTop: 8 }}>
              <SummaryRow label="Reference" value={b.id.slice(0, 8).toUpperCase()} />
              <SummaryRow label="Customer" value={(b as any).customer_name || "—"} />
              {job?.pickup_address ? <SummaryRow label="Pickup" value={job.pickup_address} /> : null}
              {job?.dropoff_address ? <SummaryRow label="Delivery" value={job.dropoff_address} /> : null}
            </View>
          </View>

          {next ? <PrimaryButton title={next.label} onPress={advance} testID="progress-status" /> : null}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  card: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
