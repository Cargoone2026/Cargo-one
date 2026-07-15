import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Tab = "active" | "past";

export default function Bookings() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [items, setItems] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookings, myJobs] = await Promise.all([
        api<any[]>("/bookings/mine"),
        api<any[]>("/jobs/mine"),
      ]);
      setItems(bookings);
      setJobs(myJobs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = items.filter((b) => !["completed", "cancelled"].includes(b.status));
  const past = items.filter((b) => ["completed", "cancelled"].includes(b.status));
  const openJobs = jobs.filter((j) => j.status === "posted");

  const display = tab === "active" ? [...active, ...openJobs.map((j) => ({ ...j, _isJob: true }))] : past;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
      </View>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("active")}
          style={[styles.tab, tab === "active" && styles.tabActive]}
          testID="bookings-active-tab"
        >
          <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>
            Active ({active.length + openJobs.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("past")}
          style={[styles.tab, tab === "past" && styles.tabActive]}
          testID="bookings-past-tab"
        >
          <Text style={[styles.tabText, tab === "past" && styles.tabTextActive]}>
            Past ({past.length})
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={display}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="bookings-empty">
            <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySub}>Post your first job to get started.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              item._isJob
                ? router.push(`/(customer)/job/${item.id}`)
                : router.push(`/(customer)/booking/${item.id}`)
            }
            style={styles.card}
            testID={`booking-row-${item.id}`}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>
                {item._isJob ? item.title : item.job?.title}
              </Text>
              <StatusPill status={item.status} />
            </View>
            <View style={styles.routeRow}>
              <Ionicons name="location" size={14} color={colors.brand} />
              <Text style={styles.routeText}>
                {item._isJob
                  ? `${item.pickup_town} → ${item.dropoff_town}`
                  : `${item.job?.pickup_town} → ${item.job?.dropoff_town}`}
              </Text>
            </View>
            <View style={styles.cardFoot}>
              <View>
                <Text style={styles.priceLabel}>Total</Text>
                <Text style={styles.price}>
                  £{Number(item._isJob ? item.suggested_price : item.total_price).toFixed(0)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textTertiary} />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 30, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  tabs: {
    flexDirection: "row", marginHorizontal: spacing.xl, backgroundColor: colors.bgSecondary,
    borderRadius: radius.pill, padding: 4, marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: "center", borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.text },
  tabText: { color: colors.textSecondary, fontSize: font.base, fontWeight: weight.medium },
  tabTextActive: { color: "#fff" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginTop: spacing.md },
  emptySub: { fontSize: font.base, color: colors.textSecondary },
  card: {
    padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { flex: 1, fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginRight: spacing.sm },
  routeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  routeText: { fontSize: font.base, color: colors.textSecondary, flex: 1 },
  cardFoot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  priceLabel: { fontSize: font.sm, color: colors.textSecondary },
  price: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
});
