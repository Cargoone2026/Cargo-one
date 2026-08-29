/**
 * PaymentScreen — Stripe Checkout Session (mirrors web contract).
 *
 * The backend exposes ONE payment endpoint: POST /bookings/{id}/deposit,
 * which returns a Stripe Checkout Session `url`. Web redirects the browser
 * to it; on native we hand the URL to the system browser via Linking
 * (Safari on iOS). When the user returns to the app we poll
 * GET /payments/status/{session_id} until the deposit is marked paid,
 * then push through to BookingConfirmed.
 *
 * NO fake success, NO Stripe bypass, NO new backend endpoint. This is the
 * same session_id / webhook / status pipeline used by the web portal.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CreditCard, ShieldCheck } from "lucide-react-native";
import { CustomerAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Payment">;

// Backend uses `${origin_url}/customer/booking/{id}?payment=success` as the
// success return URL. On native the user simply comes back to the app so
// the value here is only used by Stripe to render the "Return to Cargo One"
// button after payment — the app itself polls /payments/status.
const ORIGIN_URL = "https://cargoone.co.uk";

export function PaymentScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
  }, []);

  const finalizeIfPaid = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return false;
    try {
      const s = await CustomerAPI.paymentStatus(sid);
      if (s.payment_status === "paid") {
        stopPolling();
        navigation.replace("BookingConfirmed", { bookingId });
        return true;
      }
    } catch {
      // /payments/status is public; a transient error just delays the check.
    }
    return false;
  }, [bookingId, navigation, stopPolling]);

  // Poll once every 3s while a checkout session is open, and once on every
  // return-to-foreground (covers the case where the user just cancelled or
  // finished payment in Safari and came back).
  const startPolling = useCallback(() => {
    stopPolling();
    setPolling(true);
    pollTimerRef.current = setInterval(finalizeIfPaid, 3000);
  }, [finalizeIfPaid, stopPolling]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && sessionIdRef.current) {
        // Fire an immediate check + keep the ticker running.
        finalizeIfPaid();
      }
    });
    return () => {
      sub.remove();
      stopPolling();
    };
  }, [finalizeIfPaid, stopPolling]);

  const pay = async () => {
    setBusy(true);
    try {
      const { session_id, url } = await CustomerAPI.createCheckout(bookingId, ORIGIN_URL);
      sessionIdRef.current = session_id;
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error("Could not open the payment page.");
      await Linking.openURL(url);
      startPolling();
    } catch (e: any) {
      Alert.alert("Payment error", e?.message || "Could not start payment.");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Bookings");

  return (
    <Page testID="payment-screen" scroll={false}>
      <PageHeader
        title="Confirm payment"
        subtitle="Cargo One uses Stripe for secure card payments."
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
        <View style={styles.card}>
          <CreditCard size={24} color={colors.brand} />
          <Text style={[typography.body, { marginTop: 8, lineHeight: 20 }]}>
            Only the Cargo One booking fee is charged now via Stripe. The driver charge is paid on delivery.
          </Text>
        </View>

        <PrimaryButton
          title={polling ? "Waiting for payment…" : "Pay with card"}
          onPress={pay}
          loading={busy}
          disabled={polling}
          testID="pay-card"
        />

        {polling ? (
          <View style={styles.pollingRow} testID="payment-polling">
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={[typography.small, { marginLeft: 8 }]}>
              Complete payment in your browser then return to the app. We'll take you to your booking automatically.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
          <ShieldCheck size={14} color={colors.inkMuted} />
          <Text style={typography.small}>PCI-compliant Stripe Checkout</Text>
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
  pollingRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    padding: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
};
