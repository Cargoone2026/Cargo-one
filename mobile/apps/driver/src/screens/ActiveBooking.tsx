/**
 * ActiveBookingScreen — driver's live POD / progression flow.
 * Uses shared Cargo One primitives + ActiveJobMap. Preserves the
 * status-progression state machine and background location push
 * exactly as before.
 *
 * R71.16.8 (Driver P1-e) — adds Chat + Presence parity with the web
 * source of truth `frontend/src/pages/portal/driver/BookingDetail.jsx`:
 *   • Overview / Chat segmented tabs (Chat visible only when paid).
 *   • Message list, empty state, timestamps, sender distinction, ticks
 *     (sent / delivered / read), moderated banner.
 *   • Send message → POST /bookings/{id}/messages with { text },
 *     optimistic append, in-flight guard, error surface.
 *   • While the Chat tab is active AND payment_status==="paid":
 *       - GET  /bookings/{id}/messages           every 6 s
 *       - POST /bookings/{id}/conversation/presence every 20 s
 *       - POST /bookings/{id}/messages/mark-read once when entering.
 *     Intervals + cancelled flag torn down on tab switch / unmount.
 *
 * R71.16.9 (Driver P1-f) — adds POD upload parity:
 *   • POD tab visible only when paid AND b.status === "delivered"
 *     (matches the web precondition).
 *   • If a POD already exists → read-only summary tile with created_at,
 *     optional notes, optional GPS.
 *   • Otherwise → photo grid (expo-image-picker camera/library), notes
 *     input, submit-in-flight guard, error surface, checklist.
 *   • Signature capture DEFERRED (no native signature subsystem in
 *     monorepo); backend accepts signature: null.
 *   • Best-effort GPS at submit via expo-location.getCurrentPositionAsync
 *     with a 5s race (matches the web behaviour).
 *   • POST body: { photos, signature: null, notes, lat, lng } exactly
 *     matching the backend PODUpload contract (see server.py:354–359).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Star,
  X,
  AlertTriangle,
} from "lucide-react-native";
import {
  Booking,
  DriverAPI,
  DriverCancelReason,
  DriverMessage,
  POD,
  SharedAPI,
  TrackingResponse,
} from "@cargoone/core";
import { Page, PageHeader, PrimaryButton, SecondaryButton, SegmentedTabs, StatusPill, SummaryRow } from "../ui";
import { colors, radius, typography } from "../theme";
import { ActiveJobMap } from "../ActiveJobMap";
import { useAuth } from "../AuthContext";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "ActiveBooking">;

const NEXT: Record<string, { key: string; label: string }> = {
  confirmed: { key: "travelling", label: "Start trip to pickup" },
  deposit_paid: { key: "travelling", label: "Start trip to pickup" },
  travelling: { key: "arrived", label: "Arrived at pickup" },
  arrived: { key: "collected", label: "Collected cargo" },
  collected: { key: "on_route", label: "On route to dropoff" },
  on_route: { key: "delivered", label: "Delivered" },
};

type Tab = "overview" | "chat" | "pod";

export function ActiveBookingScreen({ route }: P) {
  const { bookingId } = route.params;
  const { user } = useAuth();
  const [b, setB] = useState<Booking | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    setB(await DriverAPI.bookingDetail(bookingId));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!b || !["travelling", "arrived", "collected", "on_route"].includes(b.status)) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 8000 },
        (loc) => DriverAPI.pushLocation(loc.coords.latitude, loc.coords.longitude).catch(() => {}),
      );
    })();
    return () => {
      if (sub) sub.remove();
    };
  }, [b?.status]);

  useEffect(() => {
    if (!b) return;
    const iv = setInterval(async () => {
      try {
        setTracking(await SharedAPI.tracking(b.id));
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [b?.id]);

  if (!b) {
    return (
      <Page>
        <PageHeader title="Active job" />
        <Text style={{ padding: 16, color: colors.inkMuted }}>Loading booking…</Text>
      </Page>
    );
  }

  const next = NEXT[b.status];
  const currentBooking = b;
  const job = b.job;
  const paid = b.payment_status === "paid";
  const podEligible = paid && b.status === "delivered";
  const podShown = paid && ["delivered", "pod_uploaded", "completed"].includes(b.status);
  const cancelEligible =
    paid && !["delivered", "pod_uploaded", "completed", "cancelled", "cancelled_by_driver"].includes(b.status);
  const reviewShown = paid && b.status === "completed";
  const [showCancel, setShowCancel] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [myReview, setMyReview] = useState<any | null>(null);
  const [reviewOfMe, setReviewOfMe] = useState<any | null>(null);

  useEffect(() => {
    if (!reviewShown) {
      setMyReview(null);
      setReviewOfMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const mine = await DriverAPI.myReviewForBooking(currentBooking.id);
      if (!cancelled) setMyReview(mine || null);
      const drvId = (currentBooking as any).driver_id || (currentBooking as any).assigned_driver_id;
      if (drvId) {
        const all = await DriverAPI.myReviews(drvId);
        if (!cancelled) {
          const forThis = (Array.isArray(all) ? all : []).find(
            (r: any) => r.booking_id === currentBooking.id,
          );
          setReviewOfMe(forThis || null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewShown, currentBooking.id]);

  async function advance() {
    if (!next) return;
    try {
      const updated = await DriverAPI.progressStatus(currentBooking.id, next.key);
      setB(updated);
      if (next.key === "delivered") {
        Alert.alert("Job completed", "Nice work — your earnings are updated.");
      }
    } catch (e: any) {
      Alert.alert("Could not update status", e?.message || "");
    }
  }

  const tabOptions: { value: Tab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "chat", label: "Chat" },
  ];
  if (podShown) tabOptions.push({ value: "pod", label: "POD" });

  return (
    <Page testID="driver-active-booking" scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <PageHeader title={job?.title || "Active job"} />
        {paid ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <SegmentedTabs
              value={tab}
              onChange={setTab}
              options={tabOptions}
              testIDPrefix="driver-active-tab"
            />
          </View>
        ) : null}

        {tab === "overview" || !paid ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={{ paddingHorizontal: 16, gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <StatusPill status={b.status} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MapPin size={14} color={colors.brand} />
                <Text style={{ fontSize: 14, color: colors.inkMuted, flex: 1 }} numberOfLines={1}>
                  {job?.pickup_town || "—"} → {job?.dropoff_town || "—"}
                </Text>
              </View>

              <ActiveJobMap
                status={b.status}
                pickup={
                  job?.pickup_lat != null
                    ? { lat: job.pickup_lat!, lng: job.pickup_lng!, town: job.pickup_town, address: job.pickup_address }
                    : null
                }
                dropoff={
                  job?.dropoff_lat != null
                    ? { lat: job.dropoff_lat!, lng: job.dropoff_lng!, town: job.dropoff_town, address: job.dropoff_address }
                    : null
                }
                driver={tracking?.last_location ? { lat: tracking.last_location.lat, lng: tracking.last_location.lng } : null}
                etaMinutes={tracking?.eta_minutes ?? job?.duration_minutes ?? null}
                distanceMiles={tracking?.remaining_miles ?? job?.distance_miles ?? null}
                role="driver"
              />

              <View style={cardStyle}>
                <Text style={typography.micro}>Booking details</Text>
                <View style={{ marginTop: 8 }}>
                  <SummaryRow label="Reference" value={b.id.slice(0, 8).toUpperCase()} />
                  <SummaryRow label="Customer" value={(b as any).customer_name || "—"} />
                  {job?.pickup_address ? <SummaryRow label="Pickup" value={job.pickup_address} /> : null}
                  {job?.dropoff_address ? <SummaryRow label="Delivery" value={job.dropoff_address} /> : null}
                </View>
              </View>

              {next ? <PrimaryButton title={next.label} onPress={advance} testID="progress-status" /> : null}
              {podEligible ? (
                <PrimaryButton
                  title="Upload Proof of Delivery"
                  onPress={() => setTab("pod")}
                  testID="go-to-pod-tab"
                />
              ) : null}
              {cancelEligible ? (
                <Pressable
                  onPress={() => setShowCancel(true)}
                  testID="driver-open-cancel-modal"
                  style={({ pressed }) => [
                    {
                      marginTop: 4,
                      padding: 12,
                      borderRadius: radius.base,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed ? "#FEF2F2" : colors.bg,
                      alignItems: "center",
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.error }}>Cancel this job</Text>
                </Pressable>
              ) : null}

              {reviewShown && !myReview ? (
                <SecondaryButton
                  title="Leave a review for the customer"
                  onPress={() => setShowReview(true)}
                  testID="driver-leave-review-button"
                />
              ) : null}
              {reviewShown && myReview ? (
                <DriverMyReviewCard review={myReview} />
              ) : null}
              {reviewShown && reviewOfMe ? (
                <DriverReviewOfMeCard
                  review={reviewOfMe}
                  onReplied={() => {
                    // Refresh review-of-me so the reply appears
                    (async () => {
                      const drvId =
                        (currentBooking as any).driver_id ||
                        (currentBooking as any).assigned_driver_id;
                      if (!drvId) return;
                      const all = await DriverAPI.myReviews(drvId);
                      const forThis = (Array.isArray(all) ? all : []).find(
                        (r: any) => r.booking_id === currentBooking.id,
                      );
                      setReviewOfMe(forThis || null);
                    })();
                  }}
                />
              ) : null}
            </View>
          </ScrollView>
        ) : tab === "chat" ? (
          <ChatPane bookingId={b.id} myUserId={user?.id ?? null} />
        ) : (
          <PODPane bookingId={b.id} canSubmit={podEligible} onUploaded={load} />
        )}
      </KeyboardAvoidingView>
      <DriverCancelModal
        open={showCancel}
        bookingId={b.id}
        onClose={() => setShowCancel(false)}
        onCancelled={() => {
          setShowCancel(false);
          load();
        }}
      />
      <DriverReviewModal
        open={showReview}
        bookingId={b.id}
        onClose={() => setShowReview(false)}
        onSubmitted={(r) => {
          setShowReview(false);
          setMyReview(r);
        }}
      />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* ChatPane — mirrors web BookingDetail.jsx chat tab (P1-e).           */
/* ------------------------------------------------------------------ */

const REFRESH_MS = 6000;   // web line 178
const PRESENCE_MS = 20000; // web line 177

function ChatPane({ bookingId, myUserId }: { bookingId: string; myUserId: string | null }) {
  const [messages, setMessages] = useState<DriverMessage[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  // Polling + presence lifecycle (mirrors web lines 161–180).
  useEffect(() => {
    let cancelled = false;
    const ping = () => DriverAPI.presencePing(bookingId).catch(() => {});
    const markRead = () => DriverAPI.markMessagesRead(bookingId).catch(() => {});
    const refresh = async () => {
      try {
        const m = await DriverAPI.bookingMessages(bookingId);
        if (!cancelled) setMessages(Array.isArray(m) ? m : []);
      } catch {
        /* silent */
      }
    };
    ping();
    markRead();
    refresh();
    const iv1 = setInterval(ping, PRESENCE_MS);
    const iv2 = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(iv1);
      clearInterval(iv2);
    };
  }, [bookingId]);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (messages.length > 0) {
      // slight defer so ScrollView has laid out the new row
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 30);
    }
  }, [messages.length]);

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setErr(null);
    setSending(true);
    try {
      const m = await DriverAPI.postMessage(bookingId, trimmed);
      setMessages((prev) => [...prev, m]);
      setText("");
    } catch (ex: any) {
      setErr(ex?.message || "Message could not be sent");
    } finally {
      setSending(false);
    }
  }, [bookingId, text, sending]);

  return (
    <View style={{ flex: 1, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.bg, overflow: "hidden" }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
        testID="driver-chat-messages"
      >
        {messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 8 }}>
            <MessageCircle size={40} color={colors.inkFaint} />
            <Text style={typography.caption}>Chat with your customer.</Text>
          </View>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} m={m} mine={!!myUserId && m.sender_id === myUserId} />
          ))
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: 10,
          paddingVertical: 10,
          backgroundColor: colors.bg,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          placeholderTextColor={colors.inkFaint}
          style={{
            flex: 1,
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.pill,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 14,
            color: colors.ink,
          }}
          testID="driver-chat-input"
          onSubmitEditing={send}
          returnKeyType="send"
          editable={!sending}
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          testID="driver-chat-send"
          accessibilityLabel="Send"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: !text.trim() || sending ? "#FCA5A5" : pressed ? colors.brandDark : colors.brand,
            opacity: !text.trim() || sending ? 0.6 : 1,
          })}
        >
          <Send size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      {err ? (
        <Text
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            fontSize: 12,
            color: colors.error,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
          }}
          testID="driver-chat-error"
        >
          {err}
        </Text>
      ) : null}
    </View>
  );
}

function MessageBubble({ m, mine }: { m: DriverMessage; mine: boolean }) {
  const stamp = m.created_at ? new Date(m.created_at) : null;
  const time = stamp && !isNaN(stamp.getTime())
    ? stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const tick = mine ? (m.read_at ? "✓✓" : m.delivered_at ? "✓✓" : "✓") : null;
  const tickColor = m.read_at ? "#FCA5A5" : "rgba(255,255,255,0.7)";

  return (
    <View
      style={{ alignItems: mine ? "flex-end" : "flex-start", width: "100%" }}
      testID={`driver-message-row-${m.id}`}
    >
      <View
        style={{
          maxWidth: "78%",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 16,
          backgroundColor: mine ? colors.brand : colors.bgSecondary,
        }}
      >
        <Text style={{ fontSize: 14, color: mine ? "#FFFFFF" : colors.ink }}>
          {m.text || ""}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          marginTop: 2,
          justifyContent: mine ? "flex-end" : "flex-start",
        }}
      >
        {time ? <Text style={{ fontSize: 10, color: colors.inkFaint }}>{time}</Text> : null}
        {mine && tick ? (
          <Text
            style={{ fontSize: 10, fontWeight: "700", color: tickColor }}
            testID={`driver-message-tick-${m.id}`}
          >
            {tick}
          </Text>
        ) : null}
      </View>
      {m.moderated ? (
        <View
          style={{
            marginTop: 4,
            maxWidth: "78%",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            justifyContent: mine ? "flex-end" : "flex-start",
          }}
          testID={`message-moderated-${m.id}`}
        >
          <ShieldCheck size={12} color={colors.brand} />
          <Text style={{ fontSize: 10.5, color: colors.inkMuted, flexShrink: 1 }}>
            {mine
              ? "Contact details hidden by Cargo One — please share them in person on collection."
              : "Contact details hidden by Cargo One."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const cardStyle = {
  padding: 16,
  borderRadius: radius.base,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.bg,
} as const;

/* ------------------------------------------------------------------ */
/* PODPane — mirrors web BookingDetail.jsx POD tab (P1-f).             */
/* ------------------------------------------------------------------ */

const MAX_POD_PHOTOS = 8;

function PODPane({
  bookingId,
  canSubmit,
  onUploaded,
}: {
  bookingId: string;
  canSubmit: boolean;
  onUploaded: () => void;
}) {
  const [existing, setExisting] = useState<POD | null | undefined>(undefined);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await DriverAPI.fetchPOD(bookingId);
      if (!cancelled) setExisting(p ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  async function pickFrom(kind: "camera" | "library") {
    if (photos.length >= MAX_POD_PHOTOS) return;
    const perm =
      kind === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        kind === "camera" ? "Please allow camera access to take photos." : "Please allow photo library access.",
      );
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      allowsEditing: false,
      quality: 0.7,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    };
    const res =
      kind === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.length) return;
    const next = [...photos];
    for (const asset of res.assets) {
      if (next.length >= MAX_POD_PHOTOS) break;
      if (!asset.base64) continue;
      next.push(`data:image/jpeg;base64,${asset.base64}`);
    }
    setPhotos(next);
  }

  function askSource() {
    if (photos.length >= MAX_POD_PHOTOS) return;
    Alert.alert("Add photo", "Where should we get it from?", [
      { text: "Take photo", onPress: () => pickFrom("camera") },
      { text: "Choose from library", onPress: () => pickFrom("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function bestEffortGPS(): Promise<{ lat?: number; lng?: number }> {
    // 5s race — matches the web behaviour (line 335). Silently ignores failure.
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== "granted") return {};
      }
      const timed = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timed,
      ]);
      if (pos && (pos as Location.LocationObject).coords) {
        const c = (pos as Location.LocationObject).coords;
        return { lat: c.latitude, lng: c.longitude };
      }
    } catch {
      /* silent */
    }
    return {};
  }

  const submit = useCallback(async () => {
    if (submitting) return;
    if (photos.length === 0) {
      setErr("Add at least one delivery photo.");
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const gps = await bestEffortGPS();
      await DriverAPI.uploadPOD(bookingId, {
        photos,
        signature: null, // Signature capture deferred (see file header)
        notes: notes.trim() || "Delivered as agreed.",
        lat: gps.lat,
        lng: gps.lng,
      });
      const p = await DriverAPI.fetchPOD(bookingId);
      setExisting(p ?? null);
      onUploaded();
    } catch (e: any) {
      setErr(e?.message || "Could not upload POD");
    } finally {
      setSubmitting(false);
    }
  }, [bookingId, photos, notes, submitting, onUploaded]);

  if (existing === undefined) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={typography.caption}>Loading POD…</Text>
      </View>
    );
  }

  if (existing) {
    const stamp = existing.created_at ? new Date(existing.created_at) : null;
    const stampStr = stamp && !isNaN(stamp.getTime()) ? stamp.toLocaleString() : "";
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} testID="driver-pod-uploaded">
        <Text style={typography.h2}>Proof of Delivery</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: "#F0FDF4",
            borderRadius: radius.base,
            padding: 16,
          }}
        >
          <CheckCircle2 size={24} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>POD uploaded ✓</Text>
            {stampStr ? <Text style={{ fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>{stampStr}</Text> : null}
          </View>
        </View>
        {existing.photos && existing.photos.length > 0 ? (
          <View style={cardStyle}>
            <Text style={typography.micro}>Photos ({existing.photos.length})</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {existing.photos.map((src, i) => (
                <Image key={i} source={{ uri: src }} style={{ width: 84, height: 84, borderRadius: radius.sm, backgroundColor: colors.bgSecondary }} />
              ))}
            </View>
          </View>
        ) : null}
        {existing.notes ? (
          <View style={cardStyle}>
            <Text style={typography.micro}>Notes</Text>
            <Text style={{ marginTop: 6, fontSize: 14, color: colors.ink }}>{existing.notes}</Text>
          </View>
        ) : null}
        {existing.lat != null && existing.lng != null ? (
          <View style={cardStyle}>
            <Text style={typography.micro}>GPS</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: colors.ink }}>
              {Number(existing.lat).toFixed(5)}, {Number(existing.lng).toFixed(5)}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  // Upload form
  const disabled = !canSubmit || photos.length === 0 || submitting;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} testID="driver-pod-form">
      <Text style={typography.h2}>Proof of Delivery</Text>

      {!canSubmit ? (
        <View style={{ padding: 12, backgroundColor: colors.warningBg, borderRadius: radius.base }}>
          <Text style={{ fontSize: 13, color: colors.warningInk }}>
            Mark this job as Delivered from the Overview tab to upload POD.
          </Text>
        </View>
      ) : null}

      <View>
        <Text style={typography.micro}>1 · Take delivery photos</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {photos.map((p, i) => (
            <View key={i} style={podStyles.tile}>
              <Image source={{ uri: p }} style={podStyles.thumb} />
              <Pressable
                onPress={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}
                testID={`pod-remove-photo-${i}`}
                style={podStyles.removeBtn}
                hitSlop={6}
              >
                <X size={12} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_POD_PHOTOS ? (
            <>
              <Pressable
                onPress={() => pickFrom("camera")}
                testID="pod-add-photo-camera"
                style={[podStyles.tile, podStyles.addTile]}
                disabled={!canSubmit || submitting}
              >
                <Camera size={20} color={colors.ink} />
                <Text style={{ marginTop: 4, fontSize: 11, fontWeight: "600", color: colors.ink }}>Camera</Text>
              </Pressable>
              <Pressable
                onPress={() => pickFrom("library")}
                testID="pod-add-photo-library"
                style={[podStyles.tile, podStyles.addTile]}
                disabled={!canSubmit || submitting}
              >
                <ImagePlus size={20} color={colors.ink} />
                <Text style={{ marginTop: 4, fontSize: 11, fontWeight: "600", color: colors.ink }}>Library</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <View>
        <Text style={typography.micro}>2 · Delivery notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Left with reception"
          placeholderTextColor={colors.inkFaint}
          editable={canSubmit && !submitting}
          testID="pod-notes-input"
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.base,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: colors.ink,
            backgroundColor: colors.bg,
          }}
        />
      </View>

      <View style={{ backgroundColor: "#F9FAFB", borderRadius: radius.base, padding: 12, gap: 6 }} testID="pod-checklist">
        <PodChecklistRow ok={photos.length > 0} label={`Photos (${photos.length})`} />
        <PodChecklistRow ok={false} label="Signature capture (deferred)" muted />
        <PodChecklistRow ok label="GPS attempted at submit" />
        <PodChecklistRow ok label="Timestamped" />
      </View>

      {err ? (
        <Text style={{ fontSize: 13, color: colors.error }} testID="pod-error">
          {err}
        </Text>
      ) : null}

      <PrimaryButton
        title="Submit POD"
        onPress={submit}
        loading={submitting}
        disabled={disabled}
        testID="submit-pod"
      />
    </ScrollView>
  );
}

function PodChecklistRow({ ok, label, muted }: { ok: boolean; label: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: muted ? colors.bgTertiary : ok ? colors.success : colors.inkFaint,
        }}
      >
        <Text style={{ fontSize: 10, color: "#FFFFFF", fontWeight: "700" }}>{ok && !muted ? "✓" : muted ? "…" : "•"}</Text>
      </View>
      <Text style={{ fontSize: 13, color: muted ? colors.inkMuted : colors.ink }}>{label}</Text>
    </View>
  );
}

const podStyles = StyleSheet.create({
  tile: {
    width: 84,
    height: 84,
    borderRadius: radius.base,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
});


/* ------------------------------------------------------------------ */
/* DriverCancelModal — mirrors web components/ui-portal/DriverCancelModal.jsx */
/* ------------------------------------------------------------------ */

function DriverCancelModal({
  open,
  bookingId,
  onClose,
  onCancelled,
}: {
  open: boolean;
  bookingId: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reasons, setReasons] = useState<DriverCancelReason[]>([]);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "confirm">("pick");

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setReason("");
    setExplanation("");
    setErr(null);
    (async () => {
      const rs = await DriverAPI.cancelReasons();
      setReasons(
        Array.isArray(rs) && rs.length > 0
          ? rs
          : [
              // Fallback list — kept in sync with the server-side DRIVER_CANCEL_REASONS dict.
              { key: "vehicle_issue", label: "Vehicle issue" },
              { key: "breakdown", label: "Breakdown" },
              { key: "unable_to_complete", label: "Unable to safely complete the job" },
              { key: "vehicle_unsuitable", label: "Vehicle unsuitable" },
              { key: "customer_or_location", label: "Customer/location issue" },
              { key: "personal_emergency", label: "Personal emergency" },
              { key: "route_or_access", label: "Route/access issue" },
              { key: "other", label: "Other" },
            ],
      );
    })();
  }, [open]);

  const needsExplanation = reason === "other";
  const canProceed = !!reason && (!needsExplanation || explanation.trim().length > 0);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await DriverAPI.cancelBooking(bookingId, reason, explanation);
      onCancelled();
    } catch (e: any) {
      setErr(e?.message || "Could not cancel this booking. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RNModal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={cancelStyles.backdrop}>
        <View style={cancelStyles.sheet} testID="driver-cancel-modal">
          <View style={cancelStyles.header}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink, flex: 1 }}>
              {step === "confirm" ? "Confirm cancellation" : "Cancel this job?"}
            </Text>
            <Pressable
              onPress={onClose}
              testID="driver-cancel-modal-close"
              hitSlop={8}
              style={cancelStyles.closeBtn}
            >
              <X size={18} color={colors.inkMuted} />
            </Pressable>
          </View>

          {step === "pick" ? (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 13, color: colors.ink, lineHeight: 20 }}>
                Please choose the reason that best fits. This helps us route the customer to the right next step and keeps your account in good standing.
              </Text>
              <View style={{ gap: 8 }} testID="driver-cancel-reasons-list">
                {reasons.map((r) => {
                  const on = reason === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setReason(r.key)}
                      testID={`driver-cancel-reason-${r.key}`}
                      style={[
                        cancelStyles.reasonRow,
                        on && { borderColor: colors.brand, backgroundColor: "#FEF2F2" },
                      ]}
                    >
                      <View
                        style={[
                          cancelStyles.radio,
                          on ? { borderColor: colors.brand } : { borderColor: colors.border },
                        ]}
                      >
                        {on ? <View style={cancelStyles.radioDot} /> : null}
                      </View>
                      <Text style={{ fontSize: 14, color: colors.ink, flex: 1 }}>{r.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {needsExplanation ? (
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 }}>
                    Please explain briefly
                  </Text>
                  <TextInput
                    value={explanation}
                    onChangeText={setExplanation}
                    placeholder="A short explanation helps our team understand what happened."
                    placeholderTextColor={colors.inkFaint}
                    multiline
                    maxLength={500}
                    testID="driver-cancel-explanation-input"
                    style={{
                      minHeight: 80,
                      textAlignVertical: "top",
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.base,
                      padding: 12,
                      fontSize: 13,
                      color: colors.ink,
                      backgroundColor: colors.bg,
                    }}
                  />
                </View>
              ) : null}

              {err ? (
                <Text style={{ fontSize: 12, color: colors.error }} testID="driver-cancel-error">
                  {err}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <SecondaryButton
                  title="Never mind"
                  onPress={onClose}
                  testID="driver-cancel-modal-back"
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title="Continue"
                  onPress={() => setStep("confirm")}
                  disabled={!canProceed}
                  testID="driver-cancel-modal-continue"
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <View style={cancelStyles.warnBox}>
                <AlertTriangle size={16} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E" }}>
                    Please cancel only when necessary
                  </Text>
                  <Text style={{ fontSize: 12, color: "#92400E", marginTop: 4, lineHeight: 18 }}>
                    Frequent or invalid cancellations may affect your driver account and could result in suspension or termination after manual review. Every cancellation is recorded with the reason you provide.
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: colors.ink }}>
                Reason: <Text style={{ fontWeight: "700" }}>{reasons.find((r) => r.key === reason)?.label}</Text>
              </Text>
              {explanation ? (
                <Text style={{ fontSize: 12, fontStyle: "italic", color: colors.inkMuted }}>
                  "{explanation}"
                </Text>
              ) : null}
              <Text style={{ fontSize: 13, color: colors.ink, lineHeight: 20 }}>
                Once you confirm, this booking will be released and other eligible drivers may accept it. You will not be able to re-accept this same booking.
              </Text>
              {err ? (
                <Text style={{ fontSize: 12, color: colors.error }} testID="driver-cancel-final-error">
                  {err}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <SecondaryButton
                  title="Back"
                  onPress={() => setStep("pick")}
                  testID="driver-cancel-modal-edit"
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title={busy ? "Cancelling…" : "Cancel this booking"}
                  onPress={submit}
                  loading={busy}
                  disabled={busy}
                  variant="danger"
                  testID="driver-cancel-modal-confirm"
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </RNModal>
  );
}

const cancelStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSecondary,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
});

/* ------------------------------------------------------------------ */
/* DriverReviewModal — 5-star rating + comment for driver P1-g.        */
/* ------------------------------------------------------------------ */

function DriverReviewModal({
  open,
  bookingId,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  bookingId: string;
  onClose: () => void;
  onSubmitted: (review: any) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRating(5);
      setComment("");
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (busy) return;
    if (rating < 1 || rating > 5) {
      setErr("Please choose a rating from 1 to 5.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await DriverAPI.submitReview(bookingId, rating, comment.trim() || undefined);
      onSubmitted(r);
    } catch (e: any) {
      setErr(e?.message || "Could not submit review. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RNModal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cancelStyles.backdrop}>
        <View style={cancelStyles.sheet} testID="driver-review-modal">
          <View style={cancelStyles.header}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink }}>
              Leave a review
            </Text>
            <Pressable onPress={onClose} testID="driver-review-modal-close" hitSlop={8} style={cancelStyles.closeBtn}>
              <X size={18} color={colors.inkMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Text style={{ fontSize: 13, color: colors.ink, lineHeight: 20 }}>
              How was this delivery? Your feedback helps other drivers know what to expect.
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }} testID="driver-review-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRating(n)}
                  testID={`driver-review-star-${n}`}
                  hitSlop={6}
                >
                  <Star
                    size={36}
                    color={n <= rating ? colors.accent : colors.inkFaint}
                    fill={n <= rating ? colors.accent : "transparent"}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Optional comment for the customer"
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={1000}
              testID="driver-review-comment"
              style={{
                minHeight: 90,
                textAlignVertical: "top",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.base,
                padding: 12,
                fontSize: 14,
                color: colors.ink,
                backgroundColor: colors.bg,
              }}
            />
            {err ? (
              <Text style={{ fontSize: 12, color: colors.error }} testID="driver-review-error">
                {err}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <SecondaryButton title="Cancel" onPress={onClose} testID="driver-review-cancel" style={{ flex: 1 }} />
              <PrimaryButton
                title={busy ? "Submitting…" : "Submit review"}
                onPress={submit}
                loading={busy}
                disabled={busy}
                testID="driver-review-submit"
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

/* ------------------------------------------------------------------ */
/* DriverMyReviewCard — read-only render of driver's own review.       */
/* ------------------------------------------------------------------ */

function DriverMyReviewCard({ review }: { review: any }) {
  const r = Math.max(0, Math.min(5, Number(review?.rating) || 0));
  return (
    <View style={reviewStyles.card} testID="driver-my-review-card">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={typography.micro}>Your review</Text>
        <StarRow value={r} />
      </View>
      {review?.comment ? (
        <Text style={{ marginTop: 8, fontSize: 14, color: colors.ink, lineHeight: 20 }}>
          {review.comment}
        </Text>
      ) : null}
      {review?.reply ? (
        <View style={reviewStyles.replyBox}>
          <Text style={typography.micro}>Customer replied</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: colors.ink, lineHeight: 20 }}>
            {review.reply}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* DriverReviewOfMeCard — customer's review of me + optional reply.    */
/* ------------------------------------------------------------------ */

function DriverReviewOfMeCard({ review, onReplied }: { review: any; onReplied: () => void }) {
  const r = Math.max(0, Math.min(5, Number(review?.rating) || 0));
  const alreadyReplied = !!review?.reply;
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const text = reply.trim();
    if (!text) {
      setErr("Please write a reply.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await DriverAPI.replyToReview(review.id, text);
      setReply("");
      onReplied();
    } catch (e: any) {
      setErr(e?.message || "Could not send reply. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={reviewStyles.card} testID="driver-review-of-me-card">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={typography.micro}>Customer's review</Text>
        <StarRow value={r} />
      </View>
      {review?.from_name ? (
        <Text style={{ marginTop: 4, fontSize: 12, color: colors.inkMuted }}>{review.from_name}</Text>
      ) : null}
      {review?.comment ? (
        <Text style={{ marginTop: 8, fontSize: 14, color: colors.ink, lineHeight: 20 }}>
          {review.comment}
        </Text>
      ) : null}
      {alreadyReplied ? (
        <View style={reviewStyles.replyBox}>
          <Text style={typography.micro}>Your reply</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: colors.ink, lineHeight: 20 }}>
            {review.reply}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 12, gap: 8 }}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Reply to this review (once only)"
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={1000}
            editable={!busy}
            testID="driver-review-reply-input"
            style={{
              minHeight: 70,
              textAlignVertical: "top",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.base,
              padding: 10,
              fontSize: 13,
              color: colors.ink,
              backgroundColor: colors.bg,
            }}
          />
          {err ? (
            <Text style={{ fontSize: 12, color: colors.error }} testID="driver-review-reply-error">
              {err}
            </Text>
          ) : null}
          <PrimaryButton
            title={busy ? "Sending…" : "Send reply"}
            onPress={submit}
            loading={busy}
            disabled={busy || !reply.trim()}
            testID="driver-review-reply-submit"
          />
        </View>
      )}
    </View>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          color={n <= value ? colors.accent : colors.inkFaint}
          fill={n <= value ? colors.accent : "transparent"}
        />
      ))}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  replyBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSecondary,
  },
});

