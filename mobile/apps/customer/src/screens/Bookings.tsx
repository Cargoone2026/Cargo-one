import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { CustomerAPI, mergeActive, Booking, Job, money } from "@cargoone/core";
import { Body, CARGO, Card, H1, Screen } from "../ui";

type Row = (Booking & { _isBooking: true }) | (Job & { _isJob: true });

/**
 * Customer bookings list — newest-first (R70 parity). Merges paid
 * bookings with unpaid posted jobs so a brand-new posted job always
 * sits at the top instead of being buried behind old paid bookings.
 */
export function BookingsScreen({ navigation }: any) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [bookings, jobs] = await Promise.all([CustomerAPI.myBookings(), CustomerAPI.myJobs().catch(() => [] as Job[])]);
      const isActive = (b: Booking) => !["completed", "cancelled", "refunded"].includes(b.status);
      const active = bookings.filter(isActive).map((b) => ({ ...b, _isBooking: true as const }));
      const past = bookings.filter((b) => !isActive(b)).map((b) => ({ ...b, _isBooking: true as const }));
      const posted = jobs.filter((j) => ["posted", "quote"].includes(j.status)).map((j) => ({ ...j, _isJob: true as const }));
      setRows(tab === "active" ? (mergeActive(active as any, posted as any) as Row[]) : (past as Row[]));
    } finally {
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <H1>Bookings</H1>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 12 }}>
        {(["active", "past"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            testID={`bookings-tab-${t}`}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: tab === t ? CARGO.ink : CARGO.offwhite,
            }}
          >
            <Text style={{ color: tab === t ? "#fff" : CARGO.ink, fontWeight: "700", fontSize: 13 }}>
              {t === "active" ? "Active" : "Past"}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => {
          const isBooking = (item as any)._isBooking;
          const job = isBooking ? (item as Booking).job : (item as Job);
          const status = isBooking ? (item as Booking).status : (item as Job).status;
          const total = isBooking ? (item as Booking).total_price : (item as Job).fixed_price;
          return (
            <Pressable
              testID={`bookings-row-${item.id}`}
              onPress={() =>
                isBooking
                  ? navigation.navigate("BookingDetail", { bookingId: item.id })
                  : navigation.navigate("Bids", { jobId: item.id })
              }
            >
              <Card style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase" }}>
                  {status.replace("_", " ")}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: CARGO.ink, marginTop: 4 }} numberOfLines={1}>
                  {job?.title || (isBooking ? "Booking" : "Job")}
                </Text>
                <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 2 }} numberOfLines={1}>
                  {job?.pickup_town || "—"} → {job?.dropoff_town || "—"}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: CARGO.ink, marginTop: 6 }}>{money(total)}</Text>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Body muted style={{ marginTop: 40, textAlign: "center" }}>
            No {tab === "active" ? "active" : "past"} bookings yet.
          </Body>
        }
      />
    </Screen>
  );
}
