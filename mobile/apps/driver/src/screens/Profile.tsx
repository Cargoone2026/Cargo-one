/**
 * ProfileScreen — driver's own profile card, informational stats and
 * customer reviews list. Ports the reading side of the web
 * driver/Profile.jsx page. Editing lives in Settings (deep flow to
 * be added when needed).
 */
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle, ChevronRight, FileText, Key, LogOut, Settings, ShieldCheck, Star, Truck, User as UserIcon } from "lucide-react-native";
import { DriverAPI } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { MenuRow, Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";
import type { RootStackParamList } from "../App";

export function ProfileScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const { openDrawer, showMenu } = useShellMenu();
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    DriverAPI.myReviews(user.id).then(setReviews).catch(() => setReviews([]));
  }, [user?.id]);

  if (!user) return null;

  const initials = (user.name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avgRating = Number((user as any).rating || 0);
  const reviewCount = (user as any).review_count ?? reviews.length;
  const verified = !!(user as any).verified_driver;
  const status = (user as any).status || "";

  const doLogout = () =>
    Alert.alert("Log out?", "You can sign in again anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  return (
    <Page testID="driver-profile">
      <ScrollView>
        <PageHeader large title="Profile" showMenu={showMenu} onMenuPress={openDrawer} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          {/* Identity card */}
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={typography.h2}>{user.name || "Driver"}</Text>
            <Text style={[typography.caption]}>{user.email}</Text>
            {verified ? (
              <View style={styles.verifiedPill} testID="verified-driver-badge">
                <ShieldCheck size={12} color="#FFFFFF" />
                <Text style={styles.verifiedText}>VERIFIED DRIVER</Text>
              </View>
            ) : null}
            <View style={[styles.statusPill, { backgroundColor: colors.bgSecondary }]} testID="driver-status-pill">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status === "active" ? colors.success : colors.warning }} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}>
                {status === "active" ? "Approved Driver" : "Pending Approval"}
              </Text>
            </View>
            <View style={styles.ratingPill}>
              <Star size={12} color={colors.accent} fill={colors.accent} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accentDark }}>
                {avgRating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? "review" : "reviews"} · {(user as any).total_jobs || 0} jobs
              </Text>
            </View>
          </View>

          {/* Menu */}
          <View style={styles.card}>
            <MenuRow label="Edit profile" leftIcon={UserIcon} onPress={() => nav.navigate("Settings")} testID="driver-profile-edit" />
            <MenuRow label="Passkeys (Face ID / Touch ID)" leftIcon={Key} onPress={() => nav.navigate("Passkeys")} testID="driver-profile-passkeys" />
            <MenuRow label="My fleet" leftIcon={Truck} onPress={() => nav.navigate("Fleet")} testID="driver-profile-fleet" />
            <MenuRow label="Account settings" leftIcon={Settings} onPress={() => nav.navigate("Settings")} testID="driver-profile-settings" />
            <MenuRow label="Log out" leftIcon={LogOut} onPress={doLogout} testID="driver-profile-logout" />
          </View>

          {/* Reviews */}
          <View style={styles.reviewsCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Star size={16} color={colors.accent} fill={colors.accent} />
                <Text style={typography.cardTitle}>Customer reviews</Text>
              </View>
              <Text style={typography.small}>{reviewCount} total</Text>
            </View>
            {reviews.length === 0 ? (
              <Text style={[typography.caption, { marginTop: 8 }]}>
                No reviews yet. Complete deliveries to start collecting reviews from customers.
              </Text>
            ) : (
              reviews.slice(0, 5).map((r: any) => (
                <View key={r.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>{r.from_name || "Customer"}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accentDark }}>
                      {"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}
                    </Text>
                  </View>
                  {r.comment ? <Text style={[typography.body, { marginTop: 4 }]}>{r.comment}</Text> : null}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  identity: {
    alignItems: "center" as const,
    gap: 6,
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 4,
  },
  avatarText: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" as const },
  verifiedPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8, color: "#FFFFFF" },
  statusPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  ratingPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden" as const,
  },
  reviewsCard: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
