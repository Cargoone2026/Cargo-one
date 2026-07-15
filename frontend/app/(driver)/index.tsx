import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { StatusPill } from "@/src/components/StatusPill";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function DriverHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [nearby, setNearby] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([
        api<any[]>("/jobs/nearby?radius=75").catch(() => []),
        api<any[]>("/bookings/mine").catch(() => []),
      ]);
      setNearby(n || []);
      setMine(m || []);
    } catch {
      // silent
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeBookings = mine.filter((b) => !["completed", "cancelled"].includes(b.status));
  const earningsMonth = mine
    .filter((b) => b.status === "completed")
    .reduce((acc, b) => acc + Number(b.total_price), 0);

  const pendingApproval = user?.status === "pending";

  return (
    <View style={styles.root} testID="driver-home">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.bgDark }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day, {user?.name?.split(" ")[0]}</Text>
            <Text style={styles.slogan}>Ready to earn today?</Text>
          </View>
          <View style={styles.headerBadge}>
            <View style={[styles.dot, { backgroundColor: pendingApproval ? colors.warning : colors.success }]} />
            <Text style={styles.badgeText}>
              {pendingApproval ? "Pending approval" : "Online"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Available Jobs" value={String(nearby.length)} accent={colors.accent} />
          <StatCard label="Active" value={String(activeBookings.length)} accent="#fff" />
          <StatCard label="Earned" value={`£${earningsMonth.toFixed(0)}`} accent={colors.success} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll}>
        {pendingApproval && (
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={22} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Account under review</Text>
              <Text style={styles.warningText}>
                Upload driving licence, insurance, ID, and vehicle photos to get approved.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Nearby Jobs</Text>
          <Pressable onPress={() => router.push("/(driver)/jobs")}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        </View>

        {nearby.slice(0, 3).map((j) => (
          <Pressable
            key={j.id}
            style={styles.jobCard}
            onPress={() => router.push(`/(driver)/job/${j.id}`)}
            testID={`driver-nearby-${j.id}`}
          >
            <View style={styles.jobHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{j.title}</Text>
                <Text style={styles.jobCategory}>{j.category.replace("_", " ")}</Text>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>
                  {j.pricing_type === "fixed" ? `£${j.fixed_price}` : `up to £${j.max_budget || j.suggested_price}`}
                </Text>
              </View>
            </View>
            <View style={styles.jobRoute}>
              <Ionicons name="navigate" size={14} color={colors.brand} />
              <Text style={styles.jobRouteText}>
                {j.pickup_town} → {j.dropoff_town} · {j.distance_miles} mi
              </Text>
            </View>
            <View style={styles.jobFoot}>
              <Text style={styles.jobDistance}>
                {j.distance_from_driver} mi away
              </Text>
              <Text style={styles.jobTag}>
                {j.pricing_type === "fixed" ? "ACCEPT" : "BID NOW"}
              </Text>
            </View>
          </Pressable>
        ))}

        {nearby.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="compass-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No jobs in your area right now.</Text>
          </View>
        )}

        {activeBookings.length > 0 && (
          <>
            <View style={[styles.sectionHead, { marginTop: spacing.xl }]}>
              <Text style={styles.sectionTitle}>Active Deliveries</Text>
            </View>
            {activeBookings.map((b) => (
              <Pressable
                key={b.id}
                style={styles.jobCard}
                onPress={() => router.push(`/(driver)/booking/${b.id}`)}
                testID={`driver-active-${b.id}`}
              >
                <View style={styles.jobHead}>
                  <Text style={styles.jobTitle}>{b.job?.title}</Text>
                  <StatusPill status={b.status} />
                </View>
                <Text style={styles.jobRouteText}>
                  {b.job?.pickup_town} → {b.job?.dropoff_town}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.bgDark,
  },
  greeting: { color: "#fff", fontSize: font.xxl, fontWeight: weight.bold, letterSpacing: -0.4 },
  slogan: { color: "rgba(255,255,255,0.6)", fontSize: font.base, marginTop: 2 },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: spacing.md,
    paddingVertical: 6, borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: font.sm, fontWeight: weight.semibold },
  statsRow: {
    flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl, backgroundColor: colors.bgDark,
  },
  stat: { flex: 1, padding: spacing.lg, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.md },
  statValue: { fontSize: 24, fontWeight: weight.bold, letterSpacing: -0.4 },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: spacing.xs, letterSpacing: 0.5, textTransform: "uppercase" },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  warningCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    backgroundColor: "#FFFBEB", borderRadius: radius.md, borderWidth: 1, borderColor: "#FDE68A",
  },
  warningTitle: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  warningText: { fontSize: font.base, color: colors.textSecondary, marginTop: 2, lineHeight: 20 },
  sectionHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  link: { color: colors.brand, fontWeight: weight.semibold },
  jobCard: {
    padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  jobHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  jobTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  jobCategory: { fontSize: font.sm, color: colors.textSecondary, textTransform: "capitalize", marginTop: 2 },
  priceBadge: { backgroundColor: colors.text, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  priceBadgeText: { color: "#fff", fontSize: font.sm, fontWeight: weight.bold },
  jobRoute: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  jobRouteText: { flex: 1, fontSize: font.base, color: colors.textSecondary },
  jobFoot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  jobDistance: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  jobTag: { fontSize: font.sm, fontWeight: weight.bold, color: colors.brand, letterSpacing: 0.6 },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.md },
  emptyText: { color: colors.textSecondary },
});
