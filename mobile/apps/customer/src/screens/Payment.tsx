import React, { useState } from "react";
import { Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useStripe } from "@stripe/stripe-react-native";
import { CustomerAPI } from "@cargoone/core";
import { Body, H1, PrimaryButton, Screen } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Payment">;

/**
 * Native Stripe Payment Sheet. The backend creates the PaymentIntent
 * (unchanged R26/R40/R42 pricing) and we simply present its
 * client_secret through Stripe's native UI. On success we return to the
 * bookings list so the customer sees the newly paid booking at the top
 * (R70 newest-first).
 */
export function PaymentScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      const intent = await CustomerAPI.createCheckout(bookingId, "card");
      const init = await initPaymentSheet({
        paymentIntentClientSecret: intent.payment_intent_client_secret,
        merchantDisplayName: "Cargo One",
      });
      if (init.error) throw new Error(init.error.message);
      const res = await presentPaymentSheet();
      if (res.error) {
        if (res.error.code !== "Canceled") throw new Error(res.error.message);
        return;
      }
      Alert.alert("Payment confirmed", "You'll get an email receipt shortly.");
      navigation.navigate("Tabs");
    } catch (e: any) {
      Alert.alert("Payment error", e?.message || "Could not complete payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>Confirm payment</H1>
      <Body muted style={{ marginTop: 6, marginBottom: 20 }}>
        Cargo One uses Stripe for secure card payments.
      </Body>
      <PrimaryButton title="Pay with card" onPress={pay} loading={busy} testID="pay-card" />
    </Screen>
  );
}
