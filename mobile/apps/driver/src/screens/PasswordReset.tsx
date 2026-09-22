/**
 * PasswordResetScreen — Cargo One Driver forgot-password flow.
 *
 * Mirrors the web page (frontend/src/pages/auth/ForgotPassword.jsx):
 *   • POSTs to `/auth/forgot-password` (backend always returns 200 to
 *     prevent account enumeration).
 *   • Shows a generic "check your inbox" success state regardless of
 *     whether the email is registered.
 *   • Uses `DriverAPI.requestPasswordReset` — the shared helper in
 *     `@cargoone/core` still points at the legacy path and is
 *     intentionally not touched to preserve the Customer golden
 *     checkpoint.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MailCheck, ChevronLeft } from "lucide-react-native";
import { DriverAPI } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Input, Label, Page, PrimaryButton } from "../ui";

export function PasswordResetScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setErr(null);
    if (!email.trim()) {
      setErr("Please enter your email.");
      return;
    }
    setBusy(true);
    try {
      await DriverAPI.requestPasswordReset(email);
      setSent(true);
    } catch (e: any) {
      // Only network / server errors bubble up — the backend never
      // reveals whether the email exists.
      setErr(e?.message || "Could not send reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Page testID="driver-password-reset">
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{ alignSelf: "flex-start", padding: 4, marginBottom: 8 }}
            testID="back-button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={26} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              backgroundColor: "#FEF3F3",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <MailCheck size={24} color={colors.brand} strokeWidth={2} />
          </View>
          <Text style={typography.h1Large} testID="forgot-password-success">
            Check your inbox
          </Text>
          <Text style={[typography.body, { marginTop: 12, lineHeight: 22 }]}>
            If an account exists for <Text style={{ fontWeight: "700" }}>{email.trim()}</Text>,
            we've sent a link to reset your password. The link expires in 60 minutes.
          </Text>
          <Text style={[typography.bodyMuted, { marginTop: 16 }]}>
            Didn't get an email? Check your spam folder, or{" "}
            <Text
              style={{ color: colors.brand, fontWeight: "700" }}
              onPress={() => {
                setSent(false);
                setErr(null);
              }}
              testID="forgot-password-try-again"
            >
              try again
            </Text>
            .
          </Text>
          <View style={{ marginTop: 24 }}>
            <PrimaryButton
              title="Back to log in"
              onPress={() => navigation.goBack()}
              testID="back-to-login-button"
            />
          </View>
        </ScrollView>
      </Page>
    );
  }

  return (
    <Page testID="driver-password-reset">
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ alignSelf: "flex-start", padding: 4, marginBottom: 8 }}
          testID="back-button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={26} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={typography.h1Large}>Forgot password?</Text>
        <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 16 }]}>
          Enter the email on your account and we'll send you a secure reset link.
        </Text>
        <Label>Email</Label>
        <Input
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="forgot-password-email-input"
        />
        {err && (
          <View style={styles.error} testID="forgot-password-error">
            <Text style={{ color: colors.errorInk, fontSize: 13 }}>{err}</Text>
          </View>
        )}
        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            title="Send reset link"
            onPress={onSubmit}
            loading={busy}
            testID="forgot-password-submit-button"
          />
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
};
