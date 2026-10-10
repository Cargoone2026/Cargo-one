/**
 * NotificationsScreen — Driver mobile port of
 * frontend/src/pages/portal/driver/Notifications.jsx.
 *
 * Single list view (mobile uses list → tap → full detail → back). Uses
 * DriverAPI.listNotifications / markNotificationRead. Deep-links into
 * BookingDetail or JobDetail based on the notification's `data`.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DriverAPI, type DriverNotification } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { resolveDriverRoute } from "../pushRoutes";
import {
  Card, EmptyState, Icon, Page, PageHeader, PrimaryButton, Section,
  colors, radius, space, typography,
} from "../ui";

export default function NotificationsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notes, setNotes] = useState<DriverNotification[]>([]);
  const [selected, setSelected] = useState<DriverNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const n = await DriverAPI.listNotifications();
      setNotes(Array.isArray(n) ? n : []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pick = async (n: DriverNotification) => {
    setSelected(n);
    if (!n.read) {
      setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await DriverAPI.markNotificationRead(n.id).catch(() => {});
    }
  };

  const route = selected ? resolveDriverRoute({ ...(selected.data || {}), title: selected.title }) : null;

  const openTarget = () => {
    if (!route) return;
    (nav as any).navigate(route.name, "params" in route ? route.params : undefined);
  };

  const goBackList = () => setSelected(null);

  if (selected) {
    const targetLabel =
      route?.name === "BookingDetail"
        ? route.params.initialTab === "messages" ? "Open chat" : route.params.initialTab === "pod" ? "Open POD" : "Open booking"
        : route?.name === "JobDetail" ? "Open job"
        : route?.name === "Documents" ? "Open documents"
        : null;
    return (
      <Page testID="driver-notification-detail">
        <PageHeader title="Notification" onBack={goBackList} />
        <Section gap={space[3]}>
          <Card>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.brand }}>
              NOTIFICATION
            </Text>
            <Text style={[typography.h2, { marginTop: 6 }]}>{selected.title}</Text>
            <Text style={[typography.small, { marginTop: 4 }]}>
              {formatWhen(selected.created_at, true)}
            </Text>
            {selected.body ? (
              <Text style={[typography.body, { marginTop: space[3], lineHeight: 20 }]}>
                {selected.body}
              </Text>
            ) : null}
            {targetLabel ? (
              <View style={{ marginTop: space[4] }}>
                <PrimaryButton
                  title={targetLabel}
                  onPress={openTarget}
                  testID="driver-notification-open-link"
                />
              </View>
            ) : null}
          </Card>
        </Section>
      </Page>
    );
  }

  return (
    <Page
      testID="driver-notifications"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
    >
      <PageHeader
        title="Notifications"
        subtitle="Updates from dispatch, bookings and payments."
        large
      />
      <Section gap={space[2]}>
        {loading && notes.length === 0 ? (
          <Text style={[typography.caption, { textAlign: "center", paddingVertical: space[6] }]}>
            Loading…
          </Text>
        ) : notes.length === 0 ? (
          <EmptyState
            glyph="bell"
            title="No notifications yet"
            body="Dispatch, payment and message events will land here."
            testID="driver-notifications-empty"
          />
        ) : (
          notes.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => pick(n)}
              testID={`driver-notification-row-${n.id}`}
              style={({ pressed }) => [
                styles.row,
                !n.read && styles.unread,
                pressed && { borderColor: colors.ink },
              ]}
            >
              <View style={styles.rowIcon}>
                <Icon name="bell" size={16} color={colors.brand} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[typography.strong, { fontSize: 14, flex: 1 }]} numberOfLines={1}>
                    {n.title || "Update"}
                  </Text>
                  {!n.read ? <View style={styles.pip} /> : null}
                </View>
                {n.body ? (
                  <Text style={[typography.caption, { marginTop: 2 }]} numberOfLines={2}>
                    {n.body}
                  </Text>
                ) : null}
                <Text style={[typography.small, { marginTop: 4 }]}>
                  {formatWhen(n.created_at)}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </Section>
    </Page>
  );
}

function formatWhen(iso?: string, verbose = false): string {
  if (!iso) return "";
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
  rowIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: colors.brandTint,
  },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
} as const;
