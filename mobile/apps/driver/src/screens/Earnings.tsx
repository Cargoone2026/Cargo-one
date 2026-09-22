/**
 * EarningsScreen — driver earnings dashboard.
 *
 * R71.16.10 (Driver P2) — ports the web
 * `frontend/src/pages/portal/driver/Earnings.jsx` bucket logic:
 *   • Total earned = bookings whose status ∈ {delivered, pod_uploaded, completed}
 *     driver_charge summed.
 *   • Pending  = bookings whose status ∈ {accepted, deposit_paid, confirmed,
 *     travelling, arrived, collected, on_route} driver_charge summed.
 *   • Recent Deliveries = same "earned" set, most recent first, 10 rows.
 *   • Cancellation history = DriverAPI.myCancellations() rows.
 *
 * The mobile screen adds pull-to-refresh + safe null handling; the web
 * uses window focus refresh (n/a in RN).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { CheckCircle2, Hourglass, Info } from "lucide-react-native";
import {
  Booking,
  DriverAPI,
  DriverCancellationRow,
  money,
} from "@cargoone/core";
import { Page, PageHeader } from "../ui";
import { colors, radius, typography } from "../theme";
import { useShellMenu } from "../components/AppShell";

const EARNED = new Set(["delivered", "pod_uploaded", "completed"]);
const IN_PROGRESS = new Set([
  "accepted",
  "deposit_paid",
  "confirmed",
  "travelling",
  "arrived",
  "collected",
  "on_route",
]);

export function EarningsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cancellations, setCancellations] = useState<DriverCancellationRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { openDrawer, showMenu } = useShellMenu();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [b, c] = await Promise.all([
        DriverAPI.myBookings().catch(() => [] as Booking[]),
        DriverAPI.myCancellations().catch(() => [] as DriverCancellationRow[]),
      ]);
      setBookings(Array.isArray(b) ? b : []);
      setCancellations(Array.isArray(c) ? c : []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const earned = bookings.filter((b: any) => EARNED.has(b.status));
    const upcoming = bookings.filter((b: any) => IN_PROGRESS.has(b.status));
    const totalNum = earned.reduce(
      (a, b: any) => a + Number(b?.driver_charge ?? b?.balance_due ?? 0),
      0,
    );
    const pendingNum = upcoming.reduce(
      (a, b: any) => a + Number(b?.driver_charge ?? b?.balance_due ?? 0),
      0,
    );
    return {
      total: totalNum,
      pending: pendingNum,
      completed: earned.length,
      upcoming: upcoming.length,
    };
  }, [bookings]);

  const completed = useMemo(
    () =>
      bookings
        .filter((b: any) => EARNED.has(b.status))
        .sort((a: any, b: any) =>
          String(b?.completed_at || b?.created_at || "").localeCompare(
            String(a?.completed_at || a?.created_at || ""),
          ),
        )
        .slice(0, 10),
    [bookings],
  );

  return (
    <Page testID="driver-earnings" scroll={false}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <PageHeader
          large
          title="Earnings"
          subtitle="Your delivery earnings and pending balance."
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <View style={styles.hero} testID="earnings-hero">
            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "rgba(255,255,255,0.6)" }}>
              TOTAL EARNED
            </Text>
            <Text style={styles.heroValue}>{money(stats.total)}</Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
              {stats.completed} completed deliveries
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={[styles.statCard, { backgroundColor: "#FFF7ED" }]} testID="earnings-pending">
              <Hourglass size={18} color={colors.accent} />
              <Text style={styles.statValue}>£{stats.pending.toFixed(0)}</Text>
              <Text style={typography.caption}>Pending balance</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#F0FDF4" }]} testID="earnings-inprogress">
              <CheckCircle2 size={18} color={colors.success} />
              <Text style={styles.statValue}>{stats.upcoming}</Text>
              <Text style={typography.caption}>In progress</Text>
            </View>
          </View>

          <View style={styles.infoBox} testID="earnings-info">
            <Info size={16} color="#2563EB" />
            <Text style={{ flex: 1, fontSize: 13, color: colors.ink, lineHeight: 20 }}>
              You receive the balance directly from customers on delivery. Cargo One only collects the platform booking fee via Stripe.
            </Text>
          </View>

          <Text style={[typography.h2, { marginTop: 4 }]}>Recent Deliveries</Text>
          {refreshing && completed.length === 0 ? (
            <Text style={typography.caption}>Loading…</Text>
          ) : completed.length === 0 ? (
            <View style={styles.emptyBox} testID="earnings-empty">
              <Text style={[typography.caption, { textAlign: "center" }]}>
                No completed deliveries yet.
              </Text>
            </View>
          ) : (
            completed.map((b: any) => (
              <View key={b.id} style={styles.row} testID={`earning-${b.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
                    {b?.job?.title || "Delivery"}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>
                    {formatDate(b?.completed_at || b?.created_at)}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.success }}>
                  +£{Number(b?.driver_charge ?? b?.balance_due ?? 0).toFixed(0)}
                </Text>
              </View>
            ))
          )}

          {cancellations.length > 0 ? (
            <>
              <Text style={[typography.h2, { marginTop: 8 }]}>Cancellation history</Text>
              {cancellations.slice(0, 10).map((c) => (
                <View key={`${c.booking_id}-${c.at}`} style={styles.row} testID={`cancel-${c.booking_id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
                      {c.reason_code?.replace(/_/g, " ") || "Cancellation"}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.inkMuted, marginTop: 2 }} numberOfLines={2}>
                      {c.note || formatDate(c.at)}
                    </Text>
                  </View>
                  {c.fee_deducted ? (
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.error }}>
                      -£{Number(c.fee_deducted).toFixed(0)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>
    </Page>
  );
}

function formatDate(iso: string | undefined) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

const styles = {
  hero: {
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    gap: 6,
  },
  heroValue: { color: "#FFFFFF", fontSize: 40, fontWeight: "800" as const, letterSpacing: -0.5 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: radius.base,
    gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: "800" as const, color: colors.ink, marginTop: 4 },
  infoBox: {
    flexDirection: "row" as const,
    gap: 8,
    padding: 12,
    borderRadius: radius.base,
    backgroundColor: "#DBEAFE",
  },
  emptyBox: {
    padding: 16,
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
};
