/**
 * CargoOne Driver — placeholder tab screen.
 *
 * Rendered by every Driver tab except Home until the corresponding
 * feature ships. Present so the bottom-tab shell mirrors the web
 * DriverLayout nav items (Home / Available / Live / My Jobs / Earnings
 * / Fleet / Profile) even while the destinations are being built out.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { colors, radius, spacing, typography } from "../theme";

export function ComingSoon({
  title,
  subtitle,
  testID,
  showLogout,
}: {
  title: string;
  subtitle: string;
  testID?: string;
  showLogout?: boolean;
}) {
  const { logout } = useAuth();
  return (
    <View style={styles.root} testID={testID}>
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coming soon</Text>
          <Text style={styles.cardBody}>{subtitle}</Text>
        </View>
        {showLogout ? (
          <Pressable
            onPress={() => logout()}
            style={({ pressed }) => [
              styles.logout,
              pressed && { backgroundColor: colors.brandHover },
            ]}
            testID="driver-logout-button"
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function AvailableJobsScreen() {
  return (
    <ComingSoon
      testID="driver-available-jobs"
      title="Available"
      subtitle="Marketplace browsing and bidding arrive in a later phase — you'll be able to see nearby jobs, place bids, and claim ASAP offers here."
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerSafe: { backgroundColor: colors.header },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.header,
  },
  headerTitle: { ...typography.headerName, color: colors.textOnDark },
  body: { padding: spacing.lg, gap: spacing.md },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTitle: { ...typography.cardTitle, color: colors.text, marginBottom: 4 },
  cardBody: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  logout: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { ...typography.button, color: colors.textOnDark },
});
