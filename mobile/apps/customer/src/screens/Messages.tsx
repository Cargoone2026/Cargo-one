/**
 * MessagesScreen — 1:1 port of frontend/src/pages/portal/customer/Messages.jsx.
 * Segmented Conversations / Notifications with Cargo One card treatment.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { CustomerAPI } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { EmptyState, Page, PageHeader, SegmentedTabs } from "../ui";
import { MessagesSquare, Bell } from "lucide-react-native";
import { useShellMenu } from "../components/AppShell";

type Tab = "conversations" | "notifications";

export function MessagesScreen({ route }: any) {
  const initial: Tab = route?.params?.tab === "notifications" ? "notifications" : "conversations";
  const { openDrawer, showMenu } = useShellMenu();
  const [tab, setTab] = useState<Tab>(initial);
  const [threads, setThreads] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [t, n] = await Promise.all([
      CustomerAPI.listThreads().catch(() => []),
      CustomerAPI.listNotifications().catch(() => []),
    ]);
    setThreads(Array.isArray(t) ? t : []);
    setNotifs(Array.isArray(n) ? n : []);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page testID="messages-screen">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <PageHeader large title="Messages" showMenu={showMenu} onMenuPress={openDrawer} />
        <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 32 }}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "conversations" as const, label: "Conversations" },
              { value: "notifications" as const, label: "Notifications" },
            ]}
            testIDPrefix="messages-tab"
          />

          {tab === "conversations" ? (
            threads.length === 0 ? (
              <EmptyState
                Icon={MessagesSquare}
                title="No conversations yet"
                body="Messages with drivers appear here when a booking is active."
              />
            ) : (
              threads.map((it) => (
                <View key={it.id} style={styles.row} testID={`thread-${it.id}`}>
                  <Text style={typography.cardTitle}>{it.title || it.driver_name || "Conversation"}</Text>
                  {it.preview ? (
                    <Text style={typography.caption} numberOfLines={2}>
                      {it.preview}
                    </Text>
                  ) : null}
                </View>
              ))
            )
          ) : notifs.length === 0 ? (
            <EmptyState
              Icon={Bell}
              title="You're up to date"
              body="System updates about your bookings and payments will show here."
            />
          ) : (
            notifs.map((it) => (
              <Pressable
                key={it.id}
                onPress={() => it.id && CustomerAPI.markNotificationRead(it.id).then(load)}
                style={[styles.row, !it.read_at && styles.unread]}
                testID={`notif-${it.id}`}
              >
                <Text style={typography.cardTitle}>{it.title || "Update"}</Text>
                {it.body ? <Text style={typography.caption}>{it.body}</Text> : null}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  row: {
    padding: 14,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 6,
  },
  unread: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
} as const;
