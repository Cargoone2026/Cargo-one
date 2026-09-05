/**
 * BookingConfirmedScreen — post-payment success. Mirrors web
 * /customer/booking-confirmed/:id.
 *
 * R71 status-accuracy fix — ASAP jobs (service_timing === "asap") must
 * NOT show the generic "the driver has been notified" copy immediately
 * after payment, because for ASAP the driver-search only starts once
 * the deposit lands. Instead we immediately replace into the Uber-like
 * DispatchScreen which owns the true "Finding a driver → Driver
 * accepted → …" state machine (mirrors web CustomerDispatch).
 *
 * Standard (scheduled) bookings retain the confirmation success card.
 */
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CheckCircle2 } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Booking } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "BookingConfirmed">;

export function BookingConfirmedScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    let cancelled = false;
    CustomerAPI.bookingDetail(bookingId)
      .then((b) => {
        if (cancelled) return;
        setBooking(b);
        const isAsap = b?.service_timing === "asap" || b?.job?.service_timing === "asap";
        const jobId = b?.job_id || b?.job?.id;
        if (isAsap && jobId) {
          // ASAP: skip the static success card — go straight to the
          // Uber-like live driver-search experience.
          navigation.replace("Dispatch", { jobId });
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [bookingId, navigation]);

  return (
    <Page testID="booking-confirmed-screen" scroll={false}>
      <PageHeader
        title="Booked"
        onBack={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Bookings")
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 24, paddingVertical: 20, alignItems: "center", gap: 16 }}>
          <View style={styles.check}>
            <CheckCircle2 size={56} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={typography.h1Large}>Booking confirmed</Text>
          <Text style={[typography.body, { textAlign: "center", color: colors.inkMuted, lineHeight: 22 }]}>
            Your booking is in. You'll receive updates in Messages and can
            track the job live from your Bookings.
          </Text>
          {booking?.id ? (
            <Text style={styles.ref} testID="booking-confirmed-ref">
              Ref: {booking.id.slice(0, 8).toUpperCase()}
            </Text>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: 32 }}>
          <PrimaryButton
            title="View booking"
            onPress={() => navigation.replace("BookingDetail", { bookingId })}
            testID="confirmed-view-btn"
          />
          <SecondaryButton
            title="All bookings"
            onPress={() => navigation.navigate("Bookings")}
            testID="confirmed-bookings-btn"
          />
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 16,
  },
  ref: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 8,
    letterSpacing: 1.4,
    fontWeight: "600" as const,
  },
};
