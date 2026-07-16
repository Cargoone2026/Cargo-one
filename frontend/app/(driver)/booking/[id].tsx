import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import MapView from "@/src/components/MapView";
import { StatusPill } from "@/src/components/StatusPill";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

const STATUS_FLOW = [
  { key: "travelling", label: "Start Trip to Pickup" },
  { key: "arrived", label: "Arrived at Pickup" },
  { key: "collected", label: "Collected Cargo" },
  { key: "on_route", label: "On Route to Dropoff" },
  { key: "delivered", label: "Delivered" },
];

type Tab = "overview" | "chat" | "pod";

export default function DriverBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [b, setB] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [pod, setPod] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [podNotes, setPodNotes] = useState("");
  const [podSubmitting, setPodSubmitting] = useState(false);
  const locWatchRef = useRef<Location.LocationSubscription | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const bk = await api(`/bookings/${id}`);
      setB(bk);
      if (bk.payment_status === "paid") {
        const [t, m, p] = await Promise.all([
          api(`/tracking/${id}`).catch(() => null),
          api(`/bookings/${id}/messages`).catch(() => []),
          api(`/bookings/${id}/pod`).catch(() => null),
        ]);
        setTracking(t);
        setMessages(m || []);
        setPod(p);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // GPS tracking while on route
  useEffect(() => {
    if (!b || !id) return;
    const shouldTrack = ["travelling", "collected", "on_route"].includes(b.status);
    async function startTracking() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        locWatchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50 },
          async (loc) => {
            try {
              await api(`/tracking/${id}`, {
                method: "POST",
                body: { lat: loc.coords.latitude, lng: loc.coords.longitude },
              });
            } catch {
              // silent
            }
          },
        );
      } catch {
        // silent
      }
    }
    if (shouldTrack) startTracking();
    return () => {
      if (locWatchRef.current) locWatchRef.current.remove();
      locWatchRef.current = null;
    };
  }, [b, id]);

  async function updateStatus(status: string) {
    if (!id) return;
    setUpdating(true);
    try {
      await api(`/bookings/${id}/status`, { method: "POST", body: { status } });
      load();
    } finally {
      setUpdating(false);
    }
  }

  async function sendMessage() {
    if (!msgText.trim() || !id) return;
    const text = msgText.trim();
    setMsgText("");
    try {
      const m = await api(`/bookings/${id}/messages`, { method: "POST", body: { text } });
      setMessages((prev) => [...prev, m]);
    } catch {
      setMsgText(text);
    }
  }

  async function uploadPOD() {
    if (!id) return;
    setPodSubmitting(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = p.coords.latitude;
        lng = p.coords.longitude;
      } catch {}
      await api(`/bookings/${id}/pod`, {
        method: "POST",
        body: {
          photos: [],
          signature: "customer-signed",
          notes: podNotes || "Delivered as agreed.",
          lat,
          lng,
        },
      });
      load();
      setTab("pod");
    } finally {
      setPodSubmitting(false);
    }
  }

  if (!b) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const job = b.job || {};
  const paid = b.payment_status === "paid";
  const currentIdx = STATUS_FLOW.findIndex((s) => s.key === b.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentIdx + 1]
    : b.status === "deposit_paid" || b.status === "confirmed"
    ? STATUS_FLOW[0]
    : null;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="driver-booking-back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking</Text>
        <StatusPill status={b.status} />
      </View>

      {paid && (
        <View style={styles.tabs}>
          {(["overview", "chat", "pod"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
              testID={`driver-tab-${t}`}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "overview" ? "Overview" : t === "chat" ? "Chat" : "POD"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {(!paid || tab === "overview") && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        >
          <Text style={styles.title}>{job.title}</Text>

          <View style={styles.map}>
            <MapView
              pickup={{ lat: job.pickup_lat, lng: job.pickup_lng, label: "Pickup" }}
              dropoff={{ lat: job.dropoff_lat, lng: job.dropoff_lng, label: "Dropoff" }}
              driver={tracking?.last_location}
              trail={tracking?.trail}
              height={220}
            />
          </View>

          <View style={styles.routeBox}>
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeValue}>
                  {paid ? job.pickup_address : job.pickup_town}
                </Text>
              </View>
            </View>
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: colors.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Dropoff</Text>
                <Text style={styles.routeValue}>
                  {paid ? job.dropoff_address : job.dropoff_town}
                </Text>
              </View>
            </View>
          </View>

          {b.other_party && (
            <View style={styles.partyCard}>
              <View style={styles.partyAvatar}>
                <Text style={styles.partyAvatarText}>
                  {b.other_party.name[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.partyName}>{b.other_party.name}</Text>
                {b.other_party.phone && (
                  <Text style={styles.partyPhone}>{b.other_party.phone}</Text>
                )}
              </View>
              {b.other_party.phone && (
                <Pressable style={styles.callBtn} testID="call-customer-button">
                  <Ionicons name="call" size={18} color="#fff" />
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.summary}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Your bid (you receive)</Text>
              <Text style={styles.sumValueBig}>£{Number(b.driver_charge ?? b.balance_due).toFixed(2)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Cargo One Booking Fee (collected via Stripe)</Text>
              <Text style={styles.sumValue}>£{Number(b.booking_fee ?? b.deposit_amount).toFixed(2)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Customer pays total</Text>
              <Text style={styles.sumValue}>£{Number(b.total_price).toFixed(2)}</Text>
            </View>
            <View style={[styles.sumRow, styles.sumTotal]}>
              <Text style={styles.sumLabelStrong}>You collect from customer on delivery</Text>
              <Text style={styles.sumTotalValue}>£{Number(b.driver_charge ?? b.balance_due).toFixed(2)}</Text>
            </View>
          </View>

          {!paid && (
            <View style={styles.pendingBox}>
              <Ionicons name="time" size={22} color={colors.warning} />
              <Text style={styles.pendingText}>
                Waiting for customer to pay deposit. Details unlock once paid.
              </Text>
            </View>
          )}

          {paid && nextStatus && b.status !== "delivered" && b.status !== "pod_uploaded" && (
            <Button
              title={nextStatus.label}
              onPress={() => updateStatus(nextStatus.key)}
              loading={updating}
              testID={`update-status-${nextStatus.key}`}
            />
          )}

          {paid && b.status === "delivered" && (
            <Button
              title="Upload Proof of Delivery"
              onPress={() => setTab("pod")}
              testID="go-to-pod-tab"
            />
          )}
        </ScrollView>
      )}

      {paid && tab === "chat" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={100}
        >
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.chatList}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[styles.msgRow, mine ? styles.msgMine : styles.msgOther]}>
                  <View style={[styles.msgBubble, mine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
                    <Text style={mine ? styles.msgTextMine : styles.msgTextOther}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyText}>Chat with your customer.</Text>
              </View>
            }
          />
          <View style={styles.chatInput}>
            <TextInput
              value={msgText}
              onChangeText={setMsgText}
              placeholder="Type a message"
              placeholderTextColor={colors.textTertiary}
              style={styles.chatField}
              testID="driver-chat-input"
            />
            <Pressable onPress={sendMessage} style={styles.chatSend} testID="driver-chat-send">
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {paid && tab === "pod" && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Proof of Delivery</Text>
          {pod ? (
            <View>
              <View style={styles.podBox}>
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.podTitle}>POD uploaded ✓</Text>
                  <Text style={styles.podTs}>{new Date(pod.created_at).toLocaleString()}</Text>
                </View>
              </View>
              {pod.notes ? (
                <View style={styles.podDetail}>
                  <Text style={styles.podLabel}>Notes</Text>
                  <Text style={styles.podValue}>{pod.notes}</Text>
                </View>
              ) : null}
              {pod.lat ? (
                <View style={styles.podDetail}>
                  <Text style={styles.podLabel}>GPS</Text>
                  <Text style={styles.podValue}>{pod.lat.toFixed(5)}, {pod.lng?.toFixed(5)}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View>
              <View style={styles.podPlaceholder}>
                <Ionicons name="camera" size={40} color={colors.textTertiary} />
                <Text style={styles.podPlaceholderText}>Add signature & photos (auto-attached on submit)</Text>
              </View>
              <Input
                label="Delivery notes"
                value={podNotes}
                onChangeText={setPodNotes}
                placeholder="e.g. Left at reception"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: "top" }}
                testID="pod-notes-input"
              />
              <Button
                title="Submit Proof of Delivery"
                onPress={uploadPOD}
                loading={podSubmitting}
                testID="submit-pod-button"
              />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  tabs: {
    flexDirection: "row", marginHorizontal: spacing.xl, backgroundColor: colors.bgSecondary,
    borderRadius: radius.pill, padding: 4,
  },
  tab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: "center", borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.text },
  tabText: { color: colors.textSecondary, fontSize: font.base, fontWeight: weight.medium },
  tabTextActive: { color: "#fff" },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { fontSize: 26, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.4 },
  map: { height: 220, borderRadius: radius.lg, overflow: "hidden", marginTop: spacing.sm },
  routeBox: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.bgSecondary, gap: spacing.md },
  routeItem: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  routeValue: { fontSize: font.base, color: colors.text, fontWeight: weight.semibold },
  partyCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  partyAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.text,
    alignItems: "center", justifyContent: "center",
  },
  partyAvatarText: { color: "#fff", fontSize: font.xl, fontWeight: weight.bold },
  partyName: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  partyPhone: { fontSize: font.base, color: colors.brand, fontWeight: weight.semibold, marginTop: 4 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success,
    alignItems: "center", justifyContent: "center",
  },
  summary: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  sumLabel: { fontSize: font.base, color: colors.textSecondary, flex: 1, marginRight: spacing.md },
  sumLabelStrong: { fontSize: font.base, color: colors.text, fontWeight: weight.semibold, flex: 1 },
  sumValue: { fontSize: font.base, color: colors.text, fontWeight: weight.semibold },
  sumValueBig: { fontSize: font.lg, color: colors.text, fontWeight: weight.bold },
  sumTotal: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md, marginTop: spacing.xs },
  sumTotalValue: { fontSize: font.xxl, color: colors.success, fontWeight: weight.bold },
  pendingBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg,
    backgroundColor: "#FFFBEB", borderRadius: radius.md,
  },
  pendingText: { flex: 1, fontSize: font.base, color: colors.text, lineHeight: 20 },
  chatList: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  msgRow: { flexDirection: "row" },
  msgMine: { justifyContent: "flex-end" },
  msgOther: { justifyContent: "flex-start" },
  msgBubble: { maxWidth: "80%", padding: spacing.md, borderRadius: radius.lg },
  msgBubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: colors.bgSecondary, borderBottomLeftRadius: 4 },
  msgTextMine: { color: "#fff", fontSize: font.base },
  msgTextOther: { color: colors.text, fontSize: font.base },
  chatInput: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg,
  },
  chatField: {
    flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: font.base, color: colors.text,
  },
  chatSend: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: font.base, textAlign: "center" },
  podBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    backgroundColor: "#F0FDF4", borderRadius: radius.md, marginBottom: spacing.md,
  },
  podTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  podTs: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  podDetail: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  podLabel: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  podValue: { fontSize: font.base, color: colors.text, lineHeight: 20 },
  podPlaceholder: {
    alignItems: "center", justifyContent: "center", padding: spacing.xxl,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border, borderStyle: "dashed", gap: spacing.md,
    marginBottom: spacing.md,
  },
  podPlaceholderText: { color: colors.textSecondary, textAlign: "center" },
});
