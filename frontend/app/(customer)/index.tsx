import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusPill } from "@/src/components/StatusPill";
import { GlobalSearchModal } from "@/src/components/GlobalSearchModal";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, shadow, spacing, weight } from "@/src/theme";

export default function CustomerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [b, n] = await Promise.all([
        api<any[]>("/bookings/mine"),
        api<any[]>("/notifications"),
      ]);
      setBookings(b);
      setNotes(n);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const active = bookings.filter(
    (b) => !["completed", "cancelled"].includes(b.status),
  );

  return (
    <View style={styles.root} testID="customer-home">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.bg }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hey {user?.name?.split(" ")[0] || "there"} 👋</Text>
            <Text style={styles.slogan}>Ship Anything. Anywhere.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              style={styles.notifBtn}
              onPress={() => setSearchOpen(true)}
              testID="customer-search-button"
              accessibilityLabel="Search"
            >
              <Ionicons name="search" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.notifBtn}
              onPress={() => router.push("/(customer)/messages")}
              testID="notifications-button"
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              {notes.filter((n) => !n.read).length > 0 && <View style={styles.notifDot} />}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {/* Search prompt */}
        <Pressable
          onPress={() => setSearchOpen(true)}
          style={styles.searchPill}
          testID="customer-search-pill"
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <Text style={styles.searchPillText}>Search categories, vehicles or jobs…</Text>
        </Pressable>

        {/* Hero Post Job */}
        <Pressable
          onPress={() => router.push("/(customer)/post-job")}
          style={styles.hero}
          testID="post-job-hero"
        >
          <ImageBackground
            source={{
              uri: "https://images.unsplash.com/photo-1620455800201-7f00aeef12ed?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMGRlbGl2ZXJ5JTIwdmFufGVufDB8fHx8MTc4NDEzNjI1MHww&ixlib=rb-4.1.0&q=85",
            }}
            style={styles.heroBg}
            imageStyle={{ borderRadius: radius.lg }}
          >
            <LinearGradient
              colors={["rgba(17,17,17,0.1)", "rgba(17,17,17,0.85)"]}
              locations={[0.3, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]}
            />
            <View style={styles.heroContent}>
              <Text style={styles.heroKicker}>NEW SHIPMENT</Text>
              <Text style={styles.heroTitle}>Post a job in{"\n"}under 60 seconds</Text>
              <View style={styles.heroCta}>
                <Text style={styles.heroCtaText}>Get instant quotes</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            </View>
          </ImageBackground>
        </Pressable>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push("/(customer)/bookings")}
            testID="quick-bookings"
          >
            <View style={[styles.quickIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="cube" size={22} color={colors.brand} />
            </View>
            <Text style={styles.quickTitle}>Bookings</Text>
            <Text style={styles.quickSub}>{bookings.length} total</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push("/(customer)/messages")}
            testID="quick-messages"
          >
            <View style={[styles.quickIcon, { backgroundColor: "#FFF7ED" }]}>
              <Ionicons name="chatbubbles" size={22} color={colors.accent} />
            </View>
            <Text style={styles.quickTitle}>Messages</Text>
            <Text style={styles.quickSub}>{notes.filter((n) => !n.read).length} unread</Text>
          </Pressable>
        </View>

        {/* Active bookings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active shipments</Text>
          <Pressable onPress={() => router.push("/(customer)/bookings")}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {active.length === 0 ? (
          <View style={styles.empty} testID="empty-active-bookings">
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={40} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No active shipments</Text>
            <Text style={styles.emptySub}>Post a job to receive instant quotes from vetted drivers.</Text>
          </View>
        ) : (
          active.slice(0, 5).map((b) => (
            <Pressable
              key={b.id}
              style={styles.bookingCard}
              onPress={() => router.push(`/(customer)/booking/${b.id}`)}
              testID={`booking-card-${b.id}`}
            >
              <View style={styles.bookingHead}>
                <Text style={styles.bookingTitle}>{b.job?.title || "Shipment"}</Text>
                <StatusPill status={b.status} />
              </View>
              <View style={styles.bookingRoute}>
                <Ionicons name="location" size={14} color={colors.brand} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {b.job?.pickup_town} → {b.job?.dropoff_town}
                </Text>
              </View>
              <View style={styles.bookingFoot}>
                <Text style={styles.bookingPrice}>£{Number(b.total_price).toFixed(0)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </View>
            </Pressable>
          ))
        )}

        {/* Categories */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>What are you shipping?</Text>
        <View style={styles.catGrid}>
          {[
            { id: "furniture", label: "Furniture", icon: "bed" },
            { id: "parcels", label: "Parcels", icon: "cube-outline" },
            { id: "cars", label: "Cars", icon: "car" },
            { id: "house_moves", label: "House Move", icon: "home" },
            { id: "pallets", label: "Pallets", icon: "layers" },
            { id: "freight", label: "Freight", icon: "boat" },
          ].map((c) => (
            <Pressable
              key={c.id}
              style={styles.catCard}
              onPress={() => router.push(`/(customer)/post-job?category=${c.id}`)}
              testID={`category-${c.id}`}
            >
              <Ionicons name={c.icon as any} size={26} color={colors.text} />
              <Text style={styles.catLabel}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <GlobalSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope="all"
        placeholder="Search categories, vehicles or your jobs…"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  hello: { fontSize: font.xxl, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.4 },
  slogan: { fontSize: font.base, color: colors.textSecondary, marginTop: 2 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
  },
  notifDot: {
    position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.brand,
  },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  searchPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  searchPillText: { color: colors.textSecondary, fontSize: font.base, flex: 1 },
  hero: { height: 200, borderRadius: radius.lg, overflow: "hidden", ...shadow.md },
  heroBg: { flex: 1, justifyContent: "flex-end" },
  heroContent: { padding: spacing.xl, gap: spacing.sm },
  heroKicker: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: weight.bold, letterSpacing: 1.5 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: weight.bold, lineHeight: 30, letterSpacing: -0.5 },
  heroCta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  heroCtaText: { color: "#fff", fontSize: font.base, fontWeight: weight.semibold },
  quickRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  quickCard: {
    flex: 1, padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  quickSub: { fontSize: font.sm, color: colors.textSecondary },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  sectionLink: { color: colors.brand, fontSize: font.base, fontWeight: weight.semibold },
  empty: {
    alignItems: "center", padding: spacing.xxl, backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg, gap: spacing.sm,
  },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  emptySub: { fontSize: font.base, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  bookingCard: {
    padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  bookingHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bookingTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, flex: 1, marginRight: spacing.sm },
  bookingRoute: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  routeText: { fontSize: font.base, color: colors.textSecondary, flex: 1 },
  bookingFoot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  bookingPrice: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  catCard: {
    width: "31%", aspectRatio: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", gap: spacing.xs,
  },
  catLabel: { fontSize: font.sm, fontWeight: weight.medium, color: colors.text, textAlign: "center" },
});
