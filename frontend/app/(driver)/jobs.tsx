import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { CATEGORIES, colors, font, radius, spacing, weight } from "@/src/theme";
import { useCategories } from "@/src/hooks/useCatalog";

const RADII = [10, 20, 40, 75, 250];
type PricingFilter = "all" | "fixed" | "bidding";

export default function DriverJobs() {
  const router = useRouter();
  const { data: catalogCategories } = useCategories();
  const [jobs, setJobs] = useState<any[]>([]);
  const [radius_, setRadius] = useState(75);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<any[]>(`/jobs/nearby?radius=${radius_}`);
      setJobs(list);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [radius_]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (category && j.category !== category) return false;
      if (pricing !== "all" && j.pricing_type !== pricing) return false;
      return true;
    });
  }, [jobs, category, pricing]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Jobs</Text>
        <Text style={styles.count}>{filtered.length} jobs</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Radius</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {RADII.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRadius(r)}
              style={[styles.chip, radius_ === r && styles.chipActive]}
              testID={`radius-${r}`}
            >
              <Text style={[styles.chipText, radius_ === r && styles.chipTextActive]}>{r} mi</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>Pricing</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(["all", "fixed", "bidding"] as PricingFilter[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPricing(p)}
              style={[styles.chip, pricing === p && styles.chipActive]}
              testID={`pricing-filter-${p}`}
            >
              <Text style={[styles.chipText, pricing === p && styles.chipTextActive]}>
                {p === "all" ? "All" : p === "fixed" ? "Fixed price" : "Open to bids"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable
            onPress={() => setCategory(null)}
            style={[styles.chip, category === null && styles.chipActive]}
            testID="cat-all"
          >
            <Text style={[styles.chipText, category === null && styles.chipTextActive]}>All</Text>
          </Pressable>
          {(catalogCategories.length > 0 ? catalogCategories : CATEGORIES.map((c) => ({ key: c.id, name: c.label }))).map((c: any) => (
            <Pressable
              key={c.key || c.id}
              onPress={() => setCategory(category === (c.key || c.id) ? null : (c.key || c.id))}
              style={[styles.chip, category === (c.key || c.id) && styles.chipActive]}
              testID={`cat-${c.key || c.id}`}
            >
              <Text style={[styles.chipText, category === (c.key || c.id) && styles.chipTextActive]}>
                {c.name || c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="compass-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No jobs available</Text>
            <Text style={styles.emptySub}>Try expanding your search radius.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(driver)/job/${item.id}`)}
            testID={`driver-job-${item.id}`}
          >
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardCat}>{item.category.replace("_", " ")}</Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={styles.price}>
                  £{item.pricing_type === "fixed" ? item.fixed_price : item.max_budget || item.suggested_price}
                </Text>
                <Text style={styles.priceTag}>
                  {item.pricing_type === "fixed" ? "FIXED" : "MAX"}
                </Text>
              </View>
            </View>
            <View style={styles.routeLine}>
              <View style={styles.routeDotG} />
              <Text style={styles.routeText} numberOfLines={1}>{item.pickup_town}</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.textTertiary} />
              <Text style={styles.routeText} numberOfLines={1}>{item.dropoff_town}</Text>
            </View>
            <View style={styles.cardFoot}>
              <View style={styles.metaChip}>
                <Ionicons name="navigate" size={12} color={colors.textSecondary} />
                <Text style={styles.metaText}>{item.distance_miles} mi</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="location" size={12} color={colors.textSecondary} />
                <Text style={styles.metaText}>{item.distance_from_driver} mi away</Text>
              </View>
              <View style={[styles.metaChip, item.pricing_type === "bidding" && { backgroundColor: colors.brand }]}>
                <Text
                  style={[
                    styles.metaText,
                    item.pricing_type === "bidding" && { color: "#fff", fontWeight: weight.bold },
                  ]}
                >
                  {item.pricing_type === "fixed" ? "Accept" : "Bid"}
                </Text>
              </View>
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
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  title: { fontSize: 30, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  count: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  filterSection: { paddingVertical: spacing.md },
  filterLabel: {
    paddingHorizontal: spacing.xl, fontSize: font.sm, color: colors.textSecondary,
    fontWeight: weight.medium, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: font.base, fontWeight: weight.medium },
  chipTextActive: { color: "#fff" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginTop: spacing.md },
  emptySub: { fontSize: font.base, color: colors.textSecondary },
  card: {
    padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  cardHead: { flexDirection: "row", gap: spacing.md },
  cardTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  cardCat: { fontSize: font.sm, color: colors.textSecondary, textTransform: "capitalize", marginTop: 2 },
  priceCol: { alignItems: "flex-end" },
  price: { fontSize: font.xxl, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.4 },
  priceTag: { fontSize: 10, color: colors.textSecondary, fontWeight: weight.bold, letterSpacing: 0.8 },
  routeLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  routeDotG: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  routeText: { fontSize: font.base, color: colors.text, fontWeight: weight.medium },
  cardFoot: {
    flexDirection: "row", gap: spacing.sm, alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary,
  },
  metaText: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
});
