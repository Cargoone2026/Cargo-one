import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function MyJobs() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await api<any[]>("/bookings/mine");
      setItems(b);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <Text style={styles.count}>{items.length} total</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No jobs yet</Text>
            <Text style={styles.emptySub}>Accept or bid on nearby jobs to see them here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(driver)/booking/${item.id}`)}
            testID={`driver-myjob-${item.id}`}
          >
            <View style={styles.head}>
              <Text style={styles.cardTitle}>{item.job?.title || "Job"}</Text>
              <StatusPill status={item.status} />
            </View>
            <View style={styles.routeRow}>
              <Ionicons name="location" size={14} color={colors.brand} />
              <Text style={styles.routeText}>
                {item.job?.pickup_town} → {item.job?.dropoff_town}
              </Text>
            </View>
            <View style={styles.foot}>
              <View>
                <Text style={styles.priceLabel}>Your earning</Text>
                <Text style={styles.price}>£{Number(item.driver_charge ?? item.total_price).toFixed(0)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: 30, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  count: { fontSize: font.sm, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginTop: spacing.md },
  emptySub: { fontSize: font.base, color: colors.textSecondary, textAlign: "center", paddingHorizontal: spacing.xl },
  card: {
    padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { flex: 1, fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginRight: spacing.sm },
  routeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  routeText: { flex: 1, fontSize: font.base, color: colors.textSecondary },
  foot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  priceLabel: { fontSize: font.sm, color: colors.textSecondary },
  price: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
});
