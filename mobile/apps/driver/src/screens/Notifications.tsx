/**
 * NotificationsScreen — driver notifications inbox.
 *
 * R71.16.10 (Driver P2) — ports the web
 * `frontend/src/pages/portal/driver/Notifications.jsx` faithfully:
 *   • GET /notifications (via DriverAPI.listNotifications).
 *   • Auto-refreshes when the useNotificationChime hook detects a
 *     new unread count.
 *   • Tap row → mark-read + open detail; unread rows are highlighted
 *     with a red left-tint and a red dot on the right.
 *   • Detail supports "Open booking" / "Open job" deep-links via
 *     data.booking_id / data.job_id (matches the web behaviour).
 *   • Mute / unmute chime toggle in header.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ArrowLeft,
  Bell,
  ExternalLink,
  MessagesSquare,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import { DriverAPI, DriverNotification } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";
import { useNotificationChime } from "../hooks/useNotificationChime";
import type { RootStackParamList } from "../App";

export function NotificationsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();
  const chime = useNotificationChime({ enabled: true });
  const [notes, setNotes] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<DriverNotification | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const n = await DriverAPI.listNotifications();
      setNotes(Array.isArray(n) ? n : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch whenever the chime tick reports a new unread count.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chime.unread]);

  const markRead = useCallback(async (id: string) => {
    try {
      await DriverAPI.markNotificationRead(id);
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      /* silent */
    }
  }, []);

  const pick = (n: DriverNotification) => {
    setSelected(n);
    if (!n.read) markRead(n.id);
  };

  const openDeepLink = (n: DriverNotification) => {
    const bid = n.data?.booking_id;
    const jid = n.data?.job_id;
    if (typeof bid === "string" && bid) {
      nav.navigate("ActiveBooking", { bookingId: bid });
    } else if (typeof jid === "string" && jid) {
      nav.navigate("JobDetail", { jobId: jid });
    }
  };

  // Detail view (full-screen on mobile — matches web md- viewport rule).
  if (selected) {
    const target =
      selected.data?.booking_id
        ? { label: "Open booking", exists: true }
        : selected.data?.job_id
        ? { label: "Open job", exists: true }
        : { label: "", exists: false };
    return (
      <Page testID="driver-notifications-thread" scroll={false}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => setSelected(null)}
              testID="driver-notification-back-button"
              hitSlop={8}
              style={styles.backBtn}
            >
              <ArrowLeft size={18} color={colors.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: colors.brand }}>
                NOTIFICATION
              </Text>
              <Text style={[typography.h2, { marginTop: 4 }]} numberOfLines={2}>
                {selected.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.inkFaint, marginTop: 4 }}>
                {formatWhen(selected.created_at, true)}
              </Text>
            </View>
          </View>
          <Text style={[typography.body, { lineHeight: 22 }]}>{selected.body}</Text>
          {target.exists ? (
            <Pressable
              onPress={() => openDeepLink(selected)}
              testID="driver-notification-open-link"
              style={({ pressed }) => [
                styles.deepLinkBtn,
                pressed && { backgroundColor: colors.brand },
              ]}
            >
              <ExternalLink size={14} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>
                {target.label}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </Page>
    );
  }

  return (
    <Page testID="driver-notifications" scroll={false}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />
        }
      >
        <PageHeader
          large
          title="Notifications"
          subtitle="Updates from dispatch, bookings and payments."
          showMenu={showMenu}
          onMenuPress={openDrawer}
          right={
            <Pressable
              onPress={() => chime.setEnabled(!chime.enabled)}
              testID="driver-notif-chime-toggle"
              accessibilityRole="button"
              accessibilityLabel={chime.enabled ? "Mute chime" : "Unmute chime"}
              style={({ pressed }) => [
                styles.chimeBtn,
                { backgroundColor: chime.enabled ? colors.bgSecondary : colors.bgTertiary },
                pressed && { opacity: 0.85 },
              ]}
            >
              {chime.enabled ? (
                <Volume2 size={16} color={colors.ink} />
              ) : (
                <VolumeX size={16} color={colors.inkMuted} />
              )}
            </Pressable>
          }
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }} testID="driver-notifications-list">
          {loading && notes.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : notes.length === 0 ? (
            <View style={styles.emptyState} testID="driver-notifications-empty">
              <MessagesSquare size={40} color={colors.inkFaint} />
              <Text style={[typography.cardTitle, { marginTop: 8, textAlign: "center" }]}>
                No notifications yet
              </Text>
              <Text style={[typography.caption, { textAlign: "center", marginTop: 4 }]}>
                Dispatch, payment and message events will land here.
              </Text>
            </View>
          ) : (
            notes.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => pick(n)}
                testID={`driver-notification-row-${n.id}`}
                style={({ pressed }) => [
                  styles.row,
                  !n.read && styles.rowUnread,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={styles.rowIcon}>
                  <Bell size={16} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.inkMuted, marginTop: 2 }} numberOfLines={1}>
                    {n.body}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.inkFaint, marginTop: 4 }}>
                    {formatWhen(n.created_at)}
                  </Text>
                </View>
                {!n.read ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

function formatWhen(iso: string | undefined, verbose = false) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    if (!verbose) {
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return "Just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return d.toLocaleDateString();
    }
    return d.toLocaleString();
  } catch {
    return "";
  }
}

const styles = {
  chimeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bgSecondary,
  },
  deepLinkBtn: {
    marginTop: 8,
    alignSelf: "flex-start" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 4,
  },
  row: {
    flexDirection: "row" as const,
    gap: 12,
    padding: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bg,
    marginBottom: 8,
  },
  rowUnread: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    alignSelf: "flex-start" as const,
    marginTop: 6,
  },
};
