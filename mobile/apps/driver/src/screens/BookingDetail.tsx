/**
 * BookingDetailScreen — Driver mobile port of
 * frontend/src/pages/portal/driver/BookingDetail.jsx, following the
 * visual language of Customer BookingDetail.tsx.
 *
 * Three tabs: Overview / Messages / POD. Status progression actions
 * (travelling → arrived → collected → on_route → delivered) and the
 * driver-side cancellation flow (reasons dropdown + explanation) use
 * the EXISTING DriverAPI endpoints:
 *   • GET  /bookings/{id}
 *   • POST /bookings/{id}/status            (progressStatus)
 *   • GET  /bookings/{id}/messages          (bookingMessages)
 *   • POST /bookings/{id}/messages          (postMessage)
 *   • POST /bookings/{id}/messages/mark-read
 *   • GET  /driver/cancel-reasons           (cancelReasons)
 *   • POST /driver/bookings/{id}/cancel     (cancelBooking)
 *   • GET  /bookings/{id}/pod               (fetchPOD, view-only)
 *
 * POD CAPTURE IS OMITTED — camera/signature capture requires
 * expo-image-picker + signature-canvas native deps that are
 * intentionally excluded from Driver autolinking. POD view-only works.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking,
  Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  DriverAPI, type Booking, type DriverCancelReason, type DriverMessage, type POD,
} from "@cargoone/core";
import * as Location from "expo-location";
import type { RootStackParamList } from "../App";
import {
  Card, Icon, Page, PageHeader, PrimaryButton, SecondaryButton,
  SegmentedTabs, StatusPill,
  colors, radius, space, typography,
} from "../ui";
import { RouteMap, MapFallback } from "../components/RouteMap";

type P = NativeStackScreenProps<RootStackParamList, "BookingDetail">;
type Tab = "overview" | "messages" | "pod";

// Progression lifecycle used by Driver web BookingDetail.
const PROGRESSION: Array<{ from: string; to: string; label: string; icon: React.ComponentProps<typeof Icon>["name"] }> = [
  { from: "deposit_paid",  to: "confirmed",   label: "Confirm booking",  icon: "check-circle" },
  { from: "confirmed",     to: "travelling",  label: "Start travelling", icon: "truck" },
  { from: "accepted",      to: "travelling",  label: "Start travelling", icon: "truck" },
  { from: "travelling",    to: "arrived",     label: "Mark arrived",     icon: "map-pin" },
  { from: "arrived",       to: "collected",   label: "Mark collected",   icon: "package" },
  { from: "collected",     to: "on_route",    label: "Start delivery",   icon: "navigation" },
  { from: "on_route",      to: "delivered",   label: "Mark delivered",   icon: "flag" },
];

const CANCELLABLE = new Set([
  "accepted", "deposit_paid", "confirmed", "travelling", "arrived", "collected", "on_route",
]);

// Driver-mobile port of R61 (Driver Web auto-tracking). For paid ASAP
// bookings in these active statuses, the driver app pushes its
// foreground location to /tracking/{booking_id} so the customer app's
// ActiveJobMap can plot the live driver pin. Throttled identically to
// the web implementation (>= 30 m moved OR >= 45 s elapsed).
const TRACKING_ACTIVE_STATUSES = new Set([
  "confirmed", "deposit_paid", "travelling", "arrived", "collected", "on_route",
]);
const TRACKING_MIN_DISTANCE_METERS = 30;
const TRACKING_MIN_INTERVAL_MS = 45_000;

export default function BookingDetailScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [b, setB] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [messages, setMessages] = useState<DriverMessage[]>([]);
  const [pod, setPod] = useState<POD | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [bk, msgs, p] = await Promise.all([
        DriverAPI.bookingDetail(bookingId).catch(() => null as Booking | null),
        DriverAPI.bookingMessages(bookingId).catch(() => [] as DriverMessage[]),
        DriverAPI.fetchPOD(bookingId).catch(() => null),
      ]);
      setB(bk);
      setMessages(Array.isArray(msgs) ? msgs : []);
      setPod(p);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Mark messages read whenever user switches to the Messages tab.
  useEffect(() => {
    if (tab !== "messages" || !b) return;
    DriverAPI.markMessagesRead(bookingId).catch(() => {});
  }, [tab, b, bookingId]);

  // ASAP live tracking (R61 web-parity, Driver mobile).
  // Starts a foreground location watch when the booking is paid, ASAP,
  // and in an active status, pushing throttled location updates to
  // /tracking/{booking_id} via DriverAPI.pushTracking. Stops on
  // unmount, terminal status, or permission denial. No background
  // tracking, no "Always" permission, no watchPositionAsync when the
  // app is backgrounded.
  const lastTrackPushRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  useEffect(() => {
    if (!b) return;
    if (b.payment_status !== "paid") return;
    const timing = b.service_timing || (b as any).job?.service_timing;
    if (timing !== "asap") return;
    if (!TRACKING_ACTIVE_STATUSES.has(b.status)) return;
    if (b.cancelled_at) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      let granted = perm.granted;
      if (!granted) {
        const req = await Location.requestForegroundPermissionsAsync();
        granted = req.granted;
      }
      if (!granted || cancelled) return;
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10_000,
            distanceInterval: 20,
          },
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const now = Date.now();
            const last = lastTrackPushRef.current;
            if (last) {
              const dLat = (lat - last.lat) * 111000;
              const dLng =
                (lng - last.lng) *
                111000 *
                Math.cos((lat * Math.PI) / 180);
              const dist = Math.sqrt(dLat * dLat + dLng * dLng);
              if (
                dist < TRACKING_MIN_DISTANCE_METERS &&
                now - last.t < TRACKING_MIN_INTERVAL_MS
              ) {
                return;
              }
            }
            try {
              await DriverAPI.pushTracking(bookingId, lat, lng);
              lastTrackPushRef.current = { lat, lng, t: now };
            } catch {
              /* silent — next fix will retry */
            }
          },
        );
      } catch {
        /* permission errors / unavailable — stop silently */
      }
    })();

    return () => {
      cancelled = true;
      if (subscription) {
        try { subscription.remove(); } catch { /* noop */ }
      }
    };
  }, [b?.id, b?.status, b?.payment_status, b?.service_timing, b?.cancelled_at, bookingId]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MyJobs"));

  if (loading && !b) {
    return (
      <Page testID="booking-detail-loading" scroll={false}>
        <PageHeader title="Booking" onBack={goBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Page>
    );
  }
  if (!b) {
    return (
      <Page testID="booking-detail-error" scroll={false}>
        <PageHeader title="Booking" onBack={goBack} />
        <View style={{ padding: space[4] }}>
          <Text style={typography.body}>Could not load this booking. Pull to refresh.</Text>
        </View>
      </Page>
    );
  }

  const job = b.job;
  const nextStep = PROGRESSION.find((p) => p.from === b.status);
  const canCancel = CANCELLABLE.has(b.status) && !b.cancelled_at;
  const driverCharge = Number(b.driver_charge ?? job?.accepted_price ?? job?.fixed_price ?? 0);
  const bookingFee = Number(b.booking_fee ?? b.deposit_amount ?? 0);
  const total = Number(b.total_price ?? b.customer_total ?? driverCharge + bookingFee);

  const customer = b.other_party;
  const customerName = customer?.name || "Customer";
  const customerPhone = customer?.phone;

  const advanceStatus = async () => {
    if (!nextStep) return;
    setSavingStatus(true);
    try {
      await DriverAPI.progressStatus(bookingId, nextStep.to);
      await load();
    } catch (e: any) {
      Alert.alert("Could not update", e?.message || "Please try again.");
    } finally {
      setSavingStatus(false);
    }
  };

  const confirmCancel = async () => {
    try {
      const reasons = await DriverAPI.cancelReasons();
      if (reasons.length === 0) {
        Alert.alert("Unavailable", "Cancel reasons are not available right now.");
        return;
      }
      showReasonPicker(reasons, async (reason) => {
        try {
          await DriverAPI.cancelBooking(bookingId, reason.key);
          await load();
          Alert.alert("Booking cancelled", "The booking has been cancelled.");
        } catch (e: any) {
          Alert.alert("Could not cancel", e?.message || "Please try again.");
        }
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not load cancel reasons.");
    }
  };

  return (
    <Page testID="booking-detail-screen" scroll={false}>
      <PageHeader title="Booking" onBack={goBack} right={<StatusPill status={b.status} />} />

      {tab === "messages" ? (
        <MessagesPane
          bookingId={bookingId}
          customerName={customerName}
          messages={messages}
          onSent={(msg) => setMessages((ms) => [...ms, msg])}
          onBackToOverview={() => setTab("overview")}
          tabs={
            <SegmentedTabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "overview", label: "Overview" },
                { value: "messages", label: "Messages" },
                { value: "pod", label: "POD" },
              ]}
              testIDPrefix="booking-tab"
            />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[8], gap: space[4] }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
        >
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "Overview" },
              { value: "messages", label: "Messages" },
              { value: "pod", label: "POD" },
            ]}
            testIDPrefix="booking-tab"
          />

          {tab === "overview" ? (
            <>
              <Text style={[typography.pageTitle, { marginTop: 4 }]} numberOfLines={2}>
                {job?.title || "Booking"}
              </Text>

              {/* Map preview — pickup → dropoff. Serves as the Phase-5
                  non-live Active Job Map foundation. Falls back cleanly
                  when the booking's job coords are incomplete. */}
              {job
                && Number.isFinite((job as any).pickup_lat)
                && Number.isFinite((job as any).pickup_lng)
                && Number.isFinite((job as any).dropoff_lat)
                && Number.isFinite((job as any).dropoff_lng) ? (
                <RouteMap
                  testID="booking-detail-map"
                  pickup={{ lat: (job as any).pickup_lat, lng: (job as any).pickup_lng }}
                  dropoff={{ lat: (job as any).dropoff_lat, lng: (job as any).dropoff_lng }}
                  height={220}
                  summary={{
                    pickupTown: job.pickup_town,
                    dropoffTown: job.dropoff_town,
                    distanceMiles: job.distance_miles,
                    durationMinutes: (job as any).duration_minutes,
                  }}
                />
              ) : (
                <MapFallback
                  testID="booking-detail-map-fallback"
                  pickupTown={job?.pickup_town}
                  dropoffTown={job?.dropoff_town}
                />
              )}

              {/* Pickup / Dropoff */}
              <View style={styles.routeCard} testID="booking-route-card">
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.micro}>PICKUP</Text>
                    <Text style={typography.strong}>{job?.pickup_town || job?.pickup_address || "—"}</Text>
                    {job?.pickup_address && job?.pickup_town && job.pickup_address !== job.pickup_town ? (
                      <Text style={[typography.caption, { marginTop: 2 }]} numberOfLines={2}>{job.pickup_address}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ height: 12 }} />
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={[styles.dot, { backgroundColor: colors.brand }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.micro}>DROPOFF</Text>
                    <Text style={typography.strong}>{job?.dropoff_town || job?.dropoff_address || "—"}</Text>
                    {job?.dropoff_address && job?.dropoff_town && job.dropoff_address !== job.dropoff_town ? (
                      <Text style={[typography.caption, { marginTop: 2 }]} numberOfLines={2}>{job.dropoff_address}</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Status progression CTA */}
              {nextStep ? (
                <PrimaryButton
                  title={nextStep.label}
                  onPress={advanceStatus}
                  loading={savingStatus}
                  testID="booking-advance-status"
                />
              ) : null}

              {/* Customer card */}
              {customer ? (
                <Card testID="booking-customer-card">
                  <Text style={typography.micro}>CUSTOMER</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <View style={styles.customerAvatar}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                        {customerName.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.cardTitle}>{customerName}</Text>
                      {customer.rating != null ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Icon name="star" size={12} color={colors.accentDark} />
                          <Text style={typography.small}>{Number(customer.rating).toFixed(1)}</Text>
                        </View>
                      ) : null}
                    </View>
                    {customerPhone ? (
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${customerPhone}`)}
                        testID="booking-call-customer"
                        style={styles.callBtn}
                      >
                        <Icon name="phone" size={20} color="#FFFFFF" />
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              ) : null}

              {/* Cargo chips */}
              {hasCargoDetails(job) ? (
                <Card testID="booking-cargo-card">
                  <Text style={typography.cardTitle}>Cargo details</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {job!.weight_kg ? <Chip icon="package" label={`${job!.weight_kg} kg`} /> : null}
                    {job!.item_count ? <Chip icon="box" label={`${job!.item_count} items`} /> : null}
                    {(job!.dimensions_l_m || job!.dimensions || job!.dimensions_w_m || job!.dimensions_h_m) ? (
                      <Chip icon="maximize" label={`${job!.dimensions || `${job!.dimensions_l_m}×${job!.dimensions_w_m}×${job!.dimensions_h_m}m`} L·W·H`} />
                    ) : null}
                    {(job!.requested_vehicle_name || job!.vehicle_required) ? (
                      <Chip icon="truck" label={job!.requested_vehicle_name || job!.vehicle_required!} />
                    ) : null}
                    {job!.needs_forklift ? <Chip icon="tool" label="Forklift required" warn /> : null}
                    {job!.needs_loading_help ? <Chip icon="users" label="Loading help" warn /> : null}
                  </View>
                </Card>
              ) : null}

              {/* Pricing */}
              <Card testID="booking-pricing-card">
                <Text style={typography.micro}>PAYMENT</Text>
                <View style={{ marginTop: space[2] }}>
                  <PriceRow label="Your earning" value={`£${driverCharge.toFixed(2)}`} strong />
                  <PriceRow label="Cargo One booking fee" value={`£${bookingFee.toFixed(2)}`} muted />
                  <View style={styles.divider} />
                  <PriceRow label="Total booking price" value={`£${total.toFixed(2)}`} />
                </View>
              </Card>

              {/* Cancel action */}
              {canCancel ? (
                <SecondaryButton
                  title="Cancel booking"
                  onPress={() =>
                    Alert.alert(
                      "Cancel this booking?",
                      "A cancellation reason is required. This may affect your driver account.",
                      [
                        { text: "Keep", style: "cancel" },
                        { text: "Continue", style: "destructive", onPress: confirmCancel },
                      ],
                    )
                  }
                  testID="booking-cancel"
                />
              ) : null}
            </>
          ) : (
            // POD tab
            <PODPane pod={pod} status={b.status} />
          )}
        </ScrollView>
      )}
    </Page>
  );
}

function showReasonPicker(
  reasons: DriverCancelReason[],
  onPick: (r: DriverCancelReason) => void,
) {
  Alert.alert(
    "Select a reason",
    "Why are you cancelling?",
    [
      ...reasons.slice(0, 5).map((r) => ({ text: r.label, onPress: () => onPick(r) })),
      { text: "Back", style: "cancel" as const },
    ],
    { cancelable: true },
  );
}

function hasCargoDetails(job: any): job is NonNullable<Booking["job"]> {
  if (!job) return false;
  return !!(
    job.weight_kg || job.item_count || job.dimensions ||
    job.dimensions_l_m || job.dimensions_w_m || job.dimensions_h_m ||
    job.requested_vehicle_name || job.vehicle_required ||
    job.needs_forklift || job.needs_loading_help
  );
}

function Chip({ icon, label, warn }: { icon: React.ComponentProps<typeof Icon>["name"]; label: string; warn?: boolean }) {
  return (
    <View style={[styles.chip, warn && styles.chipWarn]}>
      <Icon name={icon} size={13} color={warn ? colors.warningInk : colors.ink} />
      <Text style={[styles.chipText, warn && { color: colors.warningInk }]}>{label}</Text>
    </View>
  );
}

function PriceRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ fontSize: 14, color: muted ? colors.inkMuted : colors.ink, flex: 1 }}>{label}</Text>
      <Text style={{
        fontSize: strong ? 17 : 14,
        fontWeight: strong ? "700" : "500",
        color: muted ? colors.inkMuted : colors.ink,
      }}>{value}</Text>
    </View>
  );
}

function PODPane({ pod, status }: { pod: POD | null; status: string }) {
  if (!pod && status !== "delivered" && status !== "pod_uploaded" && status !== "completed") {
    return (
      <Card testID="booking-pod-empty">
        <Text style={typography.cardTitle}>Proof of Delivery</Text>
        <Text style={[typography.caption, { marginTop: space[2], lineHeight: 19 }]}>
          Once you mark the booking as delivered, upload POD photos and the
          customer signature from the Driver web portal. They will appear here.
        </Text>
      </Card>
    );
  }
  if (!pod) {
    return (
      <Card testID="booking-pod-pending">
        <Text style={typography.cardTitle}>Proof of Delivery</Text>
        <Text style={[typography.caption, { marginTop: space[2], lineHeight: 19 }]}>
          No POD has been uploaded yet. Upload from the Driver web portal to
          finalise this booking.
        </Text>
      </Card>
    );
  }
  const photos = pod.photos || [];
  return (
    <Card testID="booking-pod-view">
      <Text style={typography.cardTitle}>Proof of Delivery</Text>
      {pod.notes ? (
        <Text style={[typography.caption, { marginTop: space[2], lineHeight: 19 }]}>{pod.notes}</Text>
      ) : null}
      {photos.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space[3] }}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: p }} style={styles.podPhoto} testID={`pod-photo-${i}`} />
          ))}
        </View>
      ) : null}
      {pod.signature ? (
        <>
          <Text style={[typography.micro, { marginTop: space[3] }]}>CUSTOMER SIGNATURE</Text>
          <Image source={{ uri: pod.signature }} style={styles.sigImage} testID="pod-signature" />
        </>
      ) : null}
    </Card>
  );
}

function MessagesPane({
  bookingId, customerName, messages, onSent, onBackToOverview, tabs,
}: {
  bookingId: string;
  customerName: string;
  messages: DriverMessage[];
  onSent: (m: DriverMessage) => void;
  onBackToOverview: () => void;
  tabs: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const m = await DriverAPI.postMessage(bookingId, text);
      onSent(m);
      setDraft("");
    } catch (e: any) {
      Alert.alert("Could not send", e?.message || "Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
    >
      <View style={{ paddingHorizontal: space[4], paddingTop: space[2] }}>{tabs}</View>
      <ScrollView
        ref={listRef}
        contentContainerStyle={{ padding: space[4], gap: space[2] }}
      >
        {messages.length === 0 ? (
          <Text style={[typography.caption, { textAlign: "center", paddingVertical: space[6] }]}>
            No messages yet. Start the conversation with {customerName}.
          </Text>
        ) : (
          messages.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs]}
              testID={`msg-${m.id}`}
            >
              <Text style={{ color: m.mine ? "#FFFFFF" : colors.ink, fontSize: 14, lineHeight: 20 }}>
                {m.text}
              </Text>
              <Text style={[styles.bubbleTs, m.mine && { color: "rgba(255,255,255,0.72)" }]}>
                {formatMessageTime(m.created_at)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${customerName}…`}
          placeholderTextColor={colors.inkMuted}
          style={styles.composerInput}
          multiline
          maxLength={1000}
          testID="booking-message-input"
        />
        <Pressable
          onPress={send}
          disabled={sending || !draft.trim()}
          testID="booking-message-send"
          style={({ pressed }) => [
            styles.sendBtn,
            (!draft.trim() || sending) && { opacity: 0.5 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {sending ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="send" size={18} color="#FFFFFF" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatMessageTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const styles = {
  routeCard: {
    padding: space[4],
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  customerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  chip: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bgSecondary,
  },
  chipWarn: { backgroundColor: colors.warningBg },
  chipText: { fontSize: 13, fontWeight: "500" as const, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 6 },
  podPhoto: {
    width: 100, height: 100, borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
  },
  sigImage: {
    marginTop: 6, height: 100, borderRadius: radius.base,
    backgroundColor: colors.bgSecondary, resizeMode: "contain" as const,
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMine: {
    alignSelf: "flex-end" as const,
    backgroundColor: colors.ink,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: "flex-start" as const,
    backgroundColor: colors.bgSecondary,
    borderBottomLeftRadius: 4,
  },
  bubbleTs: {
    marginTop: 4, fontSize: 10, color: colors.inkMuted,
    alignSelf: "flex-end" as const,
  },
  composer: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  composerInput: {
    flex: 1,
    minHeight: 40, maxHeight: 120,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    fontSize: 14, color: colors.ink,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
} as const;
