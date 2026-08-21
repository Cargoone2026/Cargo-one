/**
 * BookingConfirmedScreen — post-payment success. Mirrors web
 * /customer/booking-confirmed/:id.
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
    CustomerAPI.bookingDetail(bookingId).then(setBooking).catch(() => null);
  }, [bookingId]);

  return (
    <Page testID="booking-confirmed-screen">
      <ScrollView>
        <PageHeader title="Booked" />
        <View style={{ paddingHorizontal: 24, paddingVertical: 20, alignItems: "center", gap: 16 }}>
          <View style={styles.check}>
            <CheckCircle2 size={56} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={typography.h1Large}>Booking confirmed</Text>
          <Text style={[typography.body, { textAlign: "center", color: colors.inkMuted, lineHeight: 22 }]}>
            Your booking is in and the driver has been notified. You'll receive updates in Messages and can track the
            job live from your Bookings.
          </Text>
          {booking?.id ? (
            <Text style={styles.ref} testID="booking-confirmed-ref">
              Ref: {booking.id.slice(0, 8).toUpperCase()}
            </Text>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: 32 }}>
          <PrimaryButton
            title="Track live"
            onPress={() => navigation.navigate("Dispatch", { bookingId })}
            testID="confirmed-track-btn"
          />
          <SecondaryButton
            title="View all bookings"
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
