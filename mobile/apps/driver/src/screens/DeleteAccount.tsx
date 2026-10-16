/**
 * CargoOne Driver — Delete account. Mirrors the Customer DeleteAccount screen (Apple requirement).
 */
import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomerAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { Input, Label, Page, PageHeader, PrimaryButton, colors, radius, typography } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "DeleteAccount">;

const CONFIRM = "DELETE";

export default function DeleteAccountScreen({ navigation }: P) {
  const { logout } = useAuth();
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = phrase.trim() === CONFIRM;
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Settings"));

  async function onDelete() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await CustomerAPI.deleteAccount();
      Alert.alert("Account deleted", "Your Cargo One driver account has been removed.", [
        { text: "OK", onPress: () => logout() },
      ]);
    } catch (e: any) {
      Alert.alert(
        e?.status === 409 ? "Can't delete yet" : "Delete failed",
        e?.message || "Something went wrong. Contact support@cargoone.co.uk.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page testID="delete-account-screen">
      <ScrollView keyboardShouldPersistTaps="handled">
        <PageHeader
          title={<Text style={[typography.pageTitle, { color: colors.error }]}>Delete your account</Text>}
          onBack={goBack}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}>
          <Text style={[typography.body, { lineHeight: 22 }]}>
            This will permanently remove your Cargo One driver account and personal details. Completed jobs, earnings
            and payout records are kept for accounting. You can't delete your account while you have an active job.
            This cannot be undone.
          </Text>
          <View style={styles.warn}>
            <Text style={[typography.strong, { color: colors.error }]}>You will lose access to</Text>
            <Text style={typography.body}>• Your driver profile, documents and vehicles</Text>
            <Text style={typography.body}>• Job offers, bids and Live Mode</Text>
            <Text style={typography.body}>• Message history with customers</Text>
          </View>
          <Label>Type {CONFIRM} to confirm</Label>
          <Input
            value={phrase}
            onChangeText={setPhrase}
            autoCapitalize="characters"
            autoCorrect={false}
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
