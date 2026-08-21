/**
 * MyJobsScreen — driver's own bookings + accepted-but-not-yet-paid jobs.
 * Ports the merge logic from frontend/src/pages/portal/driver/MyJobs.jsx
 * verbatim: /driver/bookings + /driver/accepted-jobs + /driver/my-bids
 * normalised into a single card list, newest first.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Package } from "lucide-react-native";
import { DriverAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { BookingRow, EmptyState, Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";
import { colors } from "../theme";

interface Card {
  kind: "booking" | "accepted_job" | "bid";
  id: string;
  title: string;
  pickup?: string;
  dropoff?: string;
  status: string;
  earning: number;
  ts: string;
  target: { screen: keyof RootStackParamList; params: any };
  cancelled?: boolean;
  priceLabel: string;
}

export function MyJobsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();
  const [cards, setCards] = useState<Card[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [bookings, accepted, bids] = await Promise.all([
        DriverAPI.myBookings().catch(() => []),
        DriverAPI.acceptedJobs().catch(() => []),
        DriverAPI.myBids().catch(() => []),
      ]);
      const bookingCards: Card[] = (Array.isArray(bookings) ? bookings : []).map((b: any) => ({
        kind: "booking",
        id: b.id,
        title: b?.job?.title || "Job",
        pickup: b?.job?.pickup_town,
        dropoff: b?.job?.dropoff_town,
        status: b.status,
        earning: Number(b.driver_charge ?? b.total_price ?? 0),
        ts: b.updated_at || b.created_at || "",
        target: { screen: "ActiveBooking" as const, params: { bookingId: b.id } },
        cancelled: b.status === "cancelled",
        priceLabel: "Earnings",
      }));
      const acceptedCards: Card[] = (Array.isArray(accepted) ? accepted : []).map((j: any) => ({
        kind: "accepted_job",
        id: j.id,
        title: j.title || "Job",
        pickup: j.pickup_town,
        dropoff: j.dropoff_town,
        status: "accepted",
        earning: Number(j.accepted_price ?? j.fixed_price ?? 0),
        ts: j.updated_at || j.created_at || "",
        target: { screen: "JobDetail" as const, params: { jobId: j.id } },
        priceLabel: "Waiting for deposit",
      }));
      const bidCards: Card[] = (Array.isArray(bids) ? bids : []).map((bd: any) => ({
        kind: "bid",
        id: bd.id,
        title: bd?.job?.title || "Bid submitted",
        pickup: bd?.job?.pickup_town,
        dropoff: bd?.job?.dropoff_town,
        status: bd.status === "accepted" ? "accepted" : "posted",
        earning: Number(bd.amount ?? 0),
        ts: bd.updated_at || bd.created_at || "",
        target: { screen: "JobDetail" as const, params: { jobId: bd.job_id } },
        priceLabel: "Your bid",
      }));
      const all = [...bookingCards, ...acceptedCards, ...bidCards].sort((a, b) =>
        String(b.ts).localeCompare(String(a.ts)),
      );
      setCards(all);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page testID="driver-my-jobs">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}>
        <PageHeader large title="My Jobs" subtitle="Bookings, accepted jobs and open bids." showMenu={showMenu} onMenuPress={openDrawer} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {cards.length === 0 ? (
            <EmptyState Icon={Package} title="No jobs yet" body="Accepted bookings, jobs and bids will show up here." />
          ) : (
            cards.map((c) => (
              <BookingRow
                key={`${c.kind}-${c.id}`}
                title={c.title}
                status={c.status}
                pickup={c.pickup}
                dropoff={c.dropoff}
                price={c.earning || null}
                priceLabel={c.priceLabel}
                cancelled={c.cancelled}
                onPress={() => (nav as any).navigate(c.target.screen, c.target.params)}
                testID={`my-jobs-card-${c.id}`}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}
