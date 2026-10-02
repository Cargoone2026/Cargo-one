/**
 * MyJobsScreen — Driver mobile port of frontend/src/pages/portal/driver/MyJobs.jsx.
 *
 * Three sources merged into a unified list (web parity):
 *   • /bookings/mine        → post-deposit real bookings
 *   • /driver/accepted-jobs → pre-deposit accepted jobs (no booking yet)
 *   • /driver/my-bids       → every bid the driver has placed
 *
 * Visual language mirrors Customer Bookings.tsx: segmented tabs
 * (Active / Past), search input, polished BookingRow cards, EmptyState,
 * pull-to-refresh. No invented endpoints — all three API wrappers
 * already exist in DriverAPI.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DriverAPI, type Booking, type Job } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import {
  BookingRow, EmptyState, Icon, Input, Page, PageHeader,
  SegmentedTabs, Section, colors, space, typography,
} from "../ui";

const PAST = new Set(["completed", "cancelled", "refunded", "delivered", "pod_uploaded"]);
function isTerminal(x: any): boolean {
  return PAST.has(x?.status) || !!x?.cancelled_at;
}

type Card = {
  kind: "booking" | "accepted_job" | "bid";
  rowId: string;
  id: string;
  jobId?: string;
  title: string;
  pickup_town?: string;
  dropoff_town?: string;
  status: string;
  earning: number;
  priceLabel: string;
  terminal: boolean;
  bid_status?: "pending" | "accepted" | "rejected" | string;
  is_winning?: boolean;
  awaiting_deposit?: boolean;
  ts: string;
};

export default function MyJobsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [accepted, setAccepted] = useState<Job[]>([]);
  const [bids, setBids] = useState<any[]>([]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [b, a, bd] = await Promise.all([
        DriverAPI.myBookings().catch(() => [] as Booking[]),
        DriverAPI.acceptedJobs().catch(() => [] as Job[]),
        DriverAPI.myBids().catch(() => [] as any[]),
      ]);
      setBookings(Array.isArray(b) ? b : []);
      setAccepted(Array.isArray(a) ? a : []);
      setBids(Array.isArray(bd) ? bd : []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards: Card[] = useMemo(() => {
    const bookingCards: Card[] = bookings.map((b: any) => ({
      kind: "booking",
      rowId: `booking-${b.id}`,
      id: b.id,
      jobId: b.job_id,
      title: b?.job?.title || "Job",
      pickup_town: b?.job?.pickup_town,
      dropoff_town: b?.job?.dropoff_town,
      status: b.status,
      earning: Number(b.driver_charge ?? b.total_price ?? 0),
      priceLabel: "Earning",
      terminal: isTerminal(b),
      ts: b.updated_at || b.created_at || "",
    }));
    const acceptedCards: Card[] = accepted.map((j: any) => ({
      kind: "accepted_job",
      rowId: `accepted-${j.id}`,
      id: j.id,
      jobId: j.id,
      title: j.title || "Job",
      pickup_town: j.pickup_town,
      dropoff_town: j.dropoff_town,
      status: "accepted",
      earning: Number(j.accepted_price ?? j.fixed_price ?? 0),
      priceLabel: "Earning",
      terminal: false,
      awaiting_deposit: true,
      ts: j.updated_at || j.created_at || "",
    }));
    const bidCards: Card[] = bids.map((bd: any) => ({
      kind: "bid",
      rowId: `bid-${bd.id}`,
      id: bd.id,
      jobId: bd.job_id,
      title: bd.job?.title || "Job",
      pickup_town: bd.job?.pickup_town,
      dropoff_town: bd.job?.dropoff_town,
      status: bd.job?.status || "posted",
      earning: Number(bd.amount || 0),
      priceLabel: "Your bid",
      terminal: isTerminal(bd.job),
      bid_status: bd.status,
      is_winning: bd.is_winning,
      ts: bd.created_at || "",
    }));

    const bookingJobIds = new Set(bookings.map((b: any) => b?.job_id).filter(Boolean));
    const acceptedJobIds = new Set(acceptedCards.map((c) => c.id));
    const merged = [
      ...bookingCards,
      ...acceptedCards.filter((c) => !bookingJobIds.has(c.id)),
      ...bidCards.filter(
        (c) => !bookingJobIds.has(c.jobId!) && !acceptedJobIds.has(c.jobId!),
      ),
    ];
    merged.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    return merged;
  }, [bookings, accepted, bids]);

  const filtered = useMemo(() => {
    const base = tab === "active" ? cards.filter((c) => !c.terminal) : cards.filter((c) => c.terminal);
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((c) =>
      c.title.toLowerCase().includes(needle) ||
      (c.pickup_town || "").toLowerCase().includes(needle) ||
      (c.dropoff_town || "").toLowerCase().includes(needle),
    );
  }, [tab, cards, q]);

  const activeCount = cards.filter((c) => !c.terminal).length;
  const pastCount = cards.filter((c) => c.terminal).length;

  const openCard = (c: Card) => {
    if (c.kind === "booking") nav.navigate("BookingDetail", { bookingId: c.id });
    else if (c.jobId) nav.navigate("JobDetail", { jobId: c.jobId });
  };

  return (
    <Page
      testID="driver-my-jobs"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
    >
      <PageHeader
        title="My Jobs"
        large
        right={<Text style={typography.caption}>{cards.length} total</Text>}
      />
      <Section gap={space[3]}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: `Active (${activeCount})` },
            { value: "past", label: `Past (${pastCount})` },
          ]}
          testIDPrefix="my-jobs-tab"
        />

        <View style={{ position: "relative", justifyContent: "center" }}>
          <View style={{ position: "absolute", left: 12, zIndex: 1 }}>
            <Icon name="search" size={16} color={colors.inkMuted} />
          </View>
          <Input
            value={q}
            onChangeText={setQ}
            placeholder="Search jobs, pickup, delivery…"
            testID="my-jobs-search"
            style={{ paddingLeft: 38 }}
          />
        </View>

        {loading && filtered.length === 0 ? (
          <Text style={[typography.caption, { paddingVertical: space[6], textAlign: "center" }]}>
            Loading jobs…
          </Text>
        ) : filtered.length === 0 ? (
          <EmptyState
            glyph="package"
            title={tab === "active" ? "No active jobs" : "No past jobs"}
            body={
              tab === "active"
                ? "Accept or bid on nearby jobs to see them here."
                : "Completed and cancelled jobs will appear here."
            }
            testID="my-jobs-empty"
          />
        ) : (
          <View style={{ gap: space[3] }}>
            {filtered.map((c) => (
              <BookingRow
                key={c.rowId}
                title={c.title}
                status={c.status}
                pickup={c.pickup_town}
                dropoff={c.dropoff_town}
                price={c.earning}
                priceLabel={c.priceLabel}
                testID={
                  c.awaiting_deposit
                    ? `driver-myjob-awaiting-${c.id}`
                    : c.kind === "bid"
                    ? `driver-myjob-bid-${c.id}`
                    : `driver-myjob-${c.id}`
                }
                onPress={() => openCard(c)}
                badge={
                  c.awaiting_deposit ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Icon name="clock" size={13} color={colors.warningInk} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.warningInk }}>
                        Waiting for customer deposit
                      </Text>
                    </View>
                  ) : c.kind === "bid" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <BidPill status={c.bid_status} />
                      {c.status === "accepted" && !c.is_winning ? (
                        <Text style={{ fontSize: 11, color: colors.inkMuted }}>
                          Job assigned to another driver
                        </Text>
                      ) : null}
                    </View>
                  ) : null
                }
              />
            ))}
          </View>
        )}
      </Section>
    </Page>
  );
}

function BidPill({ status }: { status?: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    accepted: { bg: "#DCFCE7", fg: "#166534", label: "Bid accepted" },
    rejected: { bg: "#F4F4F4", fg: "#6B7280", label: "Bid not chosen" },
  };
  const s = status && map[status] ? map[status] : { bg: colors.warningBg, fg: colors.warningInk, label: "Bid pending" };
  return (
    <View style={{
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
      backgroundColor: s.bg,
    }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: s.fg }}>{s.label}</Text>
    </View>
  );
}
