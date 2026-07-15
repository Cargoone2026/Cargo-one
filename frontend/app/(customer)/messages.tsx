import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function Messages() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const n = await api<any[]>("/notifications");
      setNotes(n);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
      </View>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="messages-empty">
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySub}>Updates about your shipments will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[styles.row, !item.read && { backgroundColor: "#FEF2F2" }]}
            testID={`notification-row-${item.id}`}
          >
            <View style={styles.icon}>
              <Ionicons name="notifications" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowBody}>{item.body}</Text>
              <Text style={styles.rowTs}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            {!item.read && <View style={styles.unread} />}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  title: { fontSize: 30, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginTop: spacing.md },
  emptySub: { fontSize: font.base, color: colors.textSecondary, textAlign: "center", paddingHorizontal: spacing.xl },
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg,
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  icon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#FEE2E2",
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  rowBody: { fontSize: font.base, color: colors.textSecondary, marginTop: 2 },
  rowTs: { fontSize: font.sm, color: colors.textTertiary, marginTop: spacing.xs },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
});
