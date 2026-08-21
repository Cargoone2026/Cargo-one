/**
 * DispatchScreen — live view of an accepted booking. Mirrors web
 * /customer/dispatch/:jobId. Refreshes booking + tracking every 15s
 * so the ETA/status stay live. Does not embed the full-featured
 * Mapbox tracking map yet (that's kept in the next parity pass);
 * instead it shows the essential status card + driver info + tap-out
 * to the full map view.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Booking, TrackingResponse } from "@cargoone/core";
import { PrimaryButton, SecondaryButton } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Dispatch">;

const RED = "#D62828";

export function DispatchScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [b, t] = await Promise.all([
        CustomerAPI.bookingDetail(bookingId),
        CustomerAPI.tracking(bookingId).catch(() => null),
      ]);
      setBooking(b);
      setTracking(t);
    } finally {
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const statusLabel = String(booking?.status || "…").replace(/_/g, " ");

  return (
    <SafeAreaView style={styles.root} testID="dispatch-screen">
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={RED} />}
      >
        <View style={[styles.statusBadge, styles.statusActive]}>
          <Text style={styles.statusLabel}>{statusLabel.toUpperCase()}</Text>
        </View>

        <View style={styles.card}>
          <InfoRow label="Booking" value={bookingId.slice(0, 8).toUpperCase()} />
          <InfoRow label="Driver" value={(booking as any)?.driver_name || "Assigning…"} />
          <InfoRow label="Vehicle" value={(booking as any)?.vehicle_label || "—"} />
          <InfoRow label="ETA" value={(tracking as any)?.eta_minutes ? `${(tracking as any).eta_minutes} min` : "—"} />
          <InfoRow label="Distance" value={(tracking as any)?.distance_km ? `${(tracking as any).distance_km.toFixed(1)} km` : "—"} />
        </View>

        <View style={{ height: 20 }} />
        <PrimaryButton
          title="Open live map"
          onPress={() => navigation.navigate("BookingDetail", { bookingId })}
          testID="dispatch-openmap-btn"
        />
        <View style={{ height: 12 }} />
        <SecondaryButton
          title="Message driver"
          onPress={() => navigation.navigate("Messages")}
          testID="dispatch-message-btn"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  body: { padding: 20 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 16 },
  statusActive: { backgroundColor: "#DCFCE7" },
  statusLabel: { color: "#166534", fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  row: { flexDirection: "row", padding: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  rowLabel: { width: 110, fontSize: 13, color: "#6B7280", fontWeight: "500" },
  rowValue: { flex: 1, fontSize: 14, color: "#111827" },
});
