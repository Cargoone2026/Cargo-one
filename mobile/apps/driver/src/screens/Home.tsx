/**
 * CargoOne Driver — Home stub (Phase 1).
 *
 * Renders after a successful driver sign-in. Confirms:
 *   • the authenticated user, name and role from /auth/me
 *   • the driver's approval status (mirrors the web Dashboard header)
 *   • a working Log out flow (clears the bearer token + returns to Login)
 *
 * The full driver dashboard (earnings, fleet, jobs, messages, live
 * mode etc.) is added incrementally in later phases so that each
 * feature can be validated on-device before the next lands.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { colors, radius, spacing, typography } from "../theme";

const STATUS_LABELS: Record<string, { label: string; dot: string; blurb: string }> = {
  active:            { label: "Online",       dot: colors.success, blurb: "Ready to earn today." },
  pending:           { label: "Pending",      dot: colors.warning, blurb: "Complete verification to start receiving jobs." },
  changes_requested: { label: "Action needed", dot: colors.danger,  blurb: "Admin has requested changes on your account." },
  suspended:         { label: "Suspended",    dot: colors.danger,  blurb: "Account suspended — contact support." },
};

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const status = STATUS_LABELS[user?.status || "active"] || STATUS_LABELS.active;
  const firstName = user?.name?.split(" ")[0] || "there";

  async function onLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header} testID="driver-home-header">
          <View style={{ flex: 1 }}>
            <Text style={styles.hi}>Hi {firstName}</Text>
            <Text style={styles.headerSub}>{status.blurb}</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.body} testID="driver-home">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signed in</Text>
          <Text style={styles.cardRow}>{user?.email}</Text>
          <Text style={styles.cardRowMuted}>Role: {user?.role}</Text>
          <Text style={styles.cardRowMuted}>Status: {user?.status || "—"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driver features</Text>
          <Text style={styles.cardRowMuted}>
            Available Jobs, Live Mode, My Jobs, Earnings, Fleet, Documents,
            Notifications and Profile are coming online one phase at a time.
            This screen exists to prove authentication against the Cargo One
            backend on your device.
          </Text>
        </View>

        <Pressable
          onPress={onLogout}
          disabled={signingOut}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && !signingOut && { backgroundColor: "#B01F1F" },
            signingOut && { opacity: 0.6 },
          ]}
          testID="driver-logout-button"
        >
          {signingOut ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <Text style={styles.logoutText}>Log out</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerSafe: { backgroundColor: colors.header },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.header,
    gap: spacing.md,
  },
  hi: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textOnDark,
    letterSpacing: -0.5,
  },
  headerSub: {
    marginTop: 2,
    ...typography.bodySm,
    color: "rgba(255,255,255,0.6)",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textOnDark,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: 4,
  },
  cardTitle: {
    ...typography.h2,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardRow: {
    ...typography.body,
    color: colors.text,
  },
  cardRowMuted: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  logoutButton: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    ...typography.button,
    color: colors.textOnDark,
  },
});
