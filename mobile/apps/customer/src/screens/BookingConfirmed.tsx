/**
 * BookingConfirmedScreen — post-payment / post-booking success view.
 * Mirrors web /customer/booking-confirmed/:id. Shows a check icon,
 * the booking reference, and CTAs to view live tracking, view all
 * bookings, or go home.
 */
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Booking } from "@cargoone/core";
import { PrimaryButton, SecondaryButton } from "../ui";

const GREEN = "#16A34A";

type P = NativeStackScreenProps<RootStackParamList, "BookingConfirmed">;

export function BookingConfirmedScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    CustomerAPI.bookingDetail(bookingId).then(setBooking).catch(() => null);
  }, [bookingId]);

  return (
    <SafeAreaView style={styles.root} testID="booking-confirmed-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.check}><Text style={styles.checkGlyph}>✓</Text></View>
        <Text style={styles.title}>Booking confirmed</Text>
        <Text style={styles.subtitle}>
          Your booking is in and the driver has been notified. You'll
          receive updates in Messages and can track the job live from
          your Bookings.
        </Text>
        {booking?.id ? <Text style={styles.ref} testID="booking-confirmed-ref">Ref: {booking.id.slice(0, 8).toUpperCase()}</Text> : null}
        <View style={{ height: 32 }} />
        <PrimaryButton title="Track live" onPress={() => navigation.navigate("Dispatch", { bookingId })} testID="confirmed-track-btn" />
        <View style={{ height: 12 }} />
        <SecondaryButton title="View all bookings" onPress={() => navigation.navigate("Tabs")} testID="confirmed-bookings-btn" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  body: { padding: 24, alignItems: "center" },
  check: { width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginTop: 32, marginBottom: 24 },
  checkGlyph: { color: "#FFFFFF", fontSize: 44, fontWeight: "700", lineHeight: 48 },
  title: { fontSize: 26, fontWeight: "700", color: "#111827", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 15, lineHeight: 22, color: "#6B7280", textAlign: "center", paddingHorizontal: 12 },
  ref: { fontSize: 13, color: "#6B7280", marginTop: 16, letterSpacing: 1.2, fontWeight: "600" },
});
