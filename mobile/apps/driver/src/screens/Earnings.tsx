/**
 * EarningsScreen — Driver mobile port of frontend/src/pages/portal/driver/Earnings.jsx.
 *
 * Pulls /bookings/mine, buckets into Earned (delivered/pod_uploaded/
 * completed) and In Progress (post-claim pre-delivery), renders:
 *   • Dark total-earned hero (mirrors web Earnings hero + Customer's
 *     HeroCard treatment)
 *   • Two-up stats grid: Pending / In progress
 *   • Info banner explaining Cargo One's booking-fee model
 *   • Recent Deliveries list (earned bucket, most recent first)
 *
 * No invented endpoints — identical bucket logic to Driver web.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { DriverAPI, type Booking } from "@cargoone/core";
import {
  Card, EmptyState, HeroCard, Icon, Page, PageHeader, Section, StatCell,
  colors, radius, space, typography,
} from "../ui";

const EARNED = new Set(["delivered", "pod_uploaded", "completed"]);
const IN_PROGRESS = new Set([
  "accepted", "deposit_paid", "confirmed",
  "travelling", "arrived", "collected", "on_route",
]);

export default function EarningsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const b = await DriverAPI.myBookings().catch(() => [] as Booking[]);
      setBookings(Array.isArray(b) ? b : []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const earned = bookings.filter((b) => EARNED.has(b.status));
    const upcoming = bookings.filter((b) => IN_PROGRESS.has(b.status));
    const total = earned.reduce(
      (a, b: any) => a + Number(b.driver_charge ?? b.balance_due ?? 0), 0,
    );
    const pending = upcoming.reduce(
      (a, b: any) => a + Number(b.driver_charge ?? b.balance_due ?? 0), 0,
    );
    return { total, pending, completed: earned.length, upcoming: upcoming.length };
  }, [bookings]);

  const recent = useMemo(
    () =>
      bookings
        .filter((b) => EARNED.has(b.status))
        .sort((a: any, b: any) =>
          String(b.completed_at || b.created_at || "").localeCompare(
            String(a.completed_at || a.created_at || ""),
          ),
        )
        .slice(0, 10),
    [bookings],
  );

  return (
    <Page
      testID="driver-earnings"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
    >
      <PageHeader title="Earnings" large />
      <Section gap={space[3]}>
        {/* Dark total-earned hero */}
        <HeroCard
          testID="earnings-hero"
          eyebrow="Total earned"
          title={`£${stats.total.toFixed(2)}`}
        >
          <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 14 }}>
            {stats.completed} completed deliver{stats.completed === 1 ? "y" : "ies"}
          </Text>
        </HeroCard>

        {/* Pending / In Progress stats */}
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <View
            style={[styles.statTile, { backgroundColor: "#FFF7ED" }]}
            testID="earnings-pending"
          >
            <Icon name="clock" size={18} color={colors.accentDark} />
            <Text style={styles.statValue}>£{stats.pending.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Pending balance</Text>
          </View>
          <View
            style={[styles.statTile, { backgroundColor: colors.successBg }]}
            testID="earnings-inprogress"
          >
            <Icon name="check-circle" size={18} color={colors.success} />
            <Text style={styles.statValue}>{stats.upcoming}</Text>
            <Text style={styles.statLabel}>In progress</Text>
          </View>
        </View>

        {/* Info banner */}
        <View style={styles.info} testID="earnings-info">
          <Icon name="info" size={18} color={colors.infoInk} />
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.ink }}>
            You receive the balance directly from customers on delivery.
            Cargo One only collects the platform booking fee via Stripe.
          </Text>
        </View>

        <Text style={[typography.sectionTitle, { marginTop: space[2] }]}>Recent Deliveries</Text>

        {loading && recent.length === 0 ? (
          <Text style={[typography.caption, { textAlign: "center", paddingVertical: space[4] }]}>
            Loading…
          </Text>
        ) : recent.length === 0 ? (
          <EmptyState
            glyph="truck"
            title="No completed deliveries yet"
            body="Finish a job and the earning will appear here."
            testID="earnings-empty"
          />
        ) : (
          <Card>
            {recent.map((b: any, i) => (
              <View
                key={b.id}
                testID={`earning-${b.id}`}
                style={{
                  flexDirection: "row", alignItems: "center",
                  gap: space[3], paddingVertical: 10,
                  borderBottomWidth: i < recent.length - 1 ? 1 : 0,
                  borderBottomColor: colors.hairline,
                }}
              >
                <View style={styles.rowIcon}>
                  <Icon name="check-circle" size={16} color={colors.success} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.strong, { fontSize: 14 }]} numberOfLines={1}>
                    {b.job?.title || "Delivery"}
                  </Text>
                  <Text style={typography.small}>
                    {formatDate(b.completed_at || b.created_at)}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.success }}>
                  +£{Number(b.driver_charge ?? b.balance_due ?? 0).toFixed(0)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </Section>
    </Page>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

const styles = {
  statTile: {
    flex: 1,
    padding: space[4],
    borderRadius: radius.base,
    gap: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  statLabel: { fontSize: 13, color: colors.inkMuted },
  info: {
    flexDirection: "row" as const,
    gap: space[3],
    padding: space[4],
    borderRadius: radius.base,
    backgroundColor: colors.infoBg,
    alignItems: "flex-start" as const,
  },
  rowIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.successBg,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
} as const;
