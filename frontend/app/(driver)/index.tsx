import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { GlobalSearchModal } from "@/src/components/GlobalSearchModal";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Dashboard = {
  user?: { id: string; name?: string; status?: string; rating?: number; review_count?: number };
  fleet?: {
    count: number;
    active_count: number;
    capabilities: string[];
    vehicles: {
      id: string;
      vehicle_type_name?: string;
      registration?: string;
      status?: string;
      is_default?: boolean;
    }[];
  };
  earnings?: {
    today: number;
    week: number;
    month: number;
    all_time: number;
    completed_count: number;
  };
  bids?: { active: number; accepted: number };
  jobs?: {
    nearby_count: number;
    active_count: number;
    upcoming_count: number;
    upcoming: {
      id: string;
      job_id: string;
      status?: string;
      total_price?: number;
      driver_charge?: number;
      title?: string;
      pickup_town?: string;
      dropoff_town?: string;
      requested_pickup_at?: string;
    }[];
  };
  verification?: {
    docs_verified: number;
    docs_pending: number;
    docs_rejected: number;
    account_status?: string;
  };
};

export default function DriverHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [dash, setDash] = useState<Dashboard>({});
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<Dashboard>("/driver/dashboard").catch(() => ({} as Dashboard));
      setDash(d || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pending = user?.status === "pending";
  const earnings = dash.earnings || { today: 0, week: 0, month: 0, all_time: 0, completed_count: 0 };
  const bids = dash.bids || { active: 0, accepted: 0 };
  const fleet = dash.fleet || { count: 0, active_count: 0, capabilities: [], vehicles: [] };
  const jobs = dash.jobs || { nearby_count: 0, active_count: 0, upcoming_count: 0, upcoming: [] };
  const verify = dash.verification || { docs_verified: 0, docs_pending: 0, docs_rejected: 0 };
  const rating = dash.user?.rating ?? user?.rating ?? 5;
  const reviewCount = dash.user?.review_count ?? 0;

  return (
    <View style={styles.root} testID="driver-home">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.bgDark }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hi {user?.name?.split(" ")[0] || "there"}</Text>
            <Text style={styles.slogan}>{pending ? "Complete verification to earn" : "Ready to earn today?"}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setSearchOpen(true)}
              style={styles.iconBtn}
              testID="driver-search-open"
              accessibilityLabel="Search"
            >
              <Ionicons name="search" size={20} color="#fff" />
            </Pressable>
            <View style={styles.headerBadge}>
              <View style={[styles.dot, { backgroundColor: pending ? colors.warning : colors.success }]} />
              <Text style={styles.badgeText}>
                {pending ? "Pending" : "Online"}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {pending && (
          <Pressable style={styles.warningCard} onPress={() => router.push("/(driver)/documents")}>
            <Ionicons name="warning" size={22} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Account under review</Text>
              <Text style={styles.warningText}>
                Upload driving licence, insurance, ID and vehicle photos to start receiving jobs.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        )}

        {/* --- Section 1: Earnings snapshot --- */}
        <View style={styles.card} testID="section-earnings">
          <View style={styles.cardHeadRow}>
            <View style={styles.cardHeadLeft}>
              <View style={[styles.cardIcon, { backgroundColor: colors.brandLight }]}>
                <Ionicons name="wallet" size={18} color={colors.brand} />
              </View>
              <Text style={styles.cardTitle}>Earnings</Text>
            </View>
            <Pressable onPress={() => router.push("/(driver)/earnings")}>
              <Text style={styles.link}>Details</Text>
            </Pressable>
          </View>
          <View style={styles.earningsRow}>
            <EarningsCell label="Today" value={earnings.today} accent={colors.success} />
            <EarningsCell label="Week" value={earnings.week} accent={colors.text} />
            <EarningsCell label="Month" value={earnings.month} accent={colors.text} />
            <EarningsCell label="All-time" value={earnings.all_time} accent={colors.brand} />
          </View>
          <Text style={styles.subtleText}>
            {earnings.completed_count} completed deliver{earnings.completed_count === 1 ? "y" : "ies"}
          </Text>
        </View>

        {/* --- Section 2: Fleet Summary --- */}
        <View style={styles.card} testID="section-fleet">
          <View style={styles.cardHeadRow}>
            <View style={styles.cardHeadLeft}>
              <View style={[styles.cardIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="car-sport" size={18} color={colors.info} />
              </View>
              <Text style={styles.cardTitle}>Fleet Summary</Text>
            </View>
            <Pressable onPress={() => router.push("/(driver)/fleet")}>
              <Text style={styles.link}>Manage</Text>
            </Pressable>
          </View>
          {fleet.count === 0 ? (
            <Pressable style={styles.emptyRow} onPress={() => router.push("/(driver)/fleet")}>
              <Ionicons name="add-circle" size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyRowTitle}>Register your first vehicle</Text>
                <Text style={styles.emptyRowSub}>Drivers must have at least one vehicle to accept jobs.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          ) : (
            <>
              <View style={styles.miniStatRow}>
                <MiniStat label="Vehicles" value={String(fleet.count)} />
                <MiniStat label="Active" value={String(fleet.active_count)} accent={colors.success} />
                <MiniStat label="Capabilities" value={String(fleet.capabilities.length)} />
              </View>
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {fleet.vehicles.slice(0, 3).map((v) => (
                  <View key={v.id} style={styles.vehRow} testID={`fleet-veh-${v.id}`}>
                    <Ionicons name="car" size={18} color={colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vehName} numberOfLines={1}>
                        {v.vehicle_type_name || "Vehicle"}
                        {v.is_default ? " · Default" : ""}
                      </Text>
                      <Text style={styles.vehSub}>{v.registration || "—"}</Text>
                    </View>
                    <View style={[styles.statusPill, {
                      backgroundColor: v.status === "active" ? colors.successBg : colors.warningBg,
                    }]}>
                      <Text style={[styles.statusPillText, {
                        color: v.status === "active" ? colors.success : colors.warning,
                      }]}>
                        {v.status || "—"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* --- Section 3: Upcoming Jobs --- */}
        <View style={styles.card} testID="section-upcoming">
          <View style={styles.cardHeadRow}>
            <View style={styles.cardHeadLeft}>
              <View style={[styles.cardIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="calendar" size={18} color={colors.warning} />
              </View>
              <Text style={styles.cardTitle}>Upcoming Jobs</Text>
            </View>
            <Pressable onPress={() => router.push("/(driver)/my-jobs")}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          </View>
          {jobs.upcoming_count === 0 ? (
            <View style={styles.subtleBox}>
              <Ionicons name="calendar-outline" size={22} color={colors.textTertiary} />
              <Text style={styles.subtleText}>No confirmed pickups yet.</Text>
              <Pressable onPress={() => router.push("/(driver)/jobs")} style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>Find jobs</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.brand} />
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {jobs.upcoming.slice(0, 3).map((j) => (
                <Pressable
                  key={j.id}
                  style={styles.jobRow}
                  onPress={() => router.push(`/(driver)/booking/${j.id}`)}
                  testID={`upcoming-${j.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobRowTitle} numberOfLines={1}>{j.title || "Booking"}</Text>
                    <Text style={styles.jobRowSub} numberOfLines={1}>
                      {j.pickup_town} → {j.dropoff_town}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.jobRowPrice}>
                      £{Number(j.driver_charge || j.total_price || 0).toFixed(0)}
                    </Text>
                    <Text style={styles.jobRowStatus}>{j.status?.replace(/_/g, " ")}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* --- Section 4: Active Bids --- */}
        <View style={styles.card} testID="section-bids">
          <View style={styles.cardHeadRow}>
            <View style={styles.cardHeadLeft}>
              <View style={[styles.cardIcon, { backgroundColor: "#F3E8FF" }]}>
                <Ionicons name="pricetag" size={18} color="#7C3AED" />
              </View>
              <Text style={styles.cardTitle}>Active Bids</Text>
            </View>
            <Pressable onPress={() => router.push("/(driver)/jobs")}>
              <Text style={styles.link}>Browse jobs</Text>
            </Pressable>
          </View>
          <View style={styles.miniStatRow}>
            <MiniStat label="Pending" value={String(bids.active)} accent={bids.active > 0 ? colors.warning : colors.textSecondary} />
            <MiniStat label="Accepted" value={String(bids.accepted)} accent={colors.success} />
            <MiniStat label="Nearby jobs" value={String(jobs.nearby_count)} accent={colors.brand} />
          </View>
        </View>

        {/* --- Section 5: Rating --- */}
        <View style={styles.card} testID="section-rating">
          <View style={styles.cardHeadRow}>
            <View style={styles.cardHeadLeft}>
              <View style={[styles.cardIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="star" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.cardTitle}>Rating</Text>
            </View>
            <Pressable onPress={() => router.push("/(driver)/profile")}>
              <Text style={styles.link}>Profile</Text>
            </Pressable>
          </View>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingBig}>{rating.toFixed(2)}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.starsRow}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Ionicons
                    key={i}
                    name={i < Math.round(rating) ? "star" : "star-outline"}
                    size={16}
                    color="#F59E0B"
                  />
                ))}
              </View>
              <Text style={styles.subtleText}>
                Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </View>

        {/* --- Section 6: Verification / Vehicle Status --- */}
        <View style={styles.card} testID="section-verification">
          <View style={styles.cardHeadRow}>
            <View style={styles.cardHeadLeft}>
              <View style={[
                styles.cardIcon,
                { backgroundColor: verify.docs_rejected > 0 ? "#FEE2E2" : "#DCFCE7" },
              ]}>
                <Ionicons
                  name={verify.docs_rejected > 0 ? "close-circle" : "shield-checkmark"}
                  size={18}
                  color={verify.docs_rejected > 0 ? colors.brand : colors.success}
                />
              </View>
              <Text style={styles.cardTitle}>Vehicle & Document Status</Text>
            </View>
            <Pressable onPress={() => router.push("/(driver)/documents")}>
              <Text style={styles.link}>Documents</Text>
            </Pressable>
          </View>
          <View style={styles.miniStatRow}>
            <MiniStat label="Verified" value={String(verify.docs_verified)} accent={colors.success} />
            <MiniStat label="Pending" value={String(verify.docs_pending)} accent={colors.warning} />
            <MiniStat label="Rejected" value={String(verify.docs_rejected)} accent={colors.brand} />
          </View>
          <Text style={styles.subtleText}>
            Account: {verify.account_status || "—"}
          </Text>
        </View>

        {loading && (
          <View style={{ padding: spacing.lg, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        )}
      </ScrollView>

      <GlobalSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope="all"
        placeholder="Search jobs, categories, vehicles…"
      />
    </View>
  );
}

function EarningsCell({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={styles.earnCell}>
      <Text style={[styles.earnValue, { color: accent }]}>£{value.toFixed(0)}</Text>
      <Text style={styles.earnLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniValue, { color: accent || colors.text }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.bgDark,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  greeting: { color: "#fff", fontSize: font.xxl, fontWeight: weight.bold, letterSpacing: -0.4 },
  slogan: { color: "rgba(255,255,255,0.6)", fontSize: font.base, marginTop: 2 },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: spacing.md,
    paddingVertical: 6, borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: font.sm, fontWeight: weight.semibold },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  warningCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    backgroundColor: "#FFFBEB", borderRadius: radius.md, borderWidth: 1, borderColor: "#FDE68A",
  },
  warningTitle: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  warningText: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },

  card: {
    padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md,
  },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeadLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  link: { color: colors.brand, fontWeight: weight.semibold, fontSize: font.sm },
  subtleText: { fontSize: font.sm, color: colors.textSecondary },

  earningsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  earnCell: {
    flexBasis: "22%", flexGrow: 1, backgroundColor: colors.bgSecondary,
    borderRadius: radius.md, padding: spacing.md, alignItems: "flex-start", minWidth: 70,
  },
  earnValue: { fontSize: 20, fontWeight: weight.bold, letterSpacing: -0.4 },
  earnLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: weight.medium, marginTop: 4, letterSpacing: 0.6, textTransform: "uppercase" },

  miniStatRow: { flexDirection: "row", gap: spacing.sm },
  miniStat: {
    flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    padding: spacing.md, alignItems: "flex-start",
  },
  miniValue: { fontSize: 20, fontWeight: weight.bold, letterSpacing: -0.4 },
  miniLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: weight.medium, marginTop: 4, letterSpacing: 0.6, textTransform: "uppercase" },

  emptyRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md,
  },
  emptyRowTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  emptyRowSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },

  vehRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.sm,
  },
  vehName: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  vehSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  statusPillText: { fontSize: 10, fontWeight: weight.bold, letterSpacing: 0.4, textTransform: "uppercase" },

  subtleBox: {
    alignItems: "center", padding: spacing.md, gap: spacing.xs,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
  },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  linkBtnText: { color: colors.brand, fontWeight: weight.bold, fontSize: font.sm },

  jobRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bgSecondary,
  },
  jobRowTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  jobRowSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  jobRowPrice: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  jobRowStatus: { fontSize: 10, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  ratingBig: { fontSize: 40, fontWeight: weight.bold, color: colors.text, letterSpacing: -1 },
  starsRow: { flexDirection: "row", gap: 2 },
});
