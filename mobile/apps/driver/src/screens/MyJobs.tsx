/**
 * MyJobsScreen — driver's merged jobs list.
 *
 * Ports frontend/src/pages/portal/driver/MyJobs.jsx (R71.16.7 / P1-d) with
 * byte-for-byte parity of its merge + dedupe + classification logic:
 *
 *   1) GET /bookings/mine        — post-deposit real bookings
 *   2) GET /driver/accepted-jobs — pre-deposit accepted jobs (no booking yet)
 *   3) GET /driver/my-bids       — every bid the driver has submitted
 *
 * Dedupe precedence: booking > accepted job > bid, keyed by underlying
 * job id. Once a job becomes a paid booking the accepted / bid rows for
 * the same job disappear.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronRight, Clock, MapPin, Package } from "lucide-react-native";
import { DriverAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { EmptyState, Page, PageHeader, StatusPill } from "../ui";
import { useShellMenu } from "../components/AppShell";
import { colors, radius, typography } from "../theme";

type CardKind = "booking" | "accepted_job" | "bid";

interface Card {
  kind: CardKind;
  id: string;              // booking.id | job.id (accepted) | bid.id
  job_id?: string;         // populated for bids for dedupe/navigation
  title: string;
  pickup_town?: string;
  dropoff_town?: string;
  status: string;
  earning: number;
  awaiting_deposit: boolean;
  bid_status: "pending" | "accepted" | "rejected" | string | null;
  is_winning?: boolean;
  ts: string;
  target: { screen: keyof RootStackParamList; params: Record<string, unknown> };
}

export function MyJobsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();
  const [items, setItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookings, accepted, bids] = await Promise.all([
        DriverAPI.myBookings().catch(() => [] as any[]),
        DriverAPI.acceptedJobs().catch(() => [] as any[]),
        DriverAPI.myBids().catch(() => [] as any[]),
      ]);

      const bookingsArr: any[] = Array.isArray(bookings) ? bookings : [];
      const acceptedArr: any[] = Array.isArray(accepted) ? accepted : [];
      const bidsArr: any[] = Array.isArray(bids) ? bids : [];

      const bookingCards: Card[] = bookingsArr.map((b: any) => ({
        kind: "booking",
        id: String(b?.id ?? ""),
        title: b?.job?.title || "Job",
        pickup_town: b?.job?.pickup_town,
        dropoff_town: b?.job?.dropoff_town,
        status: String(b?.status ?? "posted"),
        earning: Number(b?.driver_charge ?? b?.total_price ?? 0) || 0,
        awaiting_deposit: false,
        bid_status: null,
        ts: String(b?.updated_at || b?.created_at || ""),
        target: { screen: "ActiveBooking", params: { bookingId: b?.id } },
      }));

      const acceptedCards: Card[] = acceptedArr.map((j: any) => ({
        kind: "accepted_job",
        id: String(j?.id ?? ""),
        title: j?.title || "Job",
        pickup_town: j?.pickup_town,
        dropoff_town: j?.dropoff_town,
        status: "accepted",
        earning: Number(j?.accepted_price ?? j?.fixed_price ?? 0) || 0,
        awaiting_deposit: true,
        bid_status: null,
        ts: String(j?.updated_at || j?.created_at || ""),
        target: { screen: "JobDetail", params: { jobId: j?.id } },
      }));

      const bidCards: Card[] = bidsArr.map((bd: any) => ({
        kind: "bid",
        id: String(bd?.id ?? ""),
        job_id: String(bd?.job_id ?? ""),
        title: bd?.job?.title || "Job",
        pickup_town: bd?.job?.pickup_town,
        dropoff_town: bd?.job?.dropoff_town,
        status: String(bd?.job?.status || "posted"),
        earning: Number(bd?.amount || 0) || 0,
        awaiting_deposit: false,
        bid_status: (bd?.status as Card["bid_status"]) ?? "pending",
        is_winning: Boolean(bd?.is_winning),
        ts: String(bd?.created_at || ""),
        target: { screen: "JobDetail", params: { jobId: bd?.job_id } },
      }));

      // Dedupe (web MyJobs.jsx lines 76–89): booking > accepted > bid.
      const bookingJobIds = new Set<string>(
        bookingsArr
          .map((b: any) => String(b?.job_id || b?.job?.id || ""))
          .filter(Boolean),
      );
      const acceptedJobIds = new Set<string>(acceptedCards.map((c) => c.id).filter(Boolean));

      const merged: Card[] = [
        ...bookingCards,
        ...acceptedCards.filter((c) => !bookingJobIds.has(c.id)),
        ...bidCards.filter(
          (c) =>
            !!c.job_id &&
            !bookingJobIds.has(c.job_id) &&
            !acceptedJobIds.has(c.job_id),
        ),
      ];
      merged.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
      setItems(merged);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page testID="driver-my-jobs" scroll={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={loading && loadedOnce} onRefresh={load} tintColor={colors.brand} />
        }
      >
        <PageHeader
          large
          title="My Jobs"
          subtitle={`${items.length} total`}
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16 }}>
          {!loadedOnce && loading ? (
            <Text style={[typography.caption, { paddingVertical: 8 }]} testID="my-jobs-loading">
              Loading jobs…
            </Text>
          ) : items.length === 0 ? (
            <EmptyState
              Icon={Package}
              title="No jobs yet"
              body="Accept or bid on nearby jobs to see them here."
              testID="my-jobs-empty"
            />
          ) : (
            items.map((c) => (
              <MyJobCard
                key={`${c.kind}-${c.id}`}
                card={c}
                onPress={() => (nav as any).navigate(c.target.screen, c.target.params)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* MyJobCard — inline card matching the web layout for parity.        */
/* ------------------------------------------------------------------ */

function MyJobCard({ card, onPress }: { card: Card; onPress: () => void }) {
  const testID = card.awaiting_deposit
    ? `driver-myjob-awaiting-${card.id}`
    : `driver-myjob-${card.id}`;
  const priceLabel = card.kind === "bid" ? "Your bid" : "Your earning";
  const priceValue = `£${Number(card.earning || 0).toFixed(0)}`;
  const pickup = card.pickup_town || "—";
  const dropoff = card.dropoff_town || "—";

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        padding: 16,
        borderRadius: radius.base,
        borderWidth: 1,
        borderColor: pressed ? colors.ink : colors.border,
        backgroundColor: colors.bg,
        marginBottom: 12,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink }}
        >
          {card.title}
        </Text>
        <StatusPill status={card.status} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
        <MapPin size={14} color={colors.brand} />
        <Text style={{ fontSize: 14, color: colors.inkMuted, flex: 1 }} numberOfLines={1}>
          {pickup} → {dropoff}
        </Text>
      </View>

      {card.awaiting_deposit ? (
        <View
          style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 4 }}
          testID="waiting-deposit-label"
        >
          <Clock size={14} color="#B45309" />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#B45309" }}>
            Waiting for customer deposit
          </Text>
        </View>
      ) : null}

      {card.kind === "bid" ? (
        <View
          style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}
          testID={`driver-bid-status-${card.id}`}
        >
          <BidStatusPill status={card.bid_status} />
          {card.bid_status === "accepted" && !card.is_winning ? (
            <Text style={{ fontSize: 11, color: colors.inkMuted }}>
              Job assigned to another driver
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text style={typography.small}>{priceLabel}</Text>
          <Text style={typography.price}>{priceValue}</Text>
        </View>
        <ChevronRight size={20} color={colors.inkFaint} />
      </View>
    </Pressable>
  );
}

function BidStatusPill({ status }: { status: Card["bid_status"] }) {
  const cfg =
    status === "accepted"
      ? { bg: "#ECFDF5", fg: "#047857", label: "Bid accepted" }
      : status === "rejected"
      ? { bg: "#F5F5F5", fg: "#525252", label: "Bid not chosen" }
      : { bg: "#FFFBEB", fg: "#92400E", label: "Bid pending" };
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: cfg.bg,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: cfg.fg }}>{cfg.label}</Text>
    </View>
  );
}
