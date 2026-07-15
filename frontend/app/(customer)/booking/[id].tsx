import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
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
import MapView from "@/src/components/MapView";
import { StatusPill } from "@/src/components/StatusPill";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Tab = "overview" | "chat" | "pod";

export default function BookingDetail() {
  const { id, payment, session_id } = useLocalSearchParams<{
    id: string;
    payment?: string;
    session_id?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const [b, setB] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [pod, setPod] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const pollRef = useRef<any>(null);

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

  // Poll payment status after return from Stripe
  useEffect(() => {
    if (payment !== "success" || !session_id) return;
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const s: any = await api(`/payments/status/${session_id}`);
        if (s.payment_status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          load();
        } else if (attempts > 10 && pollRef.current) {
          clearInterval(pollRef.current);
        }
      } catch {
        // silent
      }
    };
    tick();
    pollRef.current = setInterval(tick, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [payment, session_id, load]);

  async function payDeposit() {
    if (!id) return;
    setPayLoading(true);
    try {
      const originUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "";
      const res: any = await api(`/bookings/${id}/deposit`, {
        method: "POST",
        body: { origin_url: originUrl },
      });
      await WebBrowser.openBrowserAsync(res.url);
      // On return, focus effect refires and we detect payment status.
      load();
    } catch (e: any) {
      // silent
    } finally {
      setPayLoading(false);
    }
  }

  async function sendMessage() {
    if (!msgText.trim() || !id) return;
    const text = msgText.trim();
    setMsgText("");
    try {
      const m = await api(`/bookings/${id}/messages`, {
        method: "POST",
        body: { text },
      });
      setMessages((prev) => [...prev, m]);
    } catch {
      setMsgText(text);
    }
  }

  async function completeBooking() {
    if (!id) return;
    try {
      await api(`/bookings/${id}/complete`, { method: "POST" });
      load();
    } catch {
      // silent
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="booking-back">
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
              testID={`booking-tab-${t}`}
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
              pickup={
                job.pickup_lat
                  ? { lat: job.pickup_lat, lng: job.pickup_lng, label: "Pickup" }
                  : undefined
              }
              dropoff={
                job.dropoff_lat
                  ? { lat: job.dropoff_lat, lng: job.dropoff_lng, label: "Dropoff" }
                  : undefined
              }
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
                <View style={styles.partyMeta}>
                  <Ionicons name="star" size={12} color={colors.accent} />
                  <Text style={styles.partyMetaText}>
                    {Number(b.other_party.rating).toFixed(1)} · {b.other_party.total_jobs} jobs
                  </Text>
                </View>
                {b.other_party.phone && (
                  <Text style={styles.partyPhone}>{b.other_party.phone}</Text>
                )}
              </View>
              {b.other_party.phone && (
                <Pressable style={styles.callBtn} testID="call-party-button">
                  <Ionicons name="call" size={18} color="#fff" />
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.summary}>
            <SumRow label="Total price" value={`£${Number(b.total_price).toFixed(0)}`} />
            <SumRow
              label="Deposit"
              value={`£${Number(b.deposit_amount).toFixed(2)}`}
              highlight={!paid}
            />
            <SumRow label="Balance to driver on delivery" value={`£${Number(b.balance_due).toFixed(2)}`} />
          </View>

          {!paid && (
            <View style={styles.payBox}>
              <Ionicons name="lock-closed" size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.payBoxTitle}>Contact & chat locked</Text>
                <Text style={styles.payBoxText}>
                  Pay the £{Number(b.deposit_amount).toFixed(2)} deposit to unlock driver details, exact addresses, and chat.
                </Text>
              </View>
            </View>
          )}

          {paid && b.status !== "completed" && b.status === "pod_uploaded" && (
            <Button
              title="Confirm delivery & complete"
              onPress={completeBooking}
              testID="complete-booking-button"
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
                <Text style={styles.emptyText}>Start the conversation with your driver.</Text>
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
              testID="chat-input"
            />
            <Pressable onPress={sendMessage} style={styles.chatSend} testID="chat-send-button">
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
                  <Text style={styles.podTitle}>Delivered</Text>
                  <Text style={styles.podTs}>{new Date(pod.created_at).toLocaleString()}</Text>
                </View>
              </View>
              {pod.notes ? (
                <View style={styles.podDetail}>
                  <Text style={styles.podLabel}>Driver notes</Text>
                  <Text style={styles.podValue}>{pod.notes}</Text>
                </View>
              ) : null}
              {pod.signature ? (
                <View style={styles.podDetail}>
                  <Text style={styles.podLabel}>Signature</Text>
                  <Text style={styles.podValue}>Signed by customer ✓</Text>
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
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.emptyText}>
                Driver will upload proof of delivery here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {!paid && (
        <View style={styles.foot}>
          <Button
            title={`Pay £${Number(b.deposit_amount).toFixed(2)} Deposit`}
            onPress={payDeposit}
            loading={payLoading}
            testID="pay-deposit-button"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function SumRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumValue, highlight && { color: colors.brand, fontWeight: weight.bold }]}>{value}</Text>
    </View>
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
  scroll: { padding: spacing.xl, paddingBottom: 140, gap: spacing.md },
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
  partyMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  partyMetaText: { fontSize: font.sm, color: colors.textSecondary },
  partyPhone: { fontSize: font.base, color: colors.brand, fontWeight: weight.semibold, marginTop: 4 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success,
    alignItems: "center", justifyContent: "center",
  },
  summary: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  sumRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: spacing.sm,
  },
  sumLabel: { fontSize: font.base, color: colors.textSecondary },
  sumValue: { fontSize: font.lg, color: colors.text, fontWeight: weight.semibold },
  payBox: {
    flexDirection: "row", gap: spacing.md, padding: spacing.lg,
    backgroundColor: "#FEF2F2", borderRadius: radius.md, alignItems: "center",
  },
  payBoxTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  payBoxText: { fontSize: font.base, color: colors.textSecondary, marginTop: 2, lineHeight: 20 },
  foot: {
    padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg,
  },
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
    backgroundColor: "#F0FDF4", borderRadius: radius.md,
  },
  podTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  podTs: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  podDetail: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.md,
  },
  podLabel: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  podValue: { fontSize: font.base, color: colors.text, lineHeight: 20 },
});
