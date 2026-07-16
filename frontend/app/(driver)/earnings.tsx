import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function Earnings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await api<any[]>("/bookings/mine");
      setBookings(b);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stats = useMemo(() => {
    const completed = bookings.filter((b) => b.status === "completed");
    const upcoming = bookings.filter((b) =>
      ["deposit_paid", "confirmed", "travelling", "arrived", "collected", "on_route", "delivered", "pod_uploaded"].includes(b.status),
    );
    const total = completed.reduce((a, b) => a + Number(b.driver_charge ?? b.balance_due ?? 0), 0);
    const pending = upcoming.reduce((a, b) => a + Number(b.driver_charge ?? b.balance_due ?? 0), 0);
    return { total, pending, completed: completed.length, upcoming: upcoming.length };
  }, [bookings]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <Text style={styles.title}>Earnings</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Total earned</Text>
          <Text style={styles.heroValue}>£{stats.total.toFixed(2)}</Text>
          <Text style={styles.heroSub}>{stats.completed} completed deliveries</Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, { backgroundColor: "#FFF7ED" }]}>
            <Ionicons name="hourglass" size={22} color={colors.accent} />
            <Text style={styles.cardValue}>£{stats.pending.toFixed(0)}</Text>
            <Text style={styles.cardLabel}>Pending balance</Text>
          </View>
          <View style={[styles.card, { backgroundColor: "#F0FDF4" }]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.cardValue}>{stats.upcoming}</Text>
            <Text style={styles.cardLabel}>In progress</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={22} color={colors.info} />
          <Text style={styles.infoText}>
            You receive the balance directly from customers on delivery. Cargo One only collects the platform deposit.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Recent Deliveries</Text>
        {bookings.filter((b) => b.status === "completed").slice(0, 10).map((b) => (
          <View key={b.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>{b.job?.title || "Delivery"}</Text>
              <Text style={styles.historySub}>
                {new Date(b.completed_at || b.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.historyAmount}>+£{Number(b.driver_charge ?? b.balance_due ?? 0).toFixed(0)}</Text>
          </View>
        ))}
        {bookings.filter((b) => b.status === "completed").length === 0 && (
          <Text style={styles.emptyText}>No completed deliveries yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { fontSize: 30, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  hero: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.text, gap: spacing.xs },
  heroLabel: { color: "rgba(255,255,255,0.6)", fontSize: font.sm, fontWeight: weight.medium, letterSpacing: 0.5, textTransform: "uppercase" },
  heroValue: { color: "#fff", fontSize: 42, fontWeight: weight.bold, letterSpacing: -1 },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: font.base },
  row: { flexDirection: "row", gap: spacing.md },
  card: { flex: 1, padding: spacing.lg, borderRadius: radius.md, gap: spacing.xs },
  cardValue: { fontSize: font.xxl, fontWeight: weight.bold, color: colors.text },
  cardLabel: { fontSize: font.sm, color: colors.textSecondary },
  infoCard: {
    flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.infoBg,
    borderRadius: radius.md, alignItems: "center",
  },
  infoText: { flex: 1, fontSize: font.base, color: colors.text, lineHeight: 20 },
  sectionTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text, marginTop: spacing.md },
  historyRow: {
    flexDirection: "row", alignItems: "center", padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  historyTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  historySub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  historyAmount: { fontSize: font.lg, fontWeight: weight.bold, color: colors.success },
  emptyText: { color: colors.textSecondary, textAlign: "center", padding: spacing.xl },
});
