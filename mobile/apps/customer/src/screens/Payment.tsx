/**
 * PaymentScreen — native Stripe Payment Sheet.
 */
import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useStripe } from "@stripe/stripe-react-native";
import { ShieldCheck, CreditCard } from "lucide-react-native";
import { CustomerAPI } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Payment">;

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
      navigation.replace("BookingConfirmed", { bookingId });
    } catch (e: any) {
      Alert.alert("Payment error", e?.message || "Could not complete payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page testID="payment-screen">
      <ScrollView>
        <PageHeader title="Confirm payment" subtitle="Cargo One uses Stripe for secure card payments." />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          <View style={styles.card}>
            <CreditCard size={24} color={colors.brand} />
            <Text style={[typography.body, { marginTop: 8, lineHeight: 20 }]}>
              Only the Cargo One booking fee is charged now via Stripe. The driver charge is paid on delivery.
            </Text>
          </View>
          <PrimaryButton title="Pay with card" onPress={pay} loading={busy} testID="pay-card" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <ShieldCheck size={14} color={colors.inkMuted} />
            <Text style={typography.small}>PCI-compliant Stripe Payment Sheet</Text>
          </View>
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
