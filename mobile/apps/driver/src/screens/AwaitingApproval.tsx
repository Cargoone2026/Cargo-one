/**
 * AwaitingApprovalScreen — driver hasn't been approved yet. Same
 * branded lockup as Login so the transition into "review" state feels
 * intentional.
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { useAuth } from "../AuthContext";
import { Page, PrimaryButton, SecondaryButton } from "../ui";
import { colors, radius, typography } from "../theme";

export function AwaitingApprovalScreen() {
  const { logout, refresh } = useAuth();
  return (
    <Page testID="driver-awaiting-approval">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>C1</Text>
          </View>
          <Text style={styles.brandTitle}>CARGO ONE</Text>
          <Text style={styles.brandRole}>Driver</Text>
        </View>

        <View style={styles.hero}>
          <ShieldCheck size={36} color={colors.brand} strokeWidth={2} />
          <Text style={[typography.h1Large, { textAlign: "center" }]}>Application in review</Text>
          <Text style={[typography.body, { textAlign: "center", color: colors.inkMuted, lineHeight: 22 }]}>
            Our team is checking your details. You'll get an email as soon as you're approved — then you can start
            accepting jobs.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <PrimaryButton title="Check status" onPress={refresh} testID="approval-refresh" />
          <SecondaryButton title="Log out" onPress={() => logout()} testID="approval-logout" />
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  brand: { alignItems: "center" as const, gap: 8, marginTop: 20 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  markText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" as const, letterSpacing: 1 },
  brandTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" as const, letterSpacing: 1.6, marginTop: 6 },
  brandRole: { color: colors.inkMuted, fontSize: 12, letterSpacing: 0.4 },
  hero: {
    alignItems: "center" as const,
    gap: 12,
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
