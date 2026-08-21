/**
 * HomeScreen — native customer Home / Dashboard.
 *
 * Reproduces frontend/src/pages/portal/customer/Dashboard.jsx pixel
 * hierarchy: greeting header + notification/search buttons, search
 * pill, hero "Post a job in under 60 seconds", 2-col quick actions
 * (Bookings + Messages with unread badge), and Active shipments
 * list. Uses the same colours, radii, spacing and copy as the web
 * source. Layout adapts to iPad via a max-content width so the
 * information density matches the web md: breakpoint.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, Search, ArrowRight, Package as PackageIcon, MessagesSquare } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Booking } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { theme as t } from "../theme";

const HERO_IMG = "https://images.unsplash.com/photo-1620455800201-7f00aeef12ed?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85";

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const contentMax = wide ? 720 : width;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [msgUnread, setMsgUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [b, n] = await Promise.all([
        CustomerAPI.myBookings().catch(() => [] as Booking[]),
        CustomerAPI.listNotifications().catch(() => [] as any[]),
      ]);
      setBookings(Array.isArray(b) ? b : []);
      const unread = (Array.isArray(n) ? n : []).filter((x: any) => !x.read_at && !x.read).length;
      setNotifUnread(unread);
      setMsgUnread(0);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = bookings.filter((b) => !["completed", "cancelled"].includes(String(b.status || "")));
  const firstName = (user?.name || "").split(" ")[0] || "there";

  return (
    <SafeAreaView style={styles.root} testID="customer-dashboard" edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { alignSelf: "center", width: "100%", maxWidth: contentMax }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={t.color.brand} />}
      >
        <View style={[styles.header, wide && { paddingHorizontal: t.space[8] }]}>
          <View>
            <Text style={wide ? t.type.h1Large : t.type.h1}>Hey {firstName}</Text>
            <Text style={[t.type.bodyMuted, { marginTop: 2 }]}>Ship Anything. Anywhere.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <RoundBtn testID="customer-search-button" onPress={() => null}>
              <Search size={20} color={t.color.ink} strokeWidth={2} />
            </RoundBtn>
            <RoundBtn testID="notifications-button" dot={notifUnread > 0} onPress={() => navigation.navigate("Messages")}>
              <Bell size={20} color={t.color.ink} strokeWidth={2} />
            </RoundBtn>
          </View>
        </View>

        <View style={[styles.body, wide && { paddingHorizontal: t.space[8] }]}>
          <Pressable
            testID="customer-search-pill"
            onPress={() => null}
            style={({ pressed }) => [styles.searchPill, pressed && { backgroundColor: "#E5E7EB" }]}
          >
            <Search size={16} color={t.color.inkMuted} />
            <Text style={{ color: t.color.inkMuted, fontSize: 14, marginLeft: 8 }}>Search categories, vehicles or jobs…</Text>
          </Pressable>

          <Pressable
            testID="post-job-hero"
            onPress={() => navigation.navigate("PostJob" as never)}
            style={styles.heroWrap}
          >
            <ImageBackground source={{ uri: HERO_IMG }} style={styles.hero} imageStyle={{ borderRadius: t.radius.lg }}>
              <View style={styles.heroOverlay} />
              <View style={styles.heroBody}>
                <Text style={t.type.micro}>NEW SHIPMENT</Text>
                <Text style={styles.heroTitle}>Post a job in{"\n"}under 60 seconds</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Text style={styles.heroCta}>Get instant quotes</Text>
                  <ArrowRight color="#FFFFFF" size={16} strokeWidth={2.4} />
                </View>
              </View>
            </ImageBackground>
          </Pressable>

          <View style={styles.quickGrid}>
            <QuickCard
              testID="quick-bookings"
              onPress={() => navigation.navigate("Bookings" as never)}
              tint={t.color.tintRed}
              Icon={PackageIcon}
              iconColor={t.color.brand}
              title="Bookings"
              subtitle={`${bookings.length} total`}
            />
            <QuickCard
              testID="quick-messages"
              onPress={() => navigation.navigate("Messages")}
              tint={t.color.tintOrange}
              Icon={MessagesSquare}
              iconColor={t.color.accentOrange}
              title="Messages"
              subtitle={msgUnread > 0 ? `${msgUnread} unread` : "No new messages"}
              badge={msgUnread > 0 ? (msgUnread > 99 ? "99+" : String(msgUnread)) : undefined}
            />
          </View>

          <View style={styles.sectionHead}>
            <Text style={t.type.h2}>Active shipments</Text>
            <Pressable onPress={() => navigation.navigate("Bookings" as never)}>
              <Text style={{ color: t.color.brand, fontWeight: "600", fontSize: 14 }}>See all</Text>
            </Pressable>
          </View>

          {active.length === 0 ? (
            <View style={styles.empty} testID="empty-active-bookings">
              <View style={styles.emptyCircle}><PackageIcon size={32} color="#9CA3AF" strokeWidth={2} /></View>
              <Text style={t.type.h3}>No active shipments</Text>
              <Text style={[t.type.caption, { textAlign: "center", maxWidth: 320 }]}>Post a job to receive instant quotes from vetted drivers.</Text>
            </View>
          ) : (
            active.slice(0, 5).map((b) => (
              <Pressable
                key={b.id}
                onPress={() => navigation.navigate("BookingDetail", { bookingId: b.id })}
                style={styles.shipmentCard}
                testID={`shipment-${b.id}`}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <View style={[styles.badge, { backgroundColor: t.color.accentSuccessBg }]}>
                    <Text style={{ color: t.color.accentSuccessInk, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
                      {String(b.status || "").toUpperCase().replace(/_/g, " ")}
                    </Text>
                  </View>
                  <Text style={{ color: t.color.brand, fontSize: 14, fontWeight: "700" }}>
                    £{(b as any).price ?? "—"}
                  </Text>
                </View>
                <Text style={[t.type.h3, { marginBottom: 4 }]} numberOfLines={1}>
                  {(b as any).pickup_address || "Pickup"} → {(b as any).dropoff_address || "Drop-off"}
                </Text>
                <Text style={t.type.caption}>Ref: {b.id.slice(0, 8).toUpperCase()}</Text>
              </Pressable>
            ))
          )}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RoundBtn({ children, onPress, dot, testID }: { children: React.ReactNode; onPress: () => void; dot?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.round, pressed && { backgroundColor: t.color.border }]}>
      {children}
      {dot ? <View style={styles.dot} testID="notifications-unread-dot" /> : null}
    </Pressable>
  );
}

function QuickCard(props: { onPress: () => void; tint: string; Icon: any; iconColor: string; title: string; subtitle: string; badge?: string; testID?: string }) {
  const { Icon } = props;
  return (
    <Pressable testID={props.testID} onPress={props.onPress} style={({ pressed }) => [styles.quickCard, pressed && { borderColor: t.color.ink }]}>
      <View style={[styles.quickIcon, { backgroundColor: props.tint }]}><Icon size={20} color={props.iconColor} strokeWidth={2.2} /></View>
      {props.badge ? (
        <View style={styles.quickBadge} testID="customer-messages-unread-badge"><Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{props.badge}</Text></View>
      ) : null}
      <Text style={t.type.h3}>{props.title}</Text>
      <Text style={t.type.caption}>{props.subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.color.surface },
  scroll: { paddingBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  body: { paddingHorizontal: 16, gap: 16 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.color.surfaceMuted, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.brand },
  searchPill: { backgroundColor: t.color.surfaceMuted, borderRadius: t.radius.md, paddingHorizontal: 16, paddingVertical: 12 },
  heroWrap: { borderRadius: t.radius.lg, overflow: "hidden" },
  hero: { height: 200, justifyContent: "flex-end" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17,17,17,0.55)" },
  heroBody: { padding: 24, gap: 8 },
  heroTitle: { fontSize: 26, lineHeight: 30, fontWeight: "700", color: "#fff", letterSpacing: -0.4 },
  heroCta: { fontSize: 14, fontWeight: "600", color: "#fff", marginTop: 4 },
  quickGrid: { flexDirection: "row", gap: 12 },
  quickCard: { flex: 1, gap: 8, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface, padding: 16, position: "relative" },
  quickIcon: { width: 40, height: 40, borderRadius: t.radius.md, alignItems: "center", justifyContent: "center" },
  quickBadge: { position: "absolute", right: 12, top: 12, backgroundColor: t.color.brand, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, minWidth: 22, alignItems: "center" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  empty: { alignItems: "center", gap: 8, backgroundColor: t.color.surfaceMuted, borderRadius: t.radius.lg, paddingHorizontal: 24, paddingVertical: 40 },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shipmentCard: { borderRadius: t.radius.md, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface, padding: 16 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
