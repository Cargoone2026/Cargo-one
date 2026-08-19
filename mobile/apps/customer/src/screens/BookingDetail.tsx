import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Pressable, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Booking,
  CustomerAPI,
  SharedAPI,
  TrackingResponse,
  bookingPhase,
  contactVisible,
  money,
} from "@cargoone/core";
import { Body, CARGO, Card, H1, PrimaryButton, Screen } from "../ui";
import { ActiveJobMap } from "../ActiveJobMap";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

/**
 * Customer booking detail — mirrors the web `customer/BookingDetail.jsx`
 * layout. Native Mapbox active-job panel appears once the booking is
 * paid & in an active status (R68 phase mapping). Otherwise a compact
 * summary is shown instead. Contact info is gated by R37 (see
 * `contactVisible` in @cargoone/core).
 */
export function BookingDetailScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [b, setB] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);

  const load = useCallback(async () => {
    const bk = await CustomerAPI.bookingDetail(bookingId);
    setB(bk);
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!b || b.payment_status !== "paid") return;
    const iv = setInterval(async () => {
      try {
        const t = await SharedAPI.tracking(b.id);
        setTracking(t);
      } catch {
        /* ignore polling errors */
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [b]);

  if (!b) {
    return (
      <Screen>
        <Body muted>Loading booking…</Body>
      </Screen>
    );
  }

  const job = b.job;
  const phase = bookingPhase(b.status);
  const paid = b.payment_status === "paid";
  const showActiveMap = phase && paid;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase", letterSpacing: 1 }}>
        {b.status.replace("_", " ")}
      </Text>
      <H1>{job?.title || "Booking"}</H1>
      <Body muted style={{ marginTop: 4 }}>
        {job?.pickup_town || "—"} → {job?.dropoff_town || "—"}
      </Body>

      <View style={{ marginTop: 20 }}>
        {showActiveMap ? (
          <ActiveJobMap
            status={b.status}
            pickup={job?.pickup_lat != null ? { lat: job.pickup_lat!, lng: job.pickup_lng!, town: job.pickup_town, address: job.pickup_address } : null}
            dropoff={job?.dropoff_lat != null ? { lat: job.dropoff_lat!, lng: job.dropoff_lng!, town: job.dropoff_town, address: job.dropoff_address } : null}
            driver={tracking?.last_location ? { lat: tracking.last_location.lat, lng: tracking.last_location.lng } : null}
            etaMinutes={tracking?.eta_minutes ?? job?.duration_minutes ?? null}
            distanceMiles={tracking?.remaining_miles ?? job?.distance_miles ?? null}
            role="customer"
          />
        ) : (
          <Card testID="booking-summary-card">
            <Text style={{ fontSize: 15, fontWeight: "700", color: CARGO.ink }}>{money(b.total_price)}</Text>
            <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 4 }}>
              Payment: {b.payment_status}
            </Text>
          </Card>
        )}
      </View>

      <View style={{ marginTop: 20, gap: 8 }}>
        {b.payment_status === "pending" && (
          <PrimaryButton title="Continue to payment" onPress={() => navigation.navigate("Payment", { bookingId: b.id })} testID="continue-payment" />
        )}
        {b.status === "delivered" && (
          <PrimaryButton
            title="Leave a review"
            onPress={() => navigation.navigate("Review", { bookingId: b.id, driverId: b.driver_id || undefined })}
            testID="leave-review"
          />
        )}
        {["confirmed", "deposit_paid", "posted"].includes(b.status) && (
          <PrimaryButton
            title="Cancel booking"
            variant="secondary"
            onPress={() => {
              Alert.alert("Cancel booking?", "Cancellation fees may apply.", [
                { text: "Keep booking", style: "cancel" },
                {
                  text: "Cancel",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await CustomerAPI.cancelBooking(b.id);
                      load();
                    } catch (e: any) {
                      Alert.alert("Error", e?.message || "Could not cancel");
                    }
                  },
                },
              ]);
            }}
            testID="cancel-booking"
          />
        )}
      </View>

      {contactVisible(b) && b.driver_id && (
        <Card style={{ marginTop: 20 }} testID="driver-contact-card">
          <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase" }}>Your driver</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 4 }}>{b.job?.assigned_driver_name || "Driver"}</Text>
        </Card>
      )}
    </ScrollView>
  );
}
