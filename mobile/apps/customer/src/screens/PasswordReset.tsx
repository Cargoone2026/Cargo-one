import React, { useState } from "react";
import { Alert } from "react-native";
import { requestPasswordReset } from "@cargoone/core";
import { Body, H1, Input, Label, PrimaryButton, Screen } from "../ui";

export function PasswordResetScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await requestPasswordReset(email);
      Alert.alert("Check your email", "If an account exists, we've sent a reset link.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>Reset password</H1>
      <Body muted style={{ marginTop: 6, marginBottom: 24 }}>
        Enter your email and we'll send a reset link.
      </Body>
      <Label>Email</Label>
      <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="reset-email" />
      <PrimaryButton title="Send reset link" onPress={onSubmit} loading={busy} testID="reset-submit" />
    </Screen>
  );
}
