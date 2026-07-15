import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "suspended">("pending");

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

  const filtered = filter === "all" ? drivers : drivers.filter((d) => d.status === filter);

  async function approve(id: string) {
    await api(`/admin/users/${id}/approve`, { method: "POST" });
    load();
  }
  async function suspend(id: string) {
    await api(`/admin/users/${id}/suspend`, { method: "POST" });
    load();
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Drivers</Text>
        <Text style={styles.count}>{filtered.length} shown</Text>
      </View>

      <View style={styles.filterRow}>
        {(["pending", "active", "suspended", "all"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
            testID={`filter-drivers-${f}`}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-driver-${item.id}`}>
            <View style={styles.head}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>{item.total_jobs} jobs · {item.rating.toFixed(1)}★</Text>
                  <View style={[
                    styles.statusPill,
                    item.status === "pending" && { backgroundColor: "#FEF3C7" },
                    item.status === "suspended" && { backgroundColor: colors.errorBg },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      item.status === "pending" && { color: "#92400E" },
                      item.status === "suspended" && { color: colors.error },
                    ]}>{item.status}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              {item.status === "pending" && (
                <Pressable
                  onPress={() => approve(item.id)}
                  style={[styles.actionBtn, { backgroundColor: colors.success }]}
                  testID={`approve-driver-${item.id}`}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Approve</Text>
                </Pressable>
              )}
              {item.status !== "suspended" && (
                <Pressable
                  onPress={() => suspend(item.id)}
                  style={[styles.actionBtn, { backgroundColor: colors.errorBg }]}
                  testID={`suspend-driver-${item.id}`}
                >
                  <Ionicons name="ban" size={18} color={colors.error} />
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>Suspend</Text>
                </Pressable>
              )}
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
  filterRow: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: font.sm, fontWeight: weight.medium },
  chipTextActive: { color: "#fff" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  card: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, gap: spacing.md,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold },
  name: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  email: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  metaText: { fontSize: font.sm, color: colors.textSecondary },
  statusPill: { backgroundColor: colors.successBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: weight.bold, color: colors.success, textTransform: "uppercase" },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    paddingVertical: spacing.md, borderRadius: radius.pill,
  },
  actionBtnText: { color: "#fff", fontWeight: weight.semibold },
});
