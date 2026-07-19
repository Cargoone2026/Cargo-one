import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Filter = "all" | "pending" | "changes_requested" | "active" | "suspended";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "changes_requested", label: "Changes requested" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "all", label: "All" },
];

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  active:            { bg: "#DCFCE7", fg: "#166534", label: "Active" },
  pending:           { bg: "#FEF3C7", fg: "#92400E", label: "Pending" },
  changes_requested: { bg: "#FEE2E2", fg: "#991B1B", label: "Changes requested" },
  suspended:         { bg: "#FEE2E2", fg: "#991B1B", label: "Suspended" },
};

export default function AdminDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<any[]>("/admin/users?role=driver");
      setDrivers(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    let list = filter === "all" ? drivers : drivers.filter((d) => d.status === filter);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((d) =>
        `${d.name || ""} ${d.email || ""} ${d.id || ""}`.toLowerCase().includes(term),
      );
    }
    return list;
  }, [drivers, filter, q]);

  const pendingCount = drivers.filter((d) => d.status === "pending").length;
  const changesCount = drivers.filter((d) => d.status === "changes_requested").length;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Drivers</Text>
          <Text style={styles.count}>
            {filtered.length} shown · {pendingCount} pending review
            {changesCount > 0 ? ` · ${changesCount} awaiting driver` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by name, email or ID…"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            testID="admin-drivers-search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ("")} testID="admin-drivers-search-clear">
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            testID={`filter-drivers-${f.key}`}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {q ? "No matching drivers." : `No drivers with status "${filter}".`}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = STATUS_PILL[item.status] || { bg: colors.bgSecondary, fg: colors.text, label: item.status };
          const needsReview = item.status === "pending" || item.status === "changes_requested";
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(admin)/driver/${item.id}`)}
              testID={`admin-driver-${item.id}`}
            >
              <View style={styles.headRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.name || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  <View style={styles.meta}>
                    <Text style={styles.metaText}>
                      {item.total_jobs} jobs · {Number(item.rating || 5).toFixed(1)}★
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </View>

              <Pressable
                onPress={() => router.push(`/(admin)/driver/${item.id}`)}
                style={[
                  styles.reviewBtn,
                  needsReview ? { backgroundColor: colors.brand } : { backgroundColor: colors.bgSecondary },
                ]}
                testID={`review-driver-${item.id}`}
              >
                <Ionicons
                  name="document-text"
                  size={16}
                  color={needsReview ? "#fff" : colors.text}
                />
                <Text
                  style={[
                    styles.reviewBtnText,
                    { color: needsReview ? "#fff" : colors.text },
                  ]}
                >
                  {needsReview ? "Review application" : "View details"}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
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
  count: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  searchWrap: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  searchInput: {
    flex: 1, color: colors.text, fontSize: font.base, padding: 0,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {}),
  },
  filterRow: {
    flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm,
    marginBottom: spacing.md, flexWrap: "wrap",
  },
  chip: {
    height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: font.sm, fontWeight: weight.medium },
  chipTextActive: { color: "#fff" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: font.base },
  card: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, gap: spacing.md,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold },
  name: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  email: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs, flexWrap: "wrap" },
  metaText: { fontSize: font.sm, color: colors.textSecondary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  statusText: { fontSize: 10, fontWeight: weight.bold, textTransform: "uppercase", letterSpacing: 0.5 },
  reviewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    paddingVertical: spacing.md, borderRadius: radius.pill,
  },
  reviewBtnText: { fontWeight: weight.bold, fontSize: font.base },
});
