/**
 * DispatchScreen — mirrors web /customer/dispatch/:jobId. Polls the
 * booking + tracking every 15 s to keep ETA and driver info fresh.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Booking, TrackingResponse } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton, SecondaryButton, StatusPill, SummaryRow } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Dispatch">;

export function DispatchScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  return (
    <Page testID="dispatch-screen">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <PageHeader title="Live dispatch" />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          {booking?.status ? <StatusPill status={booking.status} /> : null}
          <View style={styles.card}>
            <Text style={typography.micro}>Live info</Text>
            <View style={{ marginTop: 8 }}>
              <SummaryRow label="Booking" value={bookingId.slice(0, 8).toUpperCase()} />
              <SummaryRow label="Driver" value={(booking as any)?.driver_name || "Assigning…"} />
              <SummaryRow label="Vehicle" value={(booking as any)?.vehicle_label || "—"} />
              <SummaryRow
                label="ETA"
                value={(tracking as any)?.eta_minutes ? `${(tracking as any).eta_minutes} min` : "—"}
              />
              <SummaryRow
                label="Distance"
                value={
                  (tracking as any)?.distance_km ? `${(tracking as any).distance_km.toFixed(1)} km` : "—"
                }
              />
            </View>
          </View>
          <PrimaryButton
            title="Open live map"
            onPress={() => navigation.navigate("BookingDetail", { bookingId })}
            testID="dispatch-openmap-btn"
          />
          <SecondaryButton
            title="Message driver"
            onPress={() => navigation.navigate("Messages")}
            testID="dispatch-message-btn"
          />
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
