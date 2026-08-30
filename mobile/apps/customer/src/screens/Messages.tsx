/**
 * MessagesScreen — 1:1 port of frontend/src/pages/portal/customer/Messages.jsx.
 *
 * Two tabs:
 *   • Conversations — sourced from GET /messages/summary. One row per PAID
 *     booking with the latest driver message preview, unread pip, "Read"/
 *     "Delivered" tick on the customer's own last message, and a
 *     WhatsApp-style relative timestamp (Today = HH:MM, yesterday = "Yesterday",
 *     else short date).
 *   • Notifications — sourced from GET /notifications. Bell icon list with
 *     title, body, and a full timestamp. Tapping marks as read.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { CustomerAPI } from "@cargoone/core";
import { Bell, MessagesSquare } from "lucide-react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { RootStackParamList } from "../App";
import { useShellMenu } from "../components/AppShell";
import { colors, radius, typography } from "../theme";
import { EmptyState, Page, PageHeader, SegmentedTabs } from "../ui";

type Tab = "conversations" | "notifications";

export function MessagesScreen({ route }: any) {
  const initial: Tab = route?.params?.tab === "notifications" ? "notifications" : "conversations";
  const { openDrawer, showMenu } = useShellMenu();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    // Match web behaviour: refresh conversation previews every 20s while
    // this tab is open.
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [load]);

  const totalUnread = useMemo(
    () => threads.reduce((s, t) => s + (t.unread_count || 0), 0),
    [threads],
  );

  return (
    <Page testID="messages-screen">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <PageHeader large title="Inbox" showMenu={showMenu} onMenuPress={openDrawer} />
        <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 32 }}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "conversations" as const, label: totalUnread > 0 ? `Conversations · ${totalUnread}` : "Conversations" },
              { value: "notifications" as const, label: "Notifications" },
            ]}
            testIDPrefix="inbox-tab"
          />

          {tab === "conversations" ? (
            threads.length === 0 ? (
              <EmptyState
                Icon={MessagesSquare}
                title="No active conversations yet"
                body="When a driver accepts your booking and you pay the deposit, you can chat with them here."
                testID="conversations-empty"
              />
            ) : (
              threads.map((t) => (
                <ConversationRow
                  key={t.booking_id}
                  t={t}
                  onPress={() => nav.navigate("BookingDetail", { bookingId: t.booking_id })}
                />
              ))
            )
          ) : notifs.length === 0 ? (
            <EmptyState
              Icon={Bell}
              title="No notifications"
              body="Updates about your shipments will appear here."
              testID="messages-empty"
            />
          ) : (
            notifs.map((n) => <NotificationRow key={n.id} n={n} onPress={() => onOpenNotif(n, nav, setNotifs)} />)
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

async function onOpenNotif(
  n: any,
  nav: NativeStackNavigationProp<RootStackParamList>,
  setNotifs: React.Dispatch<React.SetStateAction<any[]>>,
) {
  if (!n.read) {
    setNotifs((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    CustomerAPI.markNotificationRead(n.id).catch(() => {});
  }
  const d = n.data || {};
  if (d.booking_id) nav.navigate("BookingDetail", { bookingId: d.booking_id });
  else if (d.job_id) nav.navigate("JobDetail", { jobId: d.job_id });
}

function ConversationRow({ t, onPress }: { t: any; onPress: () => void }) {
  const initials = (t.counterparty?.name || "?")
    .split(" ")
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const last = t.last_message;
  const preview = last
    ? last.moderated
      ? "Contact details were hidden by Cargo One."
      : last.has_photo && !last.text
      ? "📷 Photo"
      : last.text || ""
    : "No messages yet — say hi 👋";
  let tick: string | null = null;
  if (last?.mine) {
    tick = last.read_at ? "✓✓ Read" : last.delivered_at ? "✓✓ Delivered" : "✓ Sent";
  }
  return (
    <Pressable onPress={onPress} style={styles.row} testID={`conversation-row-${t.booking_id}`}>
      {t.counterparty?.profile_photo ? (
        <Image source={{ uri: t.counterparty.profile_photo }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initials || "?"}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowHead}>
          <Text style={styles.name} numberOfLines={1}>
            {t.counterparty?.name || "Driver"}
          </Text>
          <Text style={styles.time} testID={`conversation-time-${t.booking_id}`}>
            {last ? formatShortWhen(last.created_at) : ""}
          </Text>
        </View>
        <Text
          style={[
            styles.preview,
            t.unread_count > 0 && last && !last.mine ? { color: colors.ink, fontWeight: "700" } : null,
          ]}
          numberOfLines={2}
        >
          {last?.mine ? <Text style={{ color: colors.inkMuted }}>You: </Text> : null}
          {preview}
        </Text>
        <View style={styles.rowFoot}>
          <Text style={styles.footTxt} numberOfLines={1}>
            {t.job_title}
            {t.pickup_town && t.dropoff_town ? ` · ${t.pickup_town} → ${t.dropoff_town}` : ""}
          </Text>
          {last?.mine && tick ? (
            <Text style={styles.tick}>{tick}</Text>
          ) : t.unread_count > 0 ? (
            <View style={styles.unreadPip} testID={`conversation-unread-${t.booking_id}`}>
              <Text style={styles.unreadPipTxt}>
                {t.unread_count > 99 ? "99+" : t.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function NotificationRow({ n, onPress }: { n: any; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !n.read && styles.unread]}
      testID={`notification-row-${n.id}`}
    >
      <View style={styles.notifIcon}>
        <Bell size={16} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {n.title || "Update"}
        </Text>
        {n.body ? (
          <Text style={styles.preview} numberOfLines={2}>
            {n.body}
          </Text>
        ) : null}
        <Text style={styles.time} testID={`notification-time-${n.id}`}>
          {formatWhen(n.created_at, true)}
        </Text>
      </View>
      {!n.read ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

/** Short conversation-preview timestamp — matches web `formatShortWhen`. */
function formatShortWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Notification timestamp — matches web `formatWhen`. */
function formatWhen(iso?: string, long = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return long ? d.toLocaleString() : d.toLocaleDateString();
}

const styles = {
  row: {
    flexDirection: "row" as const,
    gap: 12,
    padding: 14,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  unread: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: "#111111",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  avatarInitial: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" as const },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "#FEE2E2",
  },
  rowHead: { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 8 },
  rowFoot: { marginTop: 6, flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 8, alignItems: "center" as const },
  name: { flex: 1, fontSize: 15, fontWeight: "700" as const, color: colors.ink },
  time: { fontSize: 11, color: colors.inkMuted },
  preview: { marginTop: 2, fontSize: 13, color: colors.inkMuted },
  footTxt: { flex: 1, fontSize: 11, color: colors.inkMuted },
  tick: { fontSize: 10, color: colors.inkMuted },
  unreadPip: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
  },
  unreadPipTxt: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" as const },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 4 },
} as const;
