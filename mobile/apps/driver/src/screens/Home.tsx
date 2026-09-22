/**
 * HomeScreen — Cargo One Driver dashboard.
 *
 * Ported from the web dashboard (frontend/src/pages/portal/driver/Dashboard.jsx)
 * feature-for-feature. Renders these seven cards in this order:
 *
 *   1. Earnings           (today / week / month / all-time + completed count)
 *   2. Fleet summary      (empty CTA when 0 vehicles, else top-3 rows)
 *   3. Messages           (unread badge + chime toggle + chime test)
 *   4. Upcoming Jobs      (top-3 upcoming bookings from dashboard.jobs.upcoming)
 *   5. Bids               (active + accepted + nearby)
 *   6. Rating             (rating out of 5 + review count)
 *   7. Verification       (verified/pending/rejected doc counts + account status)
 *
 * Plus, above the cards, the three exclusive account-state banners:
 *   • pending             → yellow "Account under review" CTA to Documents
 *   • changes_requested   → red "Admin has requested changes" + reason + doc types + upload + resubmit
 *   • suspended           → red "Account suspended" contact-support banner
 *
 * All navigation targets already exist in RootStackParamList (see App.tsx);
 * placeholder screens are wired now so future P0-d / P1-* implementations
 * only replace the target screens — this file will not need to change.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bell,
  Calendar,
  ChevronRight,
  MessagesSquare,
  Search,
  Star,
  ShieldCheck,
  Tag as TagIcon,
  Truck,
  UploadCloud,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react-native";
import { DriverAPI, type DriverDashboard } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { useShellMenu } from "../components/AppShell";
import { useMessageChime } from "../hooks/useMessageChime";
import { useNotificationChime } from "../hooks/useNotificationChime";
import { colors, radius, typography } from "../theme";
import { Page } from "../ui";
import type { RootStackParamList } from "../App";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const money0 = (n: number | null | undefined) =>
  `£${Number(n || 0).toFixed(0)}`;

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { user, refresh } = useAuth();
  const { openDrawer, showMenu } = useShellMenu();
  const [dash, setDash] = useState<DriverDashboard>({});
  const [refreshing, setRefreshing] = useState(false);
  const msgChime = useMessageChime({ enabled: true });
  const notifChime = useNotificationChime({ enabled: true });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await DriverAPI.dashboard().catch(() => ({} as DriverDashboard));
      setDash(d || {});
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const status = user?.status || "";
  const pending = status === "pending";
  const changesRequested = status === "changes_requested";
  const suspended = status === "suspended";

  // Same fallbacks as web Dashboard.jsx lines 81-89.
  const earnings = dash.earnings || {
    today: 0, week: 0, month: 0, all_time: 0, completed_count: 0,
  };
  const bids = dash.bids || { active: 0, accepted: 0 };
  const fleet = dash.fleet || {
    count: 0, active_count: 0, capabilities: [], vehicles: [],
  };
  const jobs = dash.jobs || {
    nearby_count: 0, active_count: 0, upcoming_count: 0, upcoming: [],
  };
  const verify = dash.verification || {
    docs_verified: 0, docs_pending: 0, docs_rejected: 0, account_status: undefined,
  };
  const rating = dash.user?.rating ?? user?.rating ?? 5;
  const reviewCount = dash.user?.review_count ?? 0;
  const changesReason =
    user?.changes_requested_reason || dash.user?.changes_requested_reason || null;
  const changesDocTypes =
    user?.changes_requested_doc_types || dash.user?.changes_requested_doc_types || [];

  const statusText = suspended
    ? "Account suspended — contact support"
    : changesRequested
    ? "Action required — see below"
    : pending
    ? "Complete verification to earn"
    : "Ready to earn today?";
  const statusDotColor = suspended || changesRequested
    ? "#DC2626"
    : pending
    ? "#F59E0B"
    : "#16A34A";
  const statusLabel = suspended
    ? "Suspended"
    : changesRequested
    ? "Action needed"
    : pending
    ? "Pending"
    : "Online";

  const onResubmit = useCallback(async () => {
    try {
      await DriverAPI.resubmitVerification();
      await Promise.all([load(), refresh()]);
    } catch {
      /* silent — mirrors web */
    }
  }, [load, refresh]);

  const firstName = (user?.name || "").split(" ")[0] || "there";

  return (
    <Page testID="driver-home">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Dark header — matches web bg-[#111111] */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {showMenu ? (
              <Pressable
                onPress={openDrawer}
                style={styles.headerIcon}
                testID="driver-open-drawer"
                accessibilityLabel="Open menu"
              >
                <Text style={styles.headerMenuText}>≡</Text>
              </Pressable>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Hi {firstName}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {statusText}
              </Text>
            </View>
            <Pressable
              onPress={() => nav.navigate("AvailableJobs")}
              style={styles.headerIcon}
              testID="driver-search-open"
              accessibilityLabel="Search"
            >
              <Search size={18} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() =>
                nav.navigate("Notifications")
              }
              style={styles.headerIcon}
              testID="driver-notifications-button"
              accessibilityLabel="Notifications"
            >
              <Bell size={18} color="#FFFFFF" strokeWidth={2} />
              {notifChime.unread > 0 ? (
                <View style={styles.headerBadge} testID="driver-notifications-badge">
                  <Text style={styles.headerBadgeText}>
                    {notifChime.unread > 99 ? "99+" : notifChime.unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <View style={styles.statusPill}>
              <View
                style={[styles.statusDot, { backgroundColor: statusDotColor }]}
              />
              <Text style={styles.statusPillText}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
          {/* Account-state banners */}
          {pending ? (
            <Pressable
              onPress={() =>
                nav.navigate("Documents")
              }
              style={styles.pendingBanner}
              testID="driver-warning-card"
            >
              <AlertTriangle size={24} color="#F59E0B" strokeWidth={2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.pendingTitle}>Account under review</Text>
                <Text style={styles.pendingBody}>
                  Upload driving licence, insurance, ID and vehicle photos to start receiving jobs.
                </Text>
              </View>
              <ChevronRight size={16} color="#9CA3AF" />
            </Pressable>
          ) : null}

          {changesRequested ? (
            <View style={styles.changesCard} testID="driver-changes-card">
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <AlertTriangle size={20} color="#DC2626" strokeWidth={2} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.changesTitle}>Admin has requested changes</Text>
                  {changesReason ? (
                    <Text style={styles.changesBody} testID="driver-changes-reason">
                      {changesReason}
                    </Text>
                  ) : null}
                  {changesDocTypes.length > 0 ? (
                    <Text style={styles.changesBody} testID="driver-changes-doctypes">
                      Please re-upload: {changesDocTypes.map((k) => k.replace(/_/g, " ")).join(", ")}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={() =>
                    nav.navigate("Documents")
                  }
                  style={styles.changesUploadBtn}
                  testID="driver-changes-upload"
                >
                  <UploadCloud size={14} color="#FFFFFF" />
                  <Text style={styles.changesUploadBtnText}>Update documents</Text>
                </Pressable>
                <Pressable
                  onPress={onResubmit}
                  style={styles.changesResubmitBtn}
                  testID="driver-changes-resubmit"
                >
                  <Text style={styles.changesResubmitBtnText}>Re-submit for review</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {suspended ? (
            <View style={styles.suspendedCard} testID="driver-suspended-card">
              <Ban size={20} color="#DC2626" strokeWidth={2} />
              <View>
                <Text style={styles.changesTitle}>Account suspended</Text>
                <Text style={styles.changesBody}>
                  Contact support if you believe this is a mistake.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Earnings */}
          <DashCard
            Icon={Wallet}
            iconBg="#FEE2E2"
            iconColor="#D62828"
            title="Earnings"
            rightLabel="Details"
            onRightPress={() => nav.navigate("Earnings")}
            testID="section-earnings"
          >
            <View style={styles.earnGrid}>
              <EarnCell label="Today" value={earnings.today} accent="#16A34A" />
              <EarnCell label="Week" value={earnings.week} />
              <EarnCell label="Month" value={earnings.month} />
              <EarnCell label="All-time" value={earnings.all_time} accent="#D62828" />
            </View>
            <Text style={styles.cardFootnote}>
              {earnings.completed_count} completed deliver
              {earnings.completed_count === 1 ? "y" : "ies"}
            </Text>
          </DashCard>

          {/* Fleet */}
          <DashCard
            Icon={Truck}
            iconBg="#DBEAFE"
            iconColor="#2563EB"
            title="Fleet Summary"
            rightLabel="Manage"
            onRightPress={() => nav.navigate("Fleet")}
            testID="section-fleet"
          >
            {(fleet.count ?? 0) === 0 ? (
              <Pressable
                onPress={() => nav.navigate("Fleet")}
                style={styles.fleetEmpty}
                testID="fleet-empty-cta"
              >
                <Text style={styles.fleetEmptyPlus}>＋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fleetEmptyTitle}>Register your first vehicle</Text>
                  <Text style={styles.fleetEmptyBody}>
                    Drivers must have at least one vehicle to accept jobs.
                  </Text>
                </View>
                <ChevronRight size={16} color="#9CA3AF" />
              </Pressable>
            ) : (
              <>
                <View style={styles.miniGrid}>
                  <MiniStat label="Vehicles" value={String(fleet.count)} />
                  <MiniStat label="Active" value={String(fleet.active_count)} accent="#16A34A" />
                  <MiniStat label="Capabilities" value={String((fleet.capabilities || []).length)} />
                </View>
                <View style={{ marginTop: 12, gap: 8 }}>
                  {(fleet.vehicles || []).slice(0, 3).map((v) => (
                    <View
                      key={v.id}
                      style={styles.fleetRow}
                      testID={`fleet-veh-${v.id}`}
                    >
                      <Truck size={18} color="#6B7280" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.fleetRowTitle} numberOfLines={1}>
                          {v.vehicle_type_name || "Vehicle"}
                          {v.is_default ? " · Default" : ""}
                        </Text>
                        <Text style={styles.fleetRowSub} numberOfLines={1}>
                          {v.registration || "—"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.vehicleStatus,
                          v.status === "active"
                            ? { backgroundColor: "#DCFCE7" }
                            : { backgroundColor: "#FEF3C7" },
                        ]}
                      >
                        <Text
                          style={{
                            color: v.status === "active" ? "#16A34A" : "#B45309",
                            fontSize: 10,
                            fontWeight: "700",
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                          }}
                        >
                          {v.status || "—"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </DashCard>

          {/* Messages + chime */}
          <DashCard
            Icon={MessagesSquare}
            iconBg="#FFF7ED"
            iconColor="#FF6A00"
            title="Messages"
            rightLabel="Open inbox"
            onRightPress={() => nav.navigate("MyJobs")}
            testID="section-messages"
          >
            {msgChime.unread > 0 ? (
              <View style={styles.msgUnreadCard} testID="driver-messages-unread-card">
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.msgUnreadTitle}>
                    {msgChime.unread} new {msgChime.unread === 1 ? "message" : "messages"}
                  </Text>
                  <Text style={styles.msgUnreadBody}>
                    Open the booking to reply — reading a conversation marks it read.
                  </Text>
                </View>
                <View style={styles.msgUnreadBadge} testID="driver-messages-unread-badge">
                  <Text style={styles.msgUnreadBadgeText}>
                    {msgChime.unread > 99 ? "99+" : msgChime.unread}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.msgEmpty} testID="driver-messages-empty">
                <MessagesSquare size={24} color="#9CA3AF" />
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                  No unread messages.
                </Text>
              </View>
            )}

            {/* Chime toggle row */}
            <View style={styles.chimeRow} testID="driver-chime-row">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                {msgChime.enabled ? (
                  <Volume2 size={16} color="#16A34A" />
                ) : (
                  <VolumeX size={16} color="#6B7280" />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.chimeTitle}>New-message chime</Text>
                  <Text style={styles.chimeBody}>
                    {msgChime.enabled
                      ? "Buzzes when a customer replies."
                      : "Muted — you'll still see the badge."}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={msgChime.test}
                style={styles.chimeTestBtn}
                testID="driver-chime-test"
                accessibilityLabel="Test chime"
              >
                <Text style={styles.chimeTestBtnText}>Test</Text>
              </Pressable>
              <Switch
                value={msgChime.enabled}
                onValueChange={msgChime.setEnabled}
                trackColor={{ true: "#16A34A", false: "#E5E7EB" }}
                thumbColor={"#FFFFFF"}
                testID="driver-chime-toggle"
                accessibilityRole="switch"
              />
            </View>
          </DashCard>

          {/* Upcoming Jobs */}
          <DashCard
            Icon={Calendar}
            iconBg="#FEF3C7"
            iconColor="#F59E0B"
            title="Upcoming Jobs"
            rightLabel="See all"
            onRightPress={() => nav.navigate("MyJobs")}
            testID="section-upcoming"
          >
            {(jobs.upcoming_count ?? 0) === 0 ? (
              <View style={styles.emptyBox} testID="upcoming-empty">
                <Calendar size={24} color="#9CA3AF" />
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                  No confirmed pickups yet.
                </Text>
                <Pressable
                  onPress={() => nav.navigate("AvailableJobs")}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}
                  testID="upcoming-find-jobs"
                >
                  <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 13 }}>
                    Find jobs
                  </Text>
                  <ArrowRight size={14} color={colors.brand} />
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {(jobs.upcoming || []).slice(0, 3).map((j: any) => (
                  <Pressable
                    key={j.id}
                    onPress={() => nav.navigate("ActiveBooking", { bookingId: j.id })}
                    style={styles.upcomingRow}
                    testID={`upcoming-${j.id}`}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.upcomingTitle} numberOfLines={1}>
                        {j.title || "Booking"}
                      </Text>
                      <Text style={styles.upcomingSub} numberOfLines={1}>
                        {j.pickup_town} → {j.dropoff_town}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.upcomingPrice}>
                        {money0(j.driver_charge ?? j.total_price)}
                      </Text>
                      <Text style={styles.upcomingStatus}>
                        {(j.status || "").replace(/_/g, " ")}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </DashCard>

          {/* Bids */}
          <DashCard
            Icon={TagIcon}
            iconBg="#F3E8FF"
            iconColor="#7C3AED"
            title="Active Bids"
            rightLabel="Browse jobs"
            onRightPress={() => nav.navigate("AvailableJobs")}
            testID="section-bids"
          >
            <View style={styles.miniGrid}>
              <MiniStat
                label="Pending"
                value={String(bids.active ?? 0)}
                accent={(bids.active ?? 0) > 0 ? "#F59E0B" : "#6B7280"}
              />
              <MiniStat label="Accepted" value={String(bids.accepted ?? 0)} accent="#16A34A" />
              <MiniStat label="Nearby jobs" value={String(jobs.nearby_count ?? 0)} accent="#D62828" />
            </View>
          </DashCard>

          {/* Rating */}
          <DashCard
            Icon={Star}
            iconBg="#FEF3C7"
            iconColor="#F59E0B"
            title="Rating"
            rightLabel="Profile"
            onRightPress={() => nav.navigate("Profile")}
            testID="section-rating"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Text style={styles.ratingBig}>{Number(rating).toFixed(2)}</Text>
              <View>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      size={16}
                      strokeWidth={2}
                      color={i < Math.round(rating) ? "#F59E0B" : "#E5E7EB"}
                      fill={i < Math.round(rating) ? "#F59E0B" : "transparent"}
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </DashCard>

          {/* Verification */}
          <DashCard
            Icon={ShieldCheck}
            iconBg={(verify.docs_rejected ?? 0) > 0 ? "#FEE2E2" : "#DCFCE7"}
            iconColor={(verify.docs_rejected ?? 0) > 0 ? "#D62828" : "#16A34A"}
            title="Vehicle & Document Status"
            rightLabel="Documents"
            onRightPress={() =>
              nav.navigate("Documents")
            }
            testID="section-verification"
          >
            <View style={styles.miniGrid}>
              <MiniStat label="Verified" value={String(verify.docs_verified ?? 0)} accent="#16A34A" />
              <MiniStat label="Pending" value={String(verify.docs_pending ?? 0)} accent="#F59E0B" />
              <MiniStat label="Rejected" value={String(verify.docs_rejected ?? 0)} accent="#D62828" />
            </View>
            <Text style={styles.cardFootnote}>
              Account: {verify.account_status || user?.status || "—"}
            </Text>
          </DashCard>
        </View>
      </ScrollView>
    </Page>
  );
}

/* ── Local sub-components (kept in-file to stay Home-only scoped) ─── */

function DashCard({
  Icon,
  iconBg,
  iconColor,
  title,
  rightLabel,
  onRightPress,
  children,
  testID,
}: {
  Icon: any;
  iconBg: string;
  iconColor: string;
  title: string;
  rightLabel?: string;
  onRightPress?: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={[
              styles.cardIcon,
              { backgroundColor: iconBg },
            ]}
          >
            <Icon size={16} color={iconColor} strokeWidth={2.2} />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {onRightPress && rightLabel ? (
          <Pressable onPress={onRightPress} hitSlop={6}>
            <Text style={styles.cardRight}>{rightLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EarnCell({
  label,
  value,
  accent = "#111111",
}: {
  label: string;
  value: number | null | undefined;
  accent?: string;
}) {
  return (
    <View style={styles.earnCell}>
      <Text style={[styles.earnCellValue, { color: accent }]}>{money0(value)}</Text>
      <Text style={styles.earnCellLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({
  label,
  value,
  accent = "#111111",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.earnCell}>
      <Text style={[styles.earnCellValue, { color: accent }]}>{value}</Text>
      <Text style={styles.earnCellLabel}>{label}</Text>
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#111111",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  headerMenuText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  headerBadge: {
    position: "absolute", top: -2, right: -2,
    minWidth: 20, height: 20, borderRadius: 999,
    backgroundColor: "#D62828",
    paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center",
  },
  headerBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  pendingBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  pendingTitle: { fontSize: 15, fontWeight: "700", color: "#111111" },
  pendingBody: { fontSize: 13, color: "#78350F", marginTop: 2 },

  changesCard: {
    padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  changesTitle: { fontSize: 15, fontWeight: "700", color: "#111111" },
  changesBody: { fontSize: 13, color: "#78350F", marginTop: 2 },
  changesUploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#D62828",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
  },
  changesUploadBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  changesResubmitBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: "#DC2626",
  },
  changesResubmitBtnText: { color: "#DC2626", fontSize: 13, fontWeight: "700" },

  suspendedCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },

  card: {
    borderRadius: 14,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111111" },
  cardRight: { fontSize: 13, fontWeight: "700", color: "#D62828" },
  cardFootnote: { fontSize: 12, color: "#6B7280", marginTop: 12 },

  earnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  miniGrid: { flexDirection: "row", gap: 8 },
  earnCell: {
    flex: 1, minWidth: "22%",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    padding: 12,
  },
  earnCellValue: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  earnCellLabel: {
    fontSize: 10, fontWeight: "700",
    letterSpacing: 0.6,
    color: "#6B7280",
    marginTop: 4,
    textTransform: "uppercase",
  },

  fleetEmpty: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  fleetEmptyPlus: { color: "#D62828", fontSize: 22, fontWeight: "700" },
  fleetEmptyTitle: { fontSize: 14, fontWeight: "600", color: "#111111" },
  fleetEmptyBody: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  fleetRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  fleetRowTitle: { fontSize: 14, fontWeight: "600", color: "#111111" },
  fleetRowSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  vehicleStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },

  msgUnreadCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10,
    backgroundColor: "#FEF3C7",
  },
  msgUnreadTitle: { fontSize: 14, fontWeight: "600", color: "#111111" },
  msgUnreadBody: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  msgUnreadBadge: {
    minWidth: 28, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, backgroundColor: "#D62828",
    alignItems: "center", justifyContent: "center",
  },
  msgUnreadBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  msgEmpty: {
    padding: 16, borderRadius: 10,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },

  chimeRow: {
    marginTop: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  chimeTitle: { fontSize: 13, fontWeight: "600", color: "#111111" },
  chimeBody: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  chimeTestBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  chimeTestBtnText: { fontSize: 11, fontWeight: "700", color: "#6B7280" },

  emptyBox: {
    padding: 16, borderRadius: 10,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },

  upcomingRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  upcomingTitle: { fontSize: 14, fontWeight: "600", color: "#111111" },
  upcomingSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  upcomingPrice: { fontSize: 16, fontWeight: "700", color: "#111111" },
  upcomingStatus: {
    fontSize: 10, letterSpacing: 0.6,
    color: "#6B7280", textTransform: "uppercase",
    marginTop: 2,
  },

  ratingBig: {
    fontSize: 42, fontWeight: "700",
    color: "#111111", letterSpacing: -0.5,
    lineHeight: 42,
  },
});
