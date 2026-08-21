/**
 * DeleteAccountScreen — mirrors web /settings/delete-account.
 * Shows the consequences and requires a typed confirmation before
 * hitting DELETE /users/me. On success the AuthContext is cleared
 * and the app returns to the Login stack automatically.
 */
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomerAPI } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { Input, Label, PrimaryButton } from "../ui";

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
      Alert.alert("Account deleted", "Your CargoOne account has been permanently removed.", [
        { text: "OK", onPress: () => logout() },
      ]);
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message || "Something went wrong. Contact support@cargoone.co.uk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} testID="delete-account-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Delete your account</Text>
        <Text style={styles.text}>
          This will permanently remove your CargoOne account, active jobs
          and booking history. Any refunds due will still be processed —
          you'll receive an email confirmation from Stripe. This cannot be
          undone.
        </Text>
        <View style={{ height: 12 }} />
        <Label>Type {CONFIRM} to confirm</Label>
        <Input value={phrase} onChangeText={setPhrase} autoCapitalize="characters" placeholder={CONFIRM} testID="delete-confirm-input" />
        <View style={{ height: 24 }} />
        <PrimaryButton
          title={busy ? "Deleting…" : "Delete my account"}
          onPress={onDelete}
          disabled={!canSubmit || busy}
          testID="delete-account-button"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#B91C1C", marginBottom: 12 },
  text: { fontSize: 15, lineHeight: 22, color: "#374151" },
});
