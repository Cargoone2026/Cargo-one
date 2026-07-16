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

        <View style={styles.section}>
          <Row
            icon="pricetags-outline"
            label="Booking Fee Bands"
            onPress={() => router.push("/(admin)/deposit-bands")}
            testID="settings-deposit-bands"
          />
          <Row icon="megaphone-outline" label="Homepage banners" />
          <Row icon="pricetag-outline" label="Job categories" />
          <Row icon="gift-outline" label="Promo codes" />
          <Row icon="help-circle-outline" label="FAQs" />
        </View>

        <View style={styles.section}>
          <Row
            icon="settings-outline"
            label="App settings & Legal"
            onPress={() => router.push("/settings")}
            testID="admin-open-settings"
          />
          <Row icon="stats-chart-outline" label="Reports & Analytics" />
          <Row icon="alert-circle-outline" label="Disputes" />
          <Row icon="notifications-outline" label="Push notifications" />
        </View>

        <View style={{ padding: spacing.xl }}>
          <Button title="Log out" variant="outline" onPress={logout} testID="admin-logout" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, onPress, testID }: any) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
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
  section: {
    marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.bg,
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
  rowLabel: { flex: 1, fontSize: font.base, color: colors.text, fontWeight: weight.medium },
});
