/**
 * CargoOne Driver — Forgot password. Uses shared core requestPasswordReset (/auth/forgot-password).
 */
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { requestPasswordReset } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { Input, Label, Page, PageHeader, PrimaryButton, Section, colors, space } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: P) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page testID="forgot-password-screen">
      <PageHeader
        title="Reset password"
        subtitle="Enter your email and we'll send a reset link."
        onBack={() => navigation.goBack()}
      />
      <Section gap={0}>
        {sent ? (
          <View style={styles.success} testID="forgot-password-success">
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>
              If an account exists for {email.trim()}, we've sent a password reset link. It expires in 1 hour.
            </Text>
            <View style={{ height: space[4] }} />
            <PrimaryButton title="Back to log in" onPress={() => navigation.goBack()} testID="forgot-password-back-to-login" />
          </View>
        ) : (
          <>
            <Label>Email</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              placeholder="you@example.com"
              editable={!busy}
              testID="forgot-password-email"
              returnKeyType="send"
              onSubmitEditing={onSubmit}
            />
            {error ? <Text style={styles.error} testID="forgot-password-error">{error}</Text> : null}
            <View style={{ height: space[5] }} />
            <PrimaryButton title="Send reset link" onPress={onSubmit} loading={busy} testID="forgot-password-submit" />
          </>
        )}
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  success: { padding: space[4], borderRadius: 12, borderWidth: 1, borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  successTitle: { fontSize: 16, fontWeight: "700", color: "#166534" },
  successText: { marginTop: 6, fontSize: 14, lineHeight: 20, color: "#166534" },
  error: { marginTop: space[2], color: colors.error, fontSize: 14, fontWeight: "500" },
});
