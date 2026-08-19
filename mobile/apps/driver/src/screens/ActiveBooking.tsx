import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { Booking, DriverAPI, SharedAPI, TrackingResponse, bookingPhase } from "@cargoone/core";
import { Body, CARGO, H1, PrimaryButton, Screen } from "../ui";
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

export function ActiveBookingScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [b, setB] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);

  const load = useCallback(async () => {
    setB(await DriverAPI.bookingDetail(bookingId));
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Push our location every 8s so the customer's map (and R61 tracking)
  // stays fresh. The server-side ASAP tracking record is already live.
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
    return () => { if (sub) sub.remove(); };
  }, [b?.status]);

  // Poll our own tracking record so the map + ETA/distance update.
  useEffect(() => {
    if (!b) return;
    const iv = setInterval(async () => {
      try { setTracking(await SharedAPI.tracking(b.id)); } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(iv);
  }, [b?.id]);

  if (!b) return <Screen><Body muted>Loading booking…</Body></Screen>;

  const next = NEXT[b.status];
  const job = b.job;

  async function advance() {
    if (!next) return;
    try {
      const updated = await DriverAPI.progressStatus(b!.id, next.key);
      setB(updated);
      if (next.key === "delivered") {
        Alert.alert("Job completed", "Nice work — your earnings are updated.");
      }
    } catch (e: any) {
      Alert.alert("Could not update status", e?.message || "");
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase", letterSpacing: 1 }}>
        {b.status.replace("_", " ")}
      </Text>
      <H1>{job?.title || "Active job"}</H1>
      <Body muted style={{ marginTop: 4 }}>{job?.pickup_town} → {job?.dropoff_town}</Body>

      <View style={{ marginTop: 20 }}>
        <ActiveJobMap
          status={b.status}
          pickup={job?.pickup_lat != null ? { lat: job.pickup_lat!, lng: job.pickup_lng!, town: job.pickup_town, address: job.pickup_address } : null}
          dropoff={job?.dropoff_lat != null ? { lat: job.dropoff_lat!, lng: job.dropoff_lng!, town: job.dropoff_town, address: job.dropoff_address } : null}
          driver={tracking?.last_location ? { lat: tracking.last_location.lat, lng: tracking.last_location.lng } : null}
          etaMinutes={tracking?.eta_minutes ?? job?.duration_minutes ?? null}
          distanceMiles={tracking?.remaining_miles ?? job?.distance_miles ?? null}
          role="driver"
        />
      </View>

      {next && (
        <View style={{ marginTop: 20 }}>
          <PrimaryButton title={next.label} onPress={advance} testID="progress-status" />
        </View>
      )}
    </ScrollView>
  );
}
