import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api("/admin/stats");
      setStats(s);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root} testID="admin-dashboard">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.bgDark }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Console</Text>
            <Text style={styles.sub}>Welcome, {user?.name}</Text>
          </View>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={22} color="#fff" />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <View style={styles.metricRow}>
          <Metric label="Customers" value={stats.customers ?? 0} icon="people" color={colors.info} />
          <Metric label="Drivers" value={stats.drivers ?? 0} icon="car-sport" color={colors.accent} />
        </View>
        <View style={styles.metricRow}>
          <Metric label="Total Jobs" value={stats.total_jobs ?? 0} icon="cube" color={colors.text} />
          <Metric label="Active" value={stats.active_jobs ?? 0} icon="pulse" color={colors.brand} />
        </View>
        <View style={styles.metricRow}>
          <Metric
            label="Revenue (GBP)"
            value={`£${(stats.revenue_gbp ?? 0).toFixed(2)}`}
            icon="cash"
            color={colors.success}
          />
          <Metric label="Paid Bookings" value={stats.paid_bookings ?? 0} icon="checkmark-done" color={colors.success} />
        </View>

        <View style={styles.section}>
          <Pressable
            style={styles.actionRow}
            onPress={() => router.push("/(admin)/drivers")}
            testID="admin-pending-approvals"
          >
            <View style={[styles.actionIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="alert-circle" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Pending driver approvals</Text>
              <Text style={styles.actionSub}>
                {stats.pending_drivers ?? 0} driver{stats.pending_drivers === 1 ? "" : "s"} awaiting verification
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable
            style={styles.actionRow}
            onPress={() => router.push("/(admin)/jobs")}
            testID="admin-all-jobs"
          >
            <View style={[styles.actionIcon, { backgroundColor: "#FFF7ED" }]}>
              <Ionicons name="clipboard" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>All jobs</Text>
              <Text style={styles.actionSub}>Review and moderate marketplace jobs</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable
            style={styles.actionRow}
            onPress={() => router.push("/(admin)/users")}
            testID="admin-users-manage"
          >
            <View style={[styles.actionIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="people" size={22} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Manage users</Text>
              <Text style={styles.actionSub}>Search, suspend, and view customer accounts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable
            style={styles.actionRow}
            onPress={() => router.push("/(admin)/deposit-bands")}
            testID="admin-deposit-bands"
          >
            <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="pricetags" size={22} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Booking deposit bands</Text>
              <Text style={styles.actionSub}>Configure deposit tiers by job value</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, icon, color }: any) {
  return (
    <View style={[styles.metric, { borderLeftColor: color }]}>
      <View style={styles.metricHead}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl,
    backgroundColor: colors.bgDark,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: weight.bold, letterSpacing: -0.4 },
  sub: { color: "rgba(255,255,255,0.6)", fontSize: font.base, marginTop: 2 },
  logoBadge: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  metricRow: { flexDirection: "row", gap: spacing.md },
  metric: {
    flex: 1, padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, gap: spacing.xs,
  },
  metricHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metricLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  metricValue: { fontSize: 22, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.3 },
  section: { marginTop: spacing.md, gap: spacing.sm },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  actionSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
});
