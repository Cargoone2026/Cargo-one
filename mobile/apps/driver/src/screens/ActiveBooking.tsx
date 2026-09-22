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
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { MapPin, MessageCircle, Send, ShieldCheck } from "lucide-react-native";
import {
  Booking,
  DriverAPI,
  DriverMessage,
  SharedAPI,
  TrackingResponse,
} from "@cargoone/core";
import { Page, PageHeader, PrimaryButton, SegmentedTabs, StatusPill, SummaryRow } from "../ui";
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

type Tab = "overview" | "chat";

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
              options={[
                { value: "overview", label: "Overview" },
                { value: "chat", label: "Chat" },
              ]}
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
            </View>
          </ScrollView>
        ) : (
          <ChatPane bookingId={b.id} myUserId={user?.id ?? null} />
        )}
      </KeyboardAvoidingView>
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
