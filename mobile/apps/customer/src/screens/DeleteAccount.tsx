/**
 * DeleteAccountScreen — mirrors web /settings/delete-account.
 */
import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { CustomerAPI } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { Input, Label, Page, PageHeader, PrimaryButton } from "../ui";

export function DeleteAccountScreen() {
  const { logout } = useAuth();
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const CONFIRM = "DELETE";
  const canSubmit = phrase.trim() === CONFIRM;

  async function onDelete() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await CustomerAPI.deleteAccount();
      Alert.alert("Account deleted", "Your Cargo One account has been permanently removed.", [
        { text: "OK", onPress: () => logout() },
      ]);
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message || "Something went wrong. Contact support@cargoone.co.uk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page testID="delete-account-screen">
      <ScrollView>
        <PageHeader
          title={<Text style={[typography.pageTitle, { color: colors.errorInk }]}>Delete your account</Text>}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}>
          <Text style={[typography.body, { lineHeight: 22 }]}>
            This will permanently remove your Cargo One account, active jobs and booking history. Any refunds due will
            still be processed — you'll receive an email confirmation from Stripe. This cannot be undone.
          </Text>
          <View style={styles.warn}>
            <Text style={[typography.strong, { color: colors.errorInk }]}>You will lose access to</Text>
            <Text style={typography.body}>• All past and active bookings</Text>
            <Text style={typography.body}>• Saved passkeys and payment methods</Text>
            <Text style={typography.body}>• Message history with drivers</Text>
          </View>
          <Label>Type {CONFIRM} to confirm</Label>
          <Input
            value={phrase}
            onChangeText={setPhrase}
            autoCapitalize="characters"
            placeholder={CONFIRM}
            testID="delete-confirm-input"
          />
          <PrimaryButton
            title={busy ? "Deleting…" : "Delete my account"}
            onPress={onDelete}
            disabled={!canSubmit || busy}
            variant="danger"
            testID="delete-account-button"
          />
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  warn: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    gap: 6,
  },
};
