/**
 * PasswordResetScreen — request a reset link.
 */
import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { requestPasswordReset } from "@cargoone/core";
import { colors, typography } from "../theme";
import { Input, Label, Page, PageHeader, PrimaryButton } from "../ui";

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
    <Page testID="password-reset-screen">
      <ScrollView>
        <PageHeader title="Reset password" subtitle="Enter your email and we'll send a reset link." />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <Label>Email</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="reset-email"
          />
          <View style={{ marginTop: 20 }}>
            <PrimaryButton title="Send reset link" onPress={onSubmit} loading={busy} testID="reset-submit" />
          </View>
        </View>
      </ScrollView>
    </Page>
  );
}
