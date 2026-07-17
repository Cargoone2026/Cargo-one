import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { CATEGORIES, colors, font, radius, spacing, weight } from "@/src/theme";
import { useCapabilities, useCategories } from "@/src/hooks/useCatalog";

const RADII = [10, 20, 40, 75, 250];
type PricingFilter = "all" | "fixed" | "bidding";
type SortKey = "nearest" | "newest" | "highest_price" | "distance_asc";

const SORTS: { key: SortKey; label: string; icon: string }[] = [
  { key: "nearest",        label: "Nearest",         icon: "navigate" },
  { key: "newest",         label: "Newest",          icon: "time" },
  { key: "highest_price",  label: "Highest £",       icon: "trending-up" },
  { key: "distance_asc",   label: "Shortest job",    icon: "resize" },
];

export default function DriverJobs() {
  const router = useRouter();
  const { data: catalogCategories } = useCategories();
  const { data: caps } = useCapabilities();
  const [jobs, setJobs] = useState<any[]>([]);
  const [radius_, setRadius] = useState(75);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingFilter>("all");
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("nearest");
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const toggleCap = useCallback((key: string) => {
    setSelectedCaps((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const resetAll = useCallback(() => {
    setCategory(null);
    setPricing("all");
    setQuery("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedCaps([]);
    setSort("nearest");
  }, []);

  const filtered = useMemo(() => {
    const minP = Number(minPrice) || 0;
    const maxP = Number(maxPrice) || 0;
    const qLower = query.trim().toLowerCase();
    const list = jobs.filter((j) => {
      if (category && j.category !== category) return false;
      if (pricing !== "all" && j.pricing_type !== pricing) return false;
      const price = Number(
        j.pricing_type === "fixed"
          ? j.fixed_price
          : j.max_budget || j.suggested_price || 0,
      );
      if (minP > 0 && price < minP) return false;
      if (maxP > 0 && price > maxP) return false;
      if (qLower) {
        const hay = `${j.title || ""} ${j.description || ""} ${j.pickup_town || ""} ${j.dropoff_town || ""} ${j.pickup_postcode || ""} ${j.dropoff_postcode || ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      if (selectedCaps.length > 0) {
        const jobCaps: string[] = j.required_capabilities || [];
        const ok = selectedCaps.every((c) => jobCaps.includes(c));
        if (!ok) return false;
      }
      return true;
    });
    // sort
    const sorted = [...list];
    if (sort === "nearest") {
      sorted.sort((a, b) => (a.distance_from_driver ?? 999) - (b.distance_from_driver ?? 999));
    } else if (sort === "newest") {
      sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    } else if (sort === "highest_price") {
      const price = (j: any) => Number(j.pricing_type === "fixed" ? j.fixed_price : j.max_budget || j.suggested_price || 0);
      sorted.sort((a, b) => price(b) - price(a));
    } else if (sort === "distance_asc") {
      sorted.sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));
    }
    return sorted;
  }, [jobs, category, pricing, minPrice, maxPrice, query, selectedCaps, sort]);

  const activeFilterCount = [
    category ? 1 : 0,
    pricing !== "all" ? 1 : 0,
    minPrice ? 1 : 0,
    maxPrice ? 1 : 0,
    selectedCaps.length,
  ].reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Jobs</Text>
        <Text style={styles.count}>{filtered.length} of {jobs.length}</Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search title, town or postcode…"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            testID="driver-jobs-search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} testID="driver-jobs-search-clear">
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setShowAdvanced((v) => !v)}
          style={[styles.filterBtn, activeFilterCount > 0 && { backgroundColor: colors.brand }]}
          testID="driver-jobs-advanced-toggle"
        >
          <Ionicons
            name="options"
            size={18}
            color={activeFilterCount > 0 ? "#fff" : colors.text}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SORTS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setSort(s.key)}
              style={[styles.chip, sort === s.key && styles.chipActive]}
              testID={`sort-${s.key}`}
            >
              <Ionicons
                name={s.icon as any}
                size={12}
                color={sort === s.key ? "#fff" : colors.text}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.chipText, sort === s.key && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {showAdvanced && (
        <View style={styles.advancedBox}>
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
                  {p === "all" ? "All" : p === "fixed" ? "Fixed" : "Bidding"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>Price range (£)</Text>
          <View style={styles.priceRow}>
            <TextInput
              value={minPrice}
              onChangeText={setMinPrice}
              placeholder="Min"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              style={styles.priceInput}
              testID="filter-min-price"
            />
            <Text style={styles.priceSep}>–</Text>
            <TextInput
              value={maxPrice}
              onChangeText={setMaxPrice}
              placeholder="Max"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              style={styles.priceInput}
              testID="filter-max-price"
            />
          </View>

          <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable
              onPress={() => setCategory(null)}
              style={[styles.chip, category === null && styles.chipActive]}
              testID="cat-all"
            >
              <Text style={[styles.chipText, category === null && styles.chipTextActive]}>All</Text>
            </Pressable>
            {(catalogCategories.length > 0
              ? catalogCategories
              : CATEGORIES.map((c) => ({ key: c.id, name: c.label }))
            ).map((c: any) => (
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

          {caps.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>Required capabilities</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {caps.map((c) => {
                  const on = selectedCaps.includes(c.key);
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => toggleCap(c.key)}
                      style={[styles.chip, on && styles.chipActive]}
                      testID={`cap-${c.key}`}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextActive]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {activeFilterCount > 0 && (
            <Pressable onPress={resetAll} style={styles.resetBtn} testID="reset-filters">
              <Ionicons name="refresh" size={14} color={colors.brand} />
              <Text style={styles.resetText}>Reset all filters</Text>
            </Pressable>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="compass-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No jobs match your filters</Text>
            <Text style={styles.emptySub}>Try expanding the radius or resetting filters.</Text>
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
                <Text style={styles.cardCat}>{(item.category || "").replace(/_/g, " ")}</Text>
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
                <Text style={styles.metaText}>{item.distance_miles} mi job</Text>
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

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.xl, marginTop: spacing.md,
  },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  searchInput: {
    flex: 1, color: colors.text, fontSize: font.base,
    padding: 0,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {}),
  },
  filterBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  filterBadge: {
    position: "absolute", top: -4, right: -4, backgroundColor: colors.text,
    borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: weight.bold },

  filterSection: { paddingVertical: spacing.md },
  filterLabel: {
    paddingHorizontal: spacing.xl, fontSize: font.sm, color: colors.textSecondary,
    fontWeight: weight.medium, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center",
    flexShrink: 0, flexDirection: "row",
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: font.base, fontWeight: weight.medium },
  chipTextActive: { color: "#fff" },

  advancedBox: {
    backgroundColor: colors.bgSecondary,
    paddingVertical: spacing.md, marginHorizontal: spacing.xl,
    borderRadius: radius.md, gap: spacing.xs, marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  priceInput: {
    flex: 1, height: 40, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, color: colors.text, fontSize: font.base,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {}),
  },
  priceSep: { color: colors.textSecondary, fontWeight: weight.bold },

  resetBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start",
    paddingHorizontal: spacing.xl, marginTop: spacing.sm,
  },
  resetText: { color: colors.brand, fontWeight: weight.semibold, fontSize: font.sm },

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
    flexWrap: "wrap",
  },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary,
  },
  metaText: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
});
