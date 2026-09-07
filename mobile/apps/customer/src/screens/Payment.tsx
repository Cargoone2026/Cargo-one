/**
 * PaymentScreen — native Stripe PaymentSheet (R71).
 *
 * NEW native flow (replaces the old Linking → Safari → Checkout URL):
 *
 *   1. Call CustomerAPI.createDepositIntent(bookingId)
 *        → backend mints Customer + EphemeralKey + PaymentIntent
 *        → response carries publishable_key + client_secret + ephemeral_key
 *          + customer_id + amount
 *   2. Initialise Stripe PaymentSheet with those values.
 *   3. Present PaymentSheet inside the app (Apple Pay + card).
 *   4. On success → poll GET /payments/pi-status/{pi_id} until backend
 *      confirms paid, then push to BookingConfirmed. BookingConfirmed
 *      itself branches ASAP → Dispatch, keeping web parity.
 *   5. On failure → keep the booking (backend already persists it) and
 *      show "Retry payment" against the SAME PaymentIntent (no
 *      duplicate booking, no duplicate charge).
 *
 * No Safari, no Linking, no external browser. Retries reuse the same
 * PaymentIntent so double-taps / interruptions never produce duplicate
 * charges or bookings — protection is on the backend.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  ScrollView,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CreditCard, ShieldCheck, AlertTriangle } from "lucide-react-native";
import { initPaymentSheet, presentPaymentSheet, useStripe } from "@stripe/stripe-react-native";
import { CustomerAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Payment">;

export function PaymentScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const stripe = useStripe();

  const [initialising, setInitialising] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);

  const piIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
  }, []);

  // ─── Initialise PaymentSheet (idempotent — retries reuse same PI) ───
  const initSheet = useCallback(async () => {
    setInitError(null);
    setInitialising(true);
    try {
      const p = await CustomerAPI.createDepositIntent(bookingId);
      piIdRef.current = p.payment_intent_id;
      setDepositAmount(p.amount);
      const { error } = await initPaymentSheet({
        merchantDisplayName: "CargoOne",
        customerId: p.customer_id,
        customerEphemeralKeySecret: p.ephemeral_key,
        paymentIntentClientSecret: p.client_secret,
        allowsDelayedPaymentMethods: false,
        returnURL: "co.uk.cargoone.customer://stripe-redirect",
        applePay: { merchantCountryCode: "GB" },
        defaultBillingDetails: {},
        appearance: {
          colors: {
            primary: colors.brand,
            background: colors.bg,
          },
          shapes: { borderRadius: 10 },
        },
      });
      if (error) throw new Error(error.message);
    } catch (e: any) {
      setInitError(e?.message || "Could not start payment.");
    } finally {
      setInitialising(false);
    }
  }, [bookingId]);

  useEffect(() => {
    initSheet();
    return () => stopPolling();
  }, [initSheet, stopPolling]);

  // ─── Poll payment status until backend confirms paid ───
  const startPolling = useCallback(() => {
    const piId = piIdRef.current;
    if (!piId) return;
    stopPolling();
    setPolling(true);
    let tries = 0;
    pollTimerRef.current = setInterval(async () => {
      tries += 1;
      try {
        const s = await CustomerAPI.paymentIntentStatus(piId);
        if (s.payment_status === "paid") {
          stopPolling();
          navigation.replace("BookingConfirmed", { bookingId });
          return;
        }
        if (s.payment_status === "failed") {
          stopPolling();
          setPaymentError("Payment wasn't completed. Your booking is saved — tap Retry to try again.");
          return;
        }
      } catch {
        /* transient */
      }
      // Give up polling after ~60s; user can foreground the app to
      // trigger the AppState listener below which will re-poll.
      if (tries > 20) stopPolling();
    }, 3000);
  }, [bookingId, navigation, stopPolling]);

  // ─── Trigger PaymentSheet ───
  const onPay = useCallback(async () => {
    if (presenting || initialising) return;
    setPaymentError(null);
    setPresenting(true);
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        // Canceled by user is not an error we surface loudly.
        if (error.code !== "Canceled") {
          setPaymentError(error.message || "Payment failed. Your booking is saved — tap Retry to try again.");
        }
        return;
      }
      // Sheet dismissed with success — verify with backend before
      // navigating so we don't advance before the webhook lands.
      startPolling();
      // Also do one immediate probe (the webhook is usually faster
      // than our 3s poll interval).
      const piId = piIdRef.current!;
      try {
        const s = await CustomerAPI.paymentIntentStatus(piId);
        if (s.payment_status === "paid") {
          stopPolling();
          navigation.replace("BookingConfirmed", { bookingId });
        }
      } catch {
        /* fall through to polling */
      }
    } finally {
      setPresenting(false);
    }
  }, [presenting, initialising, bookingId, navigation, startPolling, stopPolling]);

  // ─── Re-check payment on app foreground (handles webhook-late case) ───
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s: AppStateStatus) => {
      if (s !== "active" || !piIdRef.current) return;
      try {
        const st = await CustomerAPI.paymentIntentStatus(piIdRef.current);
        if (st.payment_status === "paid") {
          stopPolling();
          navigation.replace("BookingConfirmed", { bookingId });
        }
      } catch { /* ignore */ }
    });
    return () => sub.remove();
  }, [bookingId, navigation, stopPolling]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Bookings"));

  return (
    <Page testID="payment-screen" scroll={false}>
      <PageHeader title="Complete deposit" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.hero}>
          <CreditCard size={28} color={colors.brand} strokeWidth={2} />
          <Text style={typography.h1Large}>
            {depositAmount != null ? `£${Number(depositAmount).toFixed(2)}` : "…"}
          </Text>
          <Text style={[typography.body, { color: colors.inkMuted, textAlign: "center" }]}>
            Refundable deposit to secure your booking.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <ShieldCheck size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={typography.strong}>Secure in-app payment</Text>
              <Text style={typography.small}>
                Powered by Stripe. Card details never touch our servers.
                Retries reuse the same booking — no duplicate charges.
              </Text>
            </View>
          </View>
        </View>

        {paymentError ? (
          <View style={[styles.card, { borderColor: colors.errorInk, backgroundColor: "#FEF2F2" }]}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <AlertTriangle size={18} color={colors.errorInk} />
              <Text style={[typography.small, { color: colors.errorInk, flex: 1 }]} testID="payment-error">
                {paymentError}
              </Text>
            </View>
          </View>
        ) : null}

        {initError ? (
          <View style={styles.card}>
            <Text style={[typography.small, { color: colors.errorInk }]}>{initError}</Text>
            <View style={{ marginTop: 8 }}>
              <SecondaryButton title="Try again" onPress={initSheet} testID="payment-init-retry" />
            </View>
          </View>
        ) : (
          <PrimaryButton
            title={
              initialising
                ? "Preparing…"
                : polling
                  ? "Confirming payment…"
                  : paymentError
                    ? `Retry payment${depositAmount ? ` · £${depositAmount.toFixed(2)}` : ""}`
                    : `Pay deposit${depositAmount ? ` · £${depositAmount.toFixed(2)}` : ""}`
            }
            onPress={onPay}
            disabled={initialising || presenting || polling}
            testID="payment-pay-btn"
          />
        )}

        {(initialising || polling) ? (
          <View style={{ flexDirection: "row", justifyContent: "center", padding: 8 }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : null}

        <SecondaryButton
          title="I'll pay later — save booking"
          onPress={() => navigation.navigate("Bookings")}
          testID="payment-defer-btn"
        />
      </ScrollView>
    </Page>
  );
}

const styles = {
  hero: {
    alignItems: "center" as const,
    padding: 20,
    gap: 8,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
  },
  card: {
    padding: 14,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
