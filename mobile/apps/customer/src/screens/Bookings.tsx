/**
 * BookingsScreen — 1:1 port of frontend/src/pages/portal/customer/Bookings.jsx.
 * Segmented tabs (Active / Past), search input, and BookingRow list.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Package, RotateCcw, Trash2 } from "lucide-react-native";
import { CustomerAPI, Booking, Job } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { BookingRow, EmptyState, Page, PageHeader, SearchInputRow, SegmentedTabs } from "../ui";
import { useShellMenu } from "../components/AppShell";

const PAST = new Set(["completed", "cancelled", "refunded"]);

// R71.14 — a normal (non-ASAP) booking is "unaccepted" when no driver has
// claimed it yet. That's the exact state where the customer-facing action
// is a fee-free "Delete booking" (matches web business logic). Anything
// with an assigned driver falls into the "Cancel & request refund" path.
function isUnacceptedNormalBooking(b: Booking): boolean {
  const timing = (b as any).service_timing || (b as any).job?.service_timing;
  if (timing === "asap") return false;
  if (b.status === "completed" || b.status === "cancelled" || (b as any).cancelled_at) return false;
  const drv = (b as any).assigned_driver_id || (b as any).job?.assigned_driver_id;
  return !drv;
}

// R71.14 — cancelled NORMAL bookings surface a per-row "Rebook this job"
// button. ASAP rebook is handled by the existing dispatch flow and is
// intentionally not duplicated here.
function isCancelledNormalBooking(b: Booking): boolean {
  const timing = (b as any).service_timing || (b as any).job?.service_timing;
  if (timing === "asap") return false;
  return b.status === "cancelled" || !!(b as any).cancelled_at;
}

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

  // R71.14 — per-row "Delete booking" for unaccepted NORMAL bookings.
  // Backend `/customer/bookings/{id}/cancel` handles unpaid deletes without
  // fee and paid-unaccepted with a full refund; fee logic is server-side.
  const onDelete = useCallback(
    (b: Booking) => {
      Alert.alert(
        "Delete booking?",
        "This will remove it from your active list. If you paid a deposit, it will be fully refunded (no driver has accepted yet).",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await CustomerAPI.cancelBooking(b.id);
                await load();
              } catch (e: any) {
                Alert.alert("Could not delete", e?.message || "Please try again in a moment.");
              }
            },
          },
        ],
      );
    },
    [load],
  );

  // R71.14 — per-row "Rebook this job" for cancelled NORMAL bookings.
  // Mirrors the web goRebook: navigates to the correct wizard and pre-fills
  // via a route param. Never mutates the source (cancelled) booking.
  const onRebook = useCallback(
    (b: Booking) => {
      const timing = (b as any).service_timing || (b as any).job?.service_timing;
      const rebookFromJob = (b as any).job || {};
      if (timing === "asap") {
        nav.navigate("Asap", { rebookFromJob });
      } else {
        nav.navigate("PostJob", { rebookFromJob });
      }
    },
    [nav],
  );

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
    <Page testID="customer-bookings" scroll={false}>
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
              const showDelete = !it._isJob && isUnacceptedNormalBooking(it as Booking);
              const showRebook = !it._isJob && isCancelledNormalBooking(it as Booking);
              return (
                <View key={it.id}>
                  <BookingRow
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
                  {showDelete ? (
                    <Pressable
                      onPress={() => onDelete(it as Booking)}
                      style={styles.rowActionDanger}
                      testID={`booking-row-delete-${it.id}`}
                    >
                      <Trash2 size={14} color={colors.errorInk} />
                      <Text style={styles.rowActionDangerText}>Delete booking</Text>
                    </Pressable>
                  ) : null}
                  {showRebook ? (
                    <Pressable
                      onPress={() => onRebook(it as Booking)}
                      style={styles.rowActionPrimary}
                      testID={`booking-row-rebook-${it.id}`}
                    >
                      <RotateCcw size={14} color="#FFFFFF" />
                      <Text style={styles.rowActionPrimaryText}>Rebook this job</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  rowActionDanger: {
    marginTop: -6,
    marginBottom: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  rowActionDangerText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: colors.errorInk,
  },
  rowActionPrimary: {
    marginTop: -6,
    marginBottom: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  rowActionPrimaryText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
};
