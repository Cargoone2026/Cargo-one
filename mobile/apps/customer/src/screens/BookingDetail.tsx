/**
 * BookingDetailScreen — native equivalent of BookingDetail.jsx.
 * Shows status pill + title + route, then either the ActiveJobMap
 * (once paid + in transit) or a summary card. Actions: continue
 * payment, cancel, review.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Booking, CustomerAPI, SharedAPI, TrackingResponse, bookingPhase, contactVisible, money } from "@cargoone/core";
import { MapPin, Phone } from "lucide-react-native";
import { Page, PageHeader, PrimaryButton, StatusPill, SummaryRow } from "../ui";
import { colors, radius, typography } from "../theme";
import { ActiveJobMap } from "../ActiveJobMap";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

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
      <Page testID="booking-detail-loading">
        <PageHeader title="Booking" />
        <Text style={{ padding: 16, color: colors.inkMuted }}>Loading booking…</Text>
      </Page>
    );
  }

  const job = b.job;
  const phase = bookingPhase(b.status);
  const paid = b.payment_status === "paid";
  const showActiveMap = phase && paid;

  return (
    <Page testID="booking-detail-screen">
      <ScrollView>
        <PageHeader title={job?.title || "Booking"} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StatusPill status={b.status} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MapPin size={14} color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.inkMuted, flex: 1 }} numberOfLines={1}>
              {job?.pickup_town || "—"} → {job?.dropoff_town || "—"}
            </Text>
          </View>

          {showActiveMap ? (
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
              role="customer"
            />
          ) : (
            <View style={styles.card} testID="booking-summary-card">
              <Text style={typography.micro}>Booking summary</Text>
              <View style={{ marginTop: 8 }}>
                <SummaryRow label="Reference" value={b.id.slice(0, 8).toUpperCase()} />
                <SummaryRow label="Total" value={money(b.total_price)} emphasise />
                <SummaryRow label="Payment" value={b.payment_status || "—"} />
                {job?.pickup_address ? <SummaryRow label="Pickup" value={job.pickup_address} /> : null}
                {job?.dropoff_address ? <SummaryRow label="Delivery" value={job.dropoff_address} /> : null}
              </View>
            </View>
          )}

          <View style={{ gap: 8 }}>
            {b.payment_status === "pending" && (
              <PrimaryButton
                title="Continue to payment"
                onPress={() => navigation.navigate("Payment", { bookingId: b.id })}
                testID="continue-payment"
              />
            )}
            {b.status === "delivered" && (
              <PrimaryButton
                title="Leave a review"
                onPress={() =>
                  navigation.navigate("Review", { bookingId: b.id, driverId: b.driver_id || undefined })
                }
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

          {contactVisible(b) && b.driver_id ? (
            <View style={styles.card} testID="driver-contact-card">
              <Text style={typography.micro}>Your driver</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                <View style={styles.driverAvatar}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    {(b.job?.assigned_driver_name || "?").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.cardTitle}>{b.job?.assigned_driver_name || "Driver"}</Text>
                </View>
                <Phone size={20} color={colors.brand} />
              </View>
            </View>
          ) : null}
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
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
