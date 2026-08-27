/**
 * BookingDetailScreen — full parity with the web
 * frontend/src/pages/portal/customer/BookingDetail.jsx.
 *
 * The previous native version showed either the ActiveJobMap OR a
 * summary card — never both. The web renders the full page top-to-
 * bottom: status pill + cancellation banner + Overview/Chat/POD tabs
 * + Recent activity + tracking map + Pickup/Dropoff card + Before-
 * you-accept vehicle + Booking details chips + Job photos + Driver
 * card + Pricing breakdown + payment CTA. This screen mirrors that
 * order verbatim while keeping the existing working ActiveJobMap.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  MapPin,
  Phone,
  Sparkles,
  UserCheck,
  Receipt,
  Info,
  Truck,
  Wrench,
  HandHelping,
  Scale,
  Package as PackageIcon,
  Ruler,
  Star,
} from "lucide-react-native";
import {
  Booking,
  CustomerAPI,
  SharedAPI,
  TrackingResponse,
  bookingPhase,
  contactVisible,
  money,
} from "@cargoone/core";
import { Page, PageHeader, PrimaryButton, SecondaryButton, StatusPill, SegmentedTabs } from "../ui";
import { colors, radius, typography } from "../theme";
import { ActiveJobMap } from "../ActiveJobMap";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

type Tab = "overview" | "chat" | "pod";

const CANCELLATION_STATUSES = new Set(["accepted", "deposit_paid", "confirmed", "travelling", "arrived", "collected", "on_route"]);

export function BookingDetailScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [b, setB] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    const bk = await CustomerAPI.bookingDetail(bookingId);
    setB(bk);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!b || b.payment_status !== "paid") return;
    const iv = setInterval(async () => {
      try {
        setTracking(await SharedAPI.tracking(b.id));
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(iv);
  }, [b]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Bookings"));

  if (!b) {
    return (
      <Page testID="booking-detail-loading">
        <PageHeader title="Booking" onBack={goBack} />
        <Text style={{ padding: 16, color: colors.inkMuted }}>Loading booking…</Text>
      </Page>
    );
  }

  const job = b.job;
  const phase = bookingPhase(b.status);
  const paid = b.payment_status === "paid";
  const cancellationApplies = CANCELLATION_STATUSES.has(b.status);
  const showActiveMap = !!phase && paid;

  const driverCharge = Number(b.driver_charge ?? job?.accepted_price ?? job?.fixed_price ?? 0);
  const bookingFee = Number(b.booking_fee ?? b.deposit_amount ?? 0);
  const feePct = b.booking_fee_percent ?? null;
  const total = Number(b.total_price ?? b.customer_total ?? driverCharge + bookingFee);
  const showPayNow = b.payment_status === "pending";

  const requirements: { Icon: any; label: string }[] = [];
  if (job?.needs_forklift) requirements.push({ Icon: Wrench, label: "Forklift / loading equipment required" });
  if (job?.needs_loading_help) requirements.push({ Icon: HandHelping, label: "Loading assistance (tail lift / extra hands)" });

  const chips: { Icon: any; label: string }[] = [];
  if (job?.weight_kg) chips.push({ Icon: Scale, label: `${job.weight_kg} kg` });
  if (job?.item_count) chips.push({ Icon: PackageIcon, label: `${job.item_count} items` });
  if (job?.dimensions_l_m || job?.dimensions_w_m || job?.dimensions_h_m || job?.dimensions) {
    const d = job.dimensions || `${job.dimensions_l_m}m × ${job.dimensions_w_m}m × ${job.dimensions_h_m}m`;
    chips.push({ Icon: Ruler, label: `${d} L·W·H` });
  }
  const vehicleName = job?.requested_vehicle_name || job?.vehicle_required || job?.recommended_vehicle;
  if (vehicleName) {
    chips.push({ Icon: Truck, label: vehicleName });
  }

  const driver = b.other_party;
  const driverName = driver?.name || b.assigned_driver_name || job?.assigned_driver_name || "Driver";
  const driverRating = driver?.rating ?? b.assigned_driver_rating ?? job?.assigned_driver_rating ?? null;
  const driverJobs = driver?.total_jobs ?? 0;
  const driverPhone = driver?.phone;

  return (
    <Page testID="booking-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <PageHeader
          title="Booking"
          onBack={goBack}
          right={<StatusPill status={b.status} />}
        />
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {/* Cancellation banner */}
          {cancellationApplies && (
            <View style={styles.warnBanner} testID="cancellation-banner">
              <Text style={{ fontSize: 14 }}>
                <Text style={{ fontWeight: "700", color: "#78350F" }}>Driver accepted — cancellation fee now applies. </Text>
                <Text style={{ color: "#78350F" }}>
                  If you cancel, the fee will be deducted from your deposit only. The remaining booking balance will NOT be
                  charged.
                </Text>
              </Text>
            </View>
          )}

          {/* Tabs */}
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview" as const, label: "Overview" },
              { value: "chat" as const, label: "Chat" },
              { value: "pod" as const, label: "POD" },
            ]}
            testIDPrefix="booking-tab"
          />

          {tab === "chat" ? (
            <View style={styles.placeholder} testID="tab-chat">
              <Text style={typography.cardTitle}>Chat</Text>
              <Text style={[typography.caption, { marginTop: 4 }]}>Message the driver from Messages when the trip is active.</Text>
              <View style={{ marginTop: 12 }}>
                <SecondaryButton title="Open Messages" onPress={() => navigation.navigate("Messages")} testID="tab-chat-open" />
              </View>
            </View>
          ) : tab === "pod" ? (
            <View style={styles.placeholder} testID="tab-pod">
              <Text style={typography.cardTitle}>Proof of Delivery</Text>
              <Text style={[typography.caption, { marginTop: 4 }]}>
                POD photos and signature appear here after the driver marks the job delivered.
              </Text>
            </View>
          ) : (
            <>
              {/* Job title */}
              <Text style={[typography.pageTitle, { marginTop: 4 }]} testID="booking-title">
                {job?.title || "Booking"}
              </Text>

              {/* Recent activity */}
              <View style={styles.card} testID="recent-activity-card">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={styles.activityIcon}><Sparkles size={14} color={colors.success} /></View>
                  <Text style={typography.cardTitle}>Recent activity</Text>
                </View>
                <View style={{ marginTop: 12, gap: 8 }}>
                  <ActivityRow Icon={Sparkles} label="Booking created" ts={b.created_at} />
                  {b.accepted_at ? <ActivityRow Icon={UserCheck} label="Driver accepted your booking" ts={b.accepted_at} /> : null}
                  {b.paid_at ? (
                    <ActivityRow Icon={Receipt} label="Deposit received" ts={b.paid_at} />
                  ) : null}
                </View>
              </View>

              {/* Live tracking map */}
              {showActiveMap ? (
                <ActiveJobMap
                  status={b.status}
                  pickup={job?.pickup_lat != null ? { lat: job.pickup_lat!, lng: job.pickup_lng!, town: job.pickup_town, address: job.pickup_address } : null}
                  dropoff={job?.dropoff_lat != null ? { lat: job.dropoff_lat!, lng: job.dropoff_lng!, town: job.dropoff_town, address: job.dropoff_address } : null}
                  driver={tracking?.last_location ? { lat: tracking.last_location.lat, lng: tracking.last_location.lng } : null}
                  etaMinutes={tracking?.eta_minutes ?? job?.duration_minutes ?? null}
                  distanceMiles={tracking?.remaining_miles ?? job?.distance_miles ?? null}
                  role="customer"
                />
              ) : null}

              {/* Pickup / Dropoff */}
              <View style={styles.routeCard} testID="route-card">
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.micro}>PICKUP</Text>
                    <Text style={typography.strong}>{job?.pickup_town || job?.pickup_address || "—"}</Text>
                  </View>
                </View>
                <View style={{ height: 12 }} />
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={[styles.dot, { backgroundColor: colors.brand }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.micro}>DROPOFF</Text>
                    <Text style={typography.strong}>{job?.dropoff_town || job?.dropoff_address || "—"}</Text>
                  </View>
                </View>
              </View>

              {/* Before you accept */}
              {vehicleName ? (
                <View style={styles.card} testID="before-you-accept-card">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Info size={16} color={colors.inkMuted} />
                    <Text style={typography.micro}>BEFORE YOU ACCEPT</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
                    <View style={styles.vehIconBadge}><Truck size={20} color={colors.brand} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.micro}>SUITABLE VEHICLE</Text>
                      <Text style={typography.strong}>{vehicleName}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Booking details chips */}
              {(requirements.length > 0 || chips.length > 0) && (
                <View style={styles.card} testID="booking-details-card">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Info size={16} color={colors.inkMuted} />
                    <Text style={typography.cardTitle}>Booking details</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {requirements.map(({ Icon, label }) => (
                      <View key={label} style={styles.chipWarn}>
                        <Icon size={14} color="#92400E" />
                        <Text style={styles.chipWarnText}>{label}</Text>
                      </View>
                    ))}
                    {chips.map(({ Icon, label }) => (
                      <View key={label} style={styles.chip}>
                        <Icon size={14} color={colors.ink} />
                        <Text style={styles.chipText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Job photos */}
              {job?.photos && job.photos.length > 0 ? (
                <View style={styles.card} testID="job-photos-card">
                  <Text style={typography.micro}>JOB PHOTOS</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {job.photos.map((p: string, i: number) => (
                      <Image key={i} source={{ uri: p }} style={styles.photo} />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Driver card */}
              {contactVisible(b) && driver ? (
                <View style={styles.card} testID="driver-card">
                  <Text style={typography.micro}>YOUR DRIVER</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <View style={styles.driverAvatar}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                        {driverName.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.cardTitle}>{driverName}</Text>
                      {driverRating != null ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Star size={12} color={colors.accent} fill={colors.accent} />
                          <Text style={typography.small}>
                            {Number(driverRating).toFixed(1)} · {driverJobs} jobs
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {driverPhone ? (
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${driverPhone}`)}
                        testID="driver-call"
                        hitSlop={8}
                        style={styles.callBtn}
                      >
                        <Phone size={20} color="#FFFFFF" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Pricing */}
              <View style={styles.card} testID="pricing-card">
                <Text style={typography.micro}>PAYMENT</Text>
                <View style={{ marginTop: 8 }}>
                  <PriceRow label="Driver Charge" value={money(driverCharge)} />
                  <PriceRow
                    label={`Cargo One Booking Fee${feePct != null ? ` (${Number(feePct).toFixed(0)}%)` : ""}`}
                    value={money(bookingFee)}
                  />
                  <View style={styles.divider} />
                  <PriceRow label="Total Booking Price" value={money(total)} strong />
                  <View style={styles.divider} />
                  <PriceRow label="Pay Driver On Delivery" value={money(driverCharge)} muted />
                  <PriceRow
                    label={showPayNow ? "Pay Now (Booking Fee)" : "Booking fee paid"}
                    value={money(bookingFee)}
                    strong
                  />
                </View>
              </View>

              {/* Actions */}
              <View style={{ gap: 8 }}>
                {showPayNow && (
                  <PrimaryButton
                    title={`Pay ${money(bookingFee)} booking fee`}
                    onPress={() => navigation.navigate("Payment", { bookingId: b.id })}
                    testID="continue-payment"
                  />
                )}
                {b.status === "delivered" && (
                  <PrimaryButton
                    title="Leave a review"
                    onPress={() => navigation.navigate("Review", { bookingId: b.id, driverId: b.driver_id || undefined })}
                    testID="leave-review"
                  />
                )}
                {["confirmed", "deposit_paid", "posted"].includes(b.status) && (
                  <SecondaryButton
                    title="Cancel booking"
                    onPress={() => {
                      Alert.alert("Cancel booking?", "Cancellation fees may apply.", [
                        { text: "Keep booking", style: "cancel" },
                        {
                          text: "Cancel",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await CustomerAPI.cancelBooking(b.id);
                              load();
                            } catch (e: any) {
                              Alert.alert("Error", e?.message || "Could not cancel");
                            }
                          },
                        },
                      ]);
                    }}
                    testID="cancel-booking"
                  />
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

function ActivityRow({ Icon, label, ts }: { Icon: any; label: string; ts?: string | null }) {
  const timeStr = ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={styles.activityIcon}><Icon size={14} color={colors.success} /></View>
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      <Text style={typography.small}>{timeStr}</Text>
    </View>
  );
}

function PriceRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
      <Text style={{ fontSize: 14, color: muted ? colors.inkMuted : colors.ink, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: strong ? 17 : 14, fontWeight: strong ? "700" : "500", color: muted ? colors.inkMuted : colors.ink }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  warnBanner: {
    padding: 14,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  placeholder: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  card: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  routeCard: {
    padding: 16,
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  activityIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center",
  },
  vehIconBadge: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bgSecondary,
  },
  chipText: { fontSize: 13, fontWeight: "500", color: colors.ink },
  chipWarn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#F59E0B",
  },
  chipWarnText: { fontSize: 13, fontWeight: "500", color: "#92400E" },
  photo: { width: 120, height: 120, borderRadius: radius.base, backgroundColor: colors.bgSecondary },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.success, alignItems: "center", justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 6 },
});
