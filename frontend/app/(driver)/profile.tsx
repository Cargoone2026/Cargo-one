import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function DriverProfile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            {user.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <Text style={styles.avatarText}>
                {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </Text>
            )}
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.verified_driver && (
            <View style={styles.verifiedBadge} testID="verified-driver-badge">
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.verifiedText}>VERIFIED DRIVER</Text>
            </View>
          )}
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, {
              backgroundColor: user.status === "active" ? colors.success : colors.warning,
            }]} />
            <Text style={styles.statusText}>
              {user.status === "active" ? "Approved Driver" : "Pending Approval"}
            </Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="star" size={14} color={colors.accent} />
            <Text style={styles.badgeText}>{user.rating.toFixed(1)} · {user.total_jobs} jobs</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <Pressable
            style={styles.docRow}
            onPress={() => router.push("/(driver)/documents")}
            testID="open-documents"
          >
            <View style={styles.docIcon}>
              <Ionicons name="documents" size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>Manage verification documents</Text>
              <Text style={styles.docSub}>
                {user.documents_verified ? "All approved ✓" : "Upload required documents to get approved"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <View style={styles.vehicleCard}>
            <Ionicons name="car-sport" size={36} color={colors.brand} />
            <View>
              <Text style={styles.vehicleTitle}>Add your vehicle</Text>
              <Text style={styles.vehicleSub}>Make, model, capacity, photos</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Pressable
            style={styles.docRow}
            onPress={() => router.push("/settings")}
            testID="driver-open-settings"
          >
            <View style={styles.docIcon}>
              <Ionicons name="settings" size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>App settings & Legal</Text>
              <Text style={styles.docSub}>Terms, Privacy, Support, Delete account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Button title="Log out" variant="outline" onPress={logout} testID="driver-logout" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxxl },
  header: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: weight.bold },
  name: { fontSize: 22, fontWeight: weight.bold, color: colors.text, marginTop: spacing.md },
  email: { fontSize: font.base, color: colors.textSecondary },
  verifiedBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, marginTop: spacing.sm,
  },
  verifiedText: { color: "#fff", fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.8 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary, marginTop: spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.text },
  badge: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: "#FFF7ED", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  badgeText: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.accentDark },
  section: {
    marginHorizontal: spacing.xl, marginTop: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.semibold,
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  docRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
  },
  docIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
  },
  docLabel: { flex: 1, fontSize: font.base, color: colors.text, fontWeight: weight.medium },
  docSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  uploadTag: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  uploadTagText: { color: "#fff", fontSize: font.sm, fontWeight: weight.semibold },
  vehicleCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
  },
  vehicleTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  vehicleSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
});
