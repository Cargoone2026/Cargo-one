import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function AdminJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<any[]>("/admin/jobs");
      setJobs(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>All Jobs</Text>
        <Text style={styles.count}>{jobs.length} total</Text>
      </View>
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No jobs posted yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-job-${item.id}`}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{item.title}</Text>
                <Text style={styles.jobCat}>{item.category.replace("_", " ")} · {item.pricing_type}</Text>
              </View>
              <StatusPill status={item.status} />
            </View>
            <View style={styles.route}>
              <Ionicons name="location" size={14} color={colors.brand} />
              <Text style={styles.routeText}>{item.pickup_town} → {item.dropoff_town}</Text>
              <Text style={styles.dist}>{item.distance_miles} mi</Text>
            </View>
            <View style={styles.foot}>
              <Text style={styles.meta}>By {item.customer_name}</Text>
              <Text style={styles.price}>
                £{item.pricing_type === "fixed" ? item.fixed_price : (item.accepted_price || item.suggested_price)}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  title: { fontSize: 30, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  count: { fontSize: font.sm, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.textSecondary },
  card: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, gap: spacing.sm,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  jobTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  jobCat: { fontSize: font.sm, color: colors.textSecondary, textTransform: "capitalize", marginTop: 2 },
  route: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  routeText: { flex: 1, fontSize: font.base, color: colors.textSecondary },
  dist: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.semibold },
  foot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  meta: { fontSize: font.sm, color: colors.textSecondary },
  price: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
});
