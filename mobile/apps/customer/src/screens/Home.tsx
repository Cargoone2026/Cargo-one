/**
 * HomeScreen — native customer Home / Dashboard.
 * 1:1 port of frontend/src/pages/portal/customer/Dashboard.jsx.
 * Uses primitives from ../ui + theme so every value maps back to a
 * value in frontend/src/theme.js. Do NOT introduce new colour or
 * spacing tokens here — add them to /theme.ts first.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Bell,
  Search,
  ArrowRight,
  Package as PackageIcon,
  MessagesSquare,
  Bed,
  Boxes,
  Car,
  Home as HomeIcon,
  Layers as LayersIcon,
  Ship,
  MapPin,
  ChevronRight,
} from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Booking } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import {
  BookingRow,
  EmptyState,
  IconButton,
  Page,
  PageHeader,
  SearchPill,
  SectionTitle,
  StatusPill,
} from "../ui";
import { useShellMenu } from "../components/AppShell";

const HERO_IMG =
  "https://images.unsplash.com/photo-1620455800201-7f00aeef12ed?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85";

const CATEGORIES = [
  { id: "furniture", label: "Furniture", Icon: Bed },
  { id: "parcels", label: "Parcels", Icon: Boxes },
  { id: "cars", label: "Cars", Icon: Car },
  { id: "house_moves", label: "House Move", Icon: HomeIcon },
  { id: "pallets", label: "Pallets", Icon: LayersIcon },
  { id: "freight", label: "Freight", Icon: Ship },
];

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const { openDrawer, showMenu } = useShellMenu();

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

  const active = useMemo(
    () => bookings.filter((b) => !["completed", "cancelled"].includes(String(b.status || ""))),
    [bookings],
  );
  const firstName = (user?.name || "").split(" ")[0] || "there";

  return (
    <Page testID="customer-dashboard" scroll={false}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <PageHeader
          large
          showMenu={showMenu}
          onMenuPress={openDrawer}
          title={<Text style={typography.h1Large}>Hey {firstName}</Text>}
          subtitle="Ship Anything. Anywhere."
          right={
            <>
              <IconButton onPress={() => null} testID="customer-search-button" accessibilityLabel="Search">
                <Search size={20} color={colors.ink} strokeWidth={2} />
              </IconButton>
              <IconButton
                onPress={() => navigation.navigate("Messages")}
                testID="notifications-button"
                accessibilityLabel="Notifications"
                badged={notifUnread > 0}
              >
                <Bell size={20} color={colors.ink} strokeWidth={2} />
              </IconButton>
            </>
          }
        />

        <View style={{ paddingHorizontal: 16, gap: 16, maxWidth: wide ? 720 : undefined, alignSelf: wide ? "center" : undefined, width: "100%" }}>
          <SearchPill placeholder="Search categories, vehicles or jobs…" testID="customer-search-pill" onPress={() => null} />

          {/* Hero */}
          <Pressable
            testID="post-job-hero"
            onPress={() => navigation.navigate("PostJob")}
            style={styles.heroWrap}
          >
            <ImageBackground source={{ uri: HERO_IMG }} style={styles.hero} imageStyle={{ borderRadius: radius.lg }}>
              <View style={styles.heroOverlay} />
              <View style={styles.heroBody}>
                <Text style={styles.heroKicker}>NEW SHIPMENT</Text>
                <Text style={styles.heroTitle}>Post a job in{"\n"}under 60 seconds</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Text style={styles.heroCta}>Get instant quotes</Text>
                  <ArrowRight color="#FFFFFF" size={16} strokeWidth={2.4} />
                </View>
              </View>
            </ImageBackground>
          </Pressable>

          {/* Quick actions */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <QuickCard
              testID="quick-bookings"
              onPress={() => navigation.navigate("Bookings")}
              tint="#FEE2E2"
              Icon={PackageIcon}
              iconColor={colors.brand}
              title="Bookings"
              subtitle={`${bookings.length} total`}
            />
            <QuickCard
              testID="quick-messages"
              onPress={() => navigation.navigate("Messages")}
              tint="#FFF7ED"
              Icon={MessagesSquare}
              iconColor={colors.accent}
              title="Messages"
              subtitle={msgUnread > 0 ? `${msgUnread} unread` : "No new messages"}
              badge={msgUnread > 0 ? (msgUnread > 99 ? "99+" : String(msgUnread)) : undefined}
            />
          </View>

          {/* Active shipments */}
          <SectionTitle
            style={{ marginTop: 12 }}
            right={
              <Pressable onPress={() => navigation.navigate("Bookings")}>
                <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}>See all</Text>
              </Pressable>
            }
          >
            Active shipments
          </SectionTitle>

          {active.length === 0 ? (
            <View style={styles.emptyBlock}>
              <View style={styles.emptyCircle}>
                <PackageIcon size={32} color={colors.inkFaint} strokeWidth={2} />
              </View>
              <Text style={[typography.cardTitle, { marginTop: 8 }]}>No active shipments</Text>
              <Text style={[typography.caption, { textAlign: "center", maxWidth: 320 }]}>
                Post a job to receive instant quotes from vetted drivers.
              </Text>
            </View>
          ) : (
            <View>
              {active.slice(0, 5).map((b: any) => (
                <BookingRow
                  key={b.id}
                  title={b.job?.title || "Shipment"}
                  status={b.status}
                  pickup={b.job?.pickup_town}
                  dropoff={b.job?.dropoff_town}
                  price={b.total_price ?? b.customer_total ?? null}
                  onPress={() => navigation.navigate("BookingDetail", { bookingId: b.id })}
                  testID={`booking-card-${b.id}`}
                />
              ))}
            </View>
          )}

          {/* Categories */}
          <Text style={[typography.sectionTitle, { marginTop: 12 }]}>What are you shipping?</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => navigation.navigate("PostJob")}
                testID={`category-${c.id}`}
                style={({ pressed }) => [styles.categoryTile, pressed && { backgroundColor: colors.bgTertiary }]}
              >
                <c.Icon size={24} color={colors.ink} strokeWidth={2} />
                <Text style={styles.categoryLabel}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </Page>
  );
}

function QuickCard(props: {
  onPress: () => void;
  tint: string;
  Icon: any;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: string;
  testID?: string;
}) {
  const { Icon } = props;
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      style={({ pressed }) => [styles.quickCard, pressed && { borderColor: colors.ink }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: props.tint }]}>
        <Icon size={20} color={props.iconColor} strokeWidth={2.2} />
      </View>
      {props.badge ? (
        <View style={styles.quickBadge} testID="customer-messages-unread-badge">
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{props.badge}</Text>
        </View>
      ) : null}
      <Text style={typography.cardTitle}>{props.title}</Text>
      <Text style={typography.caption}>{props.subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroWrap: { borderRadius: radius.lg, overflow: "hidden" },
  hero: { height: 200, justifyContent: "flex-end" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.55)",
  },
  heroBody: { padding: 24, gap: 8 },
  heroKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, color: "rgba(255,255,255,0.75)" },
  heroTitle: { fontSize: 26, lineHeight: 30, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.4 },
  heroCta: { fontSize: 14, fontWeight: "600", color: "#FFFFFF", marginTop: 4 },

  quickCard: {
    flex: 1,
    gap: 8,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 16,
    position: "relative",
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.base,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },

  emptyBlock: {
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 24 },
  categoryTile: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  categoryLabel: { fontSize: 13, fontWeight: "500", color: colors.ink },
});
