import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<any[]>("/admin/users?role=customer");
      setUsers(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function suspend(id: string) {
    await api(`/admin/users/${id}/suspend`, { method: "POST" });
    load();
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <Text style={styles.count}>{users.length} total</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-user-${item.id}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{item.total_jobs} jobs · {item.rating.toFixed(1)}★</Text>
                <View style={[styles.statusPill, item.status === "suspended" && { backgroundColor: colors.errorBg }]}>
                  <Text style={[styles.statusText, item.status === "suspended" && { color: colors.error }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
            {item.status !== "suspended" && (
              <Pressable
                onPress={() => suspend(item.id)}
                style={styles.suspendBtn}
                testID={`suspend-user-${item.id}`}
              >
                <Ionicons name="ban" size={18} color={colors.error} />
              </Pressable>
            )}
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
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold },
  name: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  email: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  metaText: { fontSize: font.sm, color: colors.textSecondary },
  statusPill: { backgroundColor: colors.successBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: weight.bold, color: colors.success, textTransform: "uppercase" },
  suspendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.errorBg,
    alignItems: "center", justifyContent: "center",
  },
});
