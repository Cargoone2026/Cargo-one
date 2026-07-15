import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function DriverProfile() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const docs = [
    { key: "driving_licence", label: "Driving licence", verified: user.documents_verified },
    { key: "insurance", label: "Insurance", verified: user.documents_verified },
    { key: "vehicle_docs", label: "Vehicle documents", verified: user.documents_verified },
    { key: "id_proof", label: "ID proof", verified: user.documents_verified },
    { key: "address_proof", label: "Proof of address", verified: user.documents_verified },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
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
          {docs.map((d) => (
            <Pressable key={d.key} style={styles.docRow} testID={`doc-${d.key}`}>
              <View style={styles.docIcon}>
                <Ionicons name="document-text" size={20} color={colors.text} />
              </View>
              <Text style={styles.docLabel}>{d.label}</Text>
              {d.verified ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              ) : (
                <View style={styles.uploadTag}>
                  <Text style={styles.uploadTagText}>Upload</Text>
                </View>
              )}
            </Pressable>
          ))}
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
  uploadTag: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  uploadTagText: { color: "#fff", fontSize: font.sm, fontWeight: weight.semibold },
  vehicleCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
  },
  vehicleTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  vehicleSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
});
