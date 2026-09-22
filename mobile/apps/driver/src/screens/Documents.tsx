/**
 * DocumentsScreen — placeholder pending P2-d implementation.
 *
 * The Home dashboard's account-state banners (pending +
 * changes_requested) both deep-link into Documents. Rather than dead
 * links, this screen renders a "Coming soon" panel plus a direct call
 * to `DriverAPI.resubmitVerification()` for drivers in the
 * `changes_requested` state, matching the web fallback.
 */
import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { ChevronLeft, UploadCloud } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { DriverAPI } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { Page, PrimaryButton, SecondaryButton } from "../ui";

export function DocumentsScreen() {
  const nav = useNavigation<any>();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  const canResubmit = user?.status === "changes_requested";

  const onResubmit = async () => {
    setBusy(true);
    try {
      await DriverAPI.resubmitVerification();
      await refresh();
      Alert.alert(
        "Submitted for review",
        "Thanks — our team will re-check your details shortly.",
      );
    } catch (e: any) {
      Alert.alert("Could not resubmit", e?.message || "Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page testID="driver-documents-placeholder">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ChevronLeft
            size={26}
            color={colors.ink}
            strokeWidth={2}
            onPress={() => nav.goBack()}
          />
          <Text style={typography.h1Large}>Documents</Text>
        </View>
        <View
          style={{
            padding: 24,
            gap: 12,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bg,
            alignItems: "center",
          }}
        >
          <UploadCloud size={36} color={colors.brand} strokeWidth={2} />
          <Text style={[typography.body, { textAlign: "center", lineHeight: 22 }]}>
            Photo upload for driving licence, insurance, ID and vehicle photos is coming next. For
            now, please use the Cargo One web portal to upload verification documents.
          </Text>
          {canResubmit ? (
            <PrimaryButton
              title="Re-submit for review"
              onPress={onResubmit}
              loading={busy}
              testID="documents-resubmit"
            />
          ) : null}
          <SecondaryButton
            title="Back"
            onPress={() => nav.goBack()}
            testID="documents-back"
          />
        </View>
      </ScrollView>
    </Page>
  );
}
