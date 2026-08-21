/**
 * BookingsScreen — 1:1 port of frontend/src/pages/portal/customer/Bookings.jsx.
 * Segmented tabs (Active / Past), search input, and BookingRow list.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Package } from "lucide-react-native";
import { CustomerAPI, Booking, Job } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors } from "../theme";
import { BookingRow, EmptyState, Page, PageHeader, SearchInputRow, SegmentedTabs } from "../ui";
import { useShellMenu } from "../components/AppShell";

const PAST = new Set(["completed", "cancelled", "refunded"]);

type Row =
  | (Booking & { _isBooking: true; _isJob?: undefined })
  | (Job & { _isJob: true; _isBooking?: undefined });

export function BookingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [items, setItems] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [b, j] = await Promise.all([
        CustomerAPI.myBookings().catch(() => [] as Booking[]),
        CustomerAPI.myJobs().catch(() => [] as Job[]),
      ]);
      setItems(Array.isArray(b) ? b : []);
      setJobs(Array.isArray(j) ? j : []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => items.filter((b) => !PAST.has(b.status)), [items]);
  const past = useMemo(() => items.filter((b) => PAST.has(b.status)), [items]);
  const bookedJobIds = useMemo(() => new Set(items.map((b) => b.job_id).filter(Boolean)), [items]);
  const openJobs = useMemo(
    () =>
      jobs
        .filter((j) => ["posted", "accepted"].includes(j.status))
        .filter((j) => !bookedJobIds.has(j.id))
        .map((j) => ({ ...j, _isJob: true as const })),
    [jobs, bookedJobIds],
  );

  const display: Row[] = useMemo(() => {
    const raw: Row[] =
      tab === "active"
        ? [...active.map((b) => ({ ...b, _isBooking: true as const })), ...openJobs]
        : past.map((b) => ({ ...b, _isBooking: true as const }));
    const sorted = [...raw].sort((a: any, b: any) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")),
    );
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((it: any) => {
      const title = (it._isJob ? it.title : it.job?.title) || "";
      const pu = (it._isJob ? it.pickup_town : it.job?.pickup_town) || "";
      const drop = (it._isJob ? it.dropoff_town : it.job?.dropoff_town) || "";
      return (
        title.toLowerCase().includes(needle) ||
        pu.toLowerCase().includes(needle) ||
        drop.toLowerCase().includes(needle)
      );
    });
  }, [tab, active, past, openJobs, q]);

  return (
    <Page testID="customer-bookings">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <PageHeader
          large
          title="Bookings"
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 32 }}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "active" as const, label: `Active (${active.length + openJobs.length})` },
              { value: "past" as const, label: `Past (${past.length})` },
            ]}
            testIDPrefix="bookings-tab"
          />
          <SearchInputRow
            value={q}
            onChangeText={setQ}
            onClear={() => setQ("")}
            placeholder="Search bookings, pickup, delivery..."
            testID="bookings-search"
          />
          {display.length === 0 ? (
            <EmptyState
              Icon={Package}
              title={tab === "active" ? "No active bookings" : "No past bookings"}
              body={tab === "active" ? "Post your first job to get started." : "Completed shipments will appear here."}
              testID="bookings-empty"
            />
          ) : (
            display.map((it: any) => {
              const title = it._isJob ? it.title : it.job?.title || "Shipment";
              const pickup = it._isJob ? it.pickup_town : it.job?.pickup_town;
              const dropoff = it._isJob ? it.dropoff_town : it.job?.dropoff_town;
              const status = it.status;
              const cancelled = !it._isJob && (status === "cancelled" || !!it.cancelled_at);
              const priceLabel = it._isJob
                ? "Estimated"
                : cancelled
                ? "Refunded"
                : "Total";
              const price = it._isJob
                ? it.suggested_price ?? it.accepted_price ?? it.customer_total
                : cancelled
                ? it.cancellation_refund ?? it.refund_amount
                : it.customer_total ?? it.total_price ?? it.job?.customer_total ?? it.job?.accepted_price;
              return (
                <BookingRow
                  key={it.id}
                  title={title}
                  status={status}
                  pickup={pickup}
                  dropoff={dropoff}
                  price={price}
                  priceLabel={priceLabel}
                  cancelled={cancelled}
                  onPress={() =>
                    it._isJob
                      ? nav.navigate("JobDetail", { jobId: it.id })
                      : nav.navigate("BookingDetail", { bookingId: it.id })
                  }
                  testID={`booking-row-${it.id}`}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </Page>
  );
}
