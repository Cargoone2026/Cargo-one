/**
 * MessagesScreen — mirrors the web /customer/messages page.
 * Two segments: Conversations (message threads) and Notifications
 * (system inbox from /api/notifications). Both feeds tolerate absent
 * backend endpoints gracefully (CustomerAPI wrappers catch → []).
 */
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomerAPI } from "@cargoone/core";

const RED = "#D62828";

type Tab = "conversations" | "notifications";

export function MessagesScreen({ route }: any) {
  const initial: Tab = route?.params?.tab === "notifications" ? "notifications" : "conversations";
  const [tab, setTab] = useState<Tab>(initial);
  const [threads, setThreads] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [t, n] = await Promise.all([CustomerAPI.listThreads(), CustomerAPI.listNotifications()]);
    setThreads(Array.isArray(t) ? t : []);
    setNotifs(Array.isArray(n) ? n : []);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} testID="messages-screen">
      <View style={styles.tabs}>
        <TabButton label="Conversations" active={tab === "conversations"} onPress={() => setTab("conversations")} />
        <TabButton label="Notifications" active={tab === "notifications"} onPress={() => setTab("notifications")} />
      </View>
      {tab === "conversations" ? (
        <FlatList
          data={threads}
          keyExtractor={(item, i) => item.id || String(i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={RED} />}
          ListEmptyComponent={<Empty title="No conversations yet" body="Messages with drivers appear here when a booking is active." />}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`thread-${item.id}`}>
              <Text style={styles.rowTitle}>{item.title || item.driver_name || "Conversation"}</Text>
              {item.preview ? <Text style={styles.rowBody} numberOfLines={2}>{item.preview}</Text> : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item, i) => item.id || String(i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={RED} />}
          ListEmptyComponent={<Empty title="You're up to date" body="System updates about your bookings and payments will show here." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.id && CustomerAPI.markNotificationRead(item.id).then(load)}
              style={[styles.row, item.read_at ? null : styles.unread]}
              testID={`notif-${item.id}`}
            >
              <Text style={styles.rowTitle}>{item.title || "Update"}</Text>
              {item.body ? <Text style={styles.rowBody}>{item.body}</Text> : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]} testID={`tab-${label.toLowerCase()}`}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  tabs: { flexDirection: "row", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: RED },
  tabLabel: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  tabLabelActive: { color: RED },
  row: { backgroundColor: "#FFFFFF", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  unread: { backgroundColor: "#FEF2F2" },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  rowBody: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  empty: { padding: 40, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 },
  emptyBody: { fontSize: 13, color: "#6B7280", textAlign: "center" },
});
