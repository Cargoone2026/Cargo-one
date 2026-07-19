import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={36} color="#fff" />
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ADMIN</Text>
          </View>
        </View>

        {/* Working operational tools — every row leads to a real route */}
        <Section title="Operations">
          <Row
            icon="bar-chart-outline"
            label="Reports & Analytics"
            sub="Marketplace, revenue, drivers, customers"
            onPress={() => router.push("/(admin)/analytics")}
            testID="settings-analytics"
          />
          <Row
            icon="library-outline"
            label="Service Catalogue"
            sub="Categories, vehicles, capabilities"
            onPress={() => router.push("/(admin)/catalog")}
            testID="settings-catalog"
          />
          <Row
            icon="car-sport-outline"
            label="Manage drivers"
            sub="Approve, review or suspend drivers"
            onPress={() => router.push("/(admin)/manage-drivers")}
            testID="settings-drivers"
          />
          <Row
            icon="cube-outline"
            label="All jobs"
            sub="Marketplace moderation"
            onPress={() => router.push("/(admin)/jobs")}
            testID="settings-jobs"
          />
          <Row
            icon="pricetags-outline"
            label="Booking Fee Bands"
            sub="Tiered platform fees by driver charge"
            onPress={() => router.push("/(admin)/deposit-bands")}
            testID="settings-deposit-bands"
          />
        </Section>

        <Section title="Preferences & Legal">
          <Row
            icon="settings-outline"
            label="App settings & Legal"
            sub="Version, terms, privacy, delete account"
            onPress={() => router.push("/settings")}
            testID="admin-open-settings"
          />
        </Section>

        {/* Deferred items — clearly badged as Coming soon, non-navigating */}
        <Section title="Coming soon">
          <ComingRow icon="megaphone-outline" label="Homepage banners" />
          <ComingRow icon="gift-outline" label="Promo codes" />
          <ComingRow icon="help-circle-outline" label="FAQ management" />
          <ComingRow icon="alert-circle-outline" label="Disputes" />
          <ComingRow icon="notifications-outline" label="Push notifications" />
        </Section>

        <View style={{ padding: spacing.xl }}>
          <Button title="Log out" variant="outline" onPress={logout} testID="admin-logout" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ icon, label, sub, onPress, testID }: {
  icon: any; label: string; sub?: string; onPress?: () => void; testID?: string;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
    </Pressable>
  );
}

function ComingRow({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={[styles.row, { opacity: 0.7 }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.bgSecondary }]}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.soonPill}>
        <Text style={styles.soonPillText}>Coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxxl },
  header: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.text,
    alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 22, fontWeight: weight.bold, color: colors.text, marginTop: spacing.md },
  email: { fontSize: font.base, color: colors.textSecondary },
  badge: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: weight.bold, letterSpacing: 1 },
  sectionTitle: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.bold,
    textTransform: "uppercase", letterSpacing: 0.8,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  sectionBody: {
    marginHorizontal: spacing.xl, backgroundColor: colors.bg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { fontSize: font.base, color: colors.text, fontWeight: weight.medium },
  rowSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  soonPill: {
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary,
  },
  soonPillText: { fontSize: 10, color: colors.textSecondary, fontWeight: weight.bold, letterSpacing: 0.4, textTransform: "uppercase" },
});
