import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header} testID="profile-header">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.badge}>
            <Ionicons name="star" size={14} color={colors.accent} />
            <Text style={styles.badgeText}>{user.rating.toFixed(1)} · {user.total_jobs} shipments</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Row icon="person-outline" label="Edit profile" testID="profile-edit" />
          <Row icon="card-outline" label="Payment methods" testID="profile-payment" />
          <Row icon="location-outline" label="Saved addresses" testID="profile-addresses" />
          <Row icon="notifications-outline" label="Notifications" testID="profile-notif" />
        </View>

        <View style={styles.section}>
          <Row icon="help-circle-outline" label="Help & Support" testID="profile-help" />
          <Row icon="document-text-outline" label="Terms & Privacy" testID="profile-terms" />
          <Row icon="information-circle-outline" label="About Cargo One" testID="profile-about" />
        </View>

        <View style={{ padding: spacing.xl }}>
          <Button
            title="Log out"
            variant="outline"
            onPress={logout}
            testID="profile-logout-button"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, testID }: { icon: any; label: string; testID: string }) {
  return (
    <Pressable style={styles.row} testID={testID}>
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
  avatarText: { color: "#fff", fontSize: 30, fontWeight: weight.bold },
  name: { fontSize: 22, fontWeight: weight.bold, color: colors.text, marginTop: spacing.md },
  email: { fontSize: font.base, color: colors.textSecondary },
  badge: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: "#FFF7ED", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  badgeText: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.accentDark },
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
