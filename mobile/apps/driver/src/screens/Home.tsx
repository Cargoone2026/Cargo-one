/**
 * CargoOne Driver — Home / Dashboard.
 *
 * Faithful mobile adaptation of the web driver dashboard
 * (frontend/src/pages/portal/driver/Dashboard.jsx).
 *
 * Same data source: GET /driver/dashboard via DriverAPI.dashboard().
 * Same cards, wording, spacing, colours and conditional banners.
 * Pull-to-refresh replaces the desktop "Refreshing…" indicator.
 *
 * Phase 2 deferrals (visible but stubbed):
 *   • Global search icon in the header — web-only feature, omitted.
 *   • Notifications bell — visible; tap shows a placeholder toast
 *     until the Notifications phase.
 *   • New-message chime toggle — hidden. The message unread badge is
 *     shown, sourced from /messages/unread-count (already in core).
 *   • Card `Details / Manage / See all` right-links — visible; tapping
 *     switches to the corresponding tab where a Phase 3 stub screen
 *     lives.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { DriverAPI, type DriverDashboard } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, spacing, typography } from "../theme";

type Nav = {
  navigate: (name: string, params?: any) => void;
  jumpTo?: (name: string, params?: any) => void;
};

export default function HomeScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();

  const [dash, setDash] = useState<DriverDashboard>({});
  const [msgUnread, setMsgUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, notes, mc] = await Promise.all([
        DriverAPI.dashboard().catch(() => ({} as DriverDashboard)),
        DriverAPI.listNotifications(),
        DriverAPI.messagesUnreadCount(),
      ]);
      setDash(d || {});
      const list = Array.isArray(notes) ? notes : [];
      setNotifUnread(list.filter((n: any) => !n?.read).length);
      setMsgUnread(mc?.total || 0);
    } catch (e: any) {
      setError(e?.message || "Couldn't refresh the dashboard.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const pending = user?.status === "pending";
  const changesRequested = user?.status === "changes_requested";
  const suspended = user?.status === "suspended";

  const earnings = dash.earnings || {};
  const bids = dash.bids || {};
  const fleet = dash.fleet || {};
  const jobs = dash.jobs || {};
  const verify = dash.verification || {};
  const rating = dash.user?.rating ?? (user as any)?.rating ?? 5;
  const reviewCount = dash.user?.review_count ?? 0;
  const changesReason =
    (user as any)?.changes_requested_reason ||
    dash?.user?.changes_requested_reason;
  const changesDocTypes =
    (user as any)?.changes_requested_doc_types ||
    dash?.user?.changes_requested_doc_types ||
    [];

  const resubmit = useCallback(async () => {
    try {
      await DriverAPI.resubmitVerification();
      await load();
      Alert.alert("Submitted", "Your account has been re-submitted for review.");
    } catch (e: any) {
      Alert.alert("Couldn't resubmit", e?.message || "Please try again shortly.");
    }
  }, [load]);

  const statusText = suspended
    ? "Account suspended — contact support"
    : changesRequested
    ? "Action required — see below"
    : pending
    ? "Complete verification to earn"
    : "Ready to earn today?";
  const statusDotColor = suspended || changesRequested
    ? colors.danger
    : pending
    ? colors.warning
    : colors.success;
  const statusLabel = suspended
    ? "Suspended"
    : changesRequested
    ? "Action needed"
    : pending
    ? "Pending"
    : "Online";

  const firstName = user?.name?.split(" ")[0] || "there";

  if (loading) {
    return (
      <View style={styles.bootRoot} testID="driver-home-loading">
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Dark header */}
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header} testID="driver-home-header">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.hi} numberOfLines={1}>
              Hi {firstName}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert("Notifications", "The notifications inbox arrives in a later phase.")
            }
            style={styles.headerButton}
            testID="driver-notifications-button"
            accessibilityLabel="Notifications"
          >
            <Text style={styles.headerButtonGlyph}>🔔</Text>
            {notifUnread > 0 ? (
              <View style={styles.headerBadge} testID="driver-notifications-badge">
                <Text style={styles.headerBadgeText}>
                  {notifUnread > 99 ? "99+" : String(notifUnread)}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        testID="driver-home"
      >
        {error ? (
          <View style={styles.errorBanner} testID="driver-home-error">
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {pending ? (
          <Pressable
            onPress={() => nav.navigate("Documents" as never)}
            style={({ pressed }) => [styles.warnCard, pressed && { backgroundColor: "#FEF3C7" }]}
            testID="driver-warning-card"
          >
            <Text style={styles.warnIcon}>⚠︎</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.warnTitle}>Account under review</Text>
              <Text style={styles.warnBody}>
                Upload driving licence, insurance, ID and vehicle photos to start receiving jobs.
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : null}

        {changesRequested ? (
          <View style={styles.changesCard} testID="driver-changes-card">
            <View style={styles.changesRow}>
              <Text style={[styles.warnIcon, { color: colors.danger }]}>⚠︎</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.warnTitle}>Admin has requested changes</Text>
                {changesReason ? (
                  <Text style={styles.changesBody}>{changesReason}</Text>
                ) : null}
                {changesDocTypes.length > 0 ? (
                  <Text style={styles.changesBody}>
                    Please re-upload: {changesDocTypes.map((k: string) => k.replace(/_/g, " ")).join(", ")}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.changesActions}>
              <Pressable
                onPress={() => nav.navigate("Documents" as never)}
                style={({ pressed }) => [
                  styles.pillBtnFilled,
                  pressed && { backgroundColor: colors.brandHover },
                ]}
                testID="driver-changes-upload"
              >
                <Text style={styles.pillBtnFilledText}>⤴  Update documents</Text>
              </Pressable>
              <Pressable
                onPress={resubmit}
                style={({ pressed }) => [
                  styles.pillBtnOutlined,
                  pressed && { backgroundColor: "#FEE2E2" },
                ]}
                testID="driver-changes-resubmit"
              >
                <Text style={styles.pillBtnOutlinedText}>Re-submit for review</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {suspended ? (
          <View style={styles.suspendedCard} testID="driver-suspended-card">
            <Text style={[styles.warnIcon, { color: colors.danger }]}>⛔︎</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.warnTitle}>Account suspended</Text>
              <Text style={styles.changesBody}>
                Contact support if you believe this is a mistake.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Earnings */}
        <Card
          testID="section-earnings"
          tintBg={colors.tintRedBg}
          tintFg={colors.tintRedFg}
          glyph="£"
          title="Earnings"
          rightLabel="Details"
          onRight={() => nav.navigate("Earnings" as never)}
        >
          <View style={styles.grid4}>
            <EarnCell label="Today" value={earnings.today} accent={colors.success} />
            <EarnCell label="Week" value={earnings.week} />
            <EarnCell label="Month" value={earnings.month} />
            <EarnCell label="All-time" value={earnings.all_time} accent={colors.brand} />
          </View>
          <Text style={styles.cardHint}>
            {earnings.completed_count || 0} completed deliver
            {earnings.completed_count === 1 ? "y" : "ies"}
          </Text>
        </Card>

        {/* Fleet */}
        <Card
          testID="section-fleet"
          tintBg={colors.tintBlueBg}
          tintFg={colors.tintBlueFg}
          glyph="🚚"
          title="Fleet Summary"
          rightLabel="Manage"
          onRight={() => nav.navigate("Fleet" as never)}
        >
          {!fleet.count ? (
            <Pressable
              onPress={() => nav.navigate("Fleet" as never)}
              style={({ pressed }) => [styles.emptyCta, pressed && { backgroundColor: colors.surfaceHover }]}
              testID="fleet-empty-cta"
            >
              <Text style={styles.emptyCtaPlus}>＋</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.emptyCtaTitle}>Register your first vehicle</Text>
                <Text style={styles.emptyCtaBody}>
                  Drivers must have at least one vehicle to accept jobs.
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.grid3}>
                <MiniStat label="Vehicles" value={String(fleet.count)} />
                <MiniStat label="Active" value={String(fleet.active_count || 0)} accent={colors.success} />
                <MiniStat label="Capabilities" value={String(fleet.capabilities?.length || 0)} />
              </View>
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {(fleet.vehicles || []).slice(0, 3).map((v: any) => (
                  <View key={v.id} style={styles.vehRow} testID={`fleet-veh-${v.id}`}>
                    <Text style={styles.vehIcon}>🚚</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.vehTitle} numberOfLines={1}>
                        {v.vehicle_type_name || "Vehicle"}
                        {v.is_default ? " · Default" : ""}
                      </Text>
                      <Text style={styles.vehSub} numberOfLines={1}>
                        {v.registration || "—"}
                      </Text>
                    </View>
                    <StatusChip status={v.status} />
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Messages — chime deferred; badge only */}
        <Card
          testID="section-messages"
          tintBg={colors.tintOrangeBg}
          tintFg={colors.tintOrangeFg}
          glyph="✉"
          title="Messages"
          rightLabel="Open inbox"
          onRight={() => nav.navigate("MyJobs" as never)}
        >
          {msgUnread > 0 ? (
            <View style={styles.unreadRow} testID="driver-messages-unread-card">
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.unreadTitle}>
                  {msgUnread} new {msgUnread === 1 ? "message" : "messages"}
                </Text>
                <Text style={styles.unreadBody}>
                  Open the booking to reply — reading a conversation marks it read.
                </Text>
              </View>
              <View style={styles.unreadBadge} testID="driver-messages-unread-badge">
                <Text style={styles.unreadBadgeText}>
                  {msgUnread > 99 ? "99+" : String(msgUnread)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCol} testID="driver-messages-empty">
              <Text style={styles.emptyGlyph}>✉</Text>
              <Text style={styles.emptyText}>No unread messages.</Text>
            </View>
          )}
        </Card>

        {/* Upcoming Jobs */}
        <Card
          testID="section-upcoming"
          tintBg={colors.tintAmberBg}
          tintFg={colors.tintAmberFg}
          glyph="📅"
          title="Upcoming Jobs"
          rightLabel="See all"
          onRight={() => nav.navigate("MyJobs" as never)}
        >
          {!jobs.upcoming_count ? (
            <View style={styles.emptyCol} testID="upcoming-empty">
              <Text style={styles.emptyGlyph}>📅</Text>
              <Text style={styles.emptyText}>No confirmed pickups yet.</Text>
              <Pressable onPress={() => nav.navigate("AvailableJobs" as never)}>
                <Text style={styles.emptyLink}>Find jobs →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {(jobs.upcoming || []).slice(0, 3).map((j: any) => (
                <Pressable
                  key={j.id}
                  onPress={() =>
                    Alert.alert(
                      "Job details",
                      "The booking detail screen ships in a later phase.",
                    )
                  }
                  style={({ pressed }) => [
                    styles.upcomingRow,
                    pressed && { backgroundColor: colors.surfaceHover },
                  ]}
                  testID={`upcoming-${j.id}`}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.upcomingTitle} numberOfLines={1}>
                      {j.title || "Booking"}
                    </Text>
                    <Text style={styles.upcomingRoute} numberOfLines={1}>
                      {j.pickup_town} → {j.dropoff_town}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.upcomingPrice}>
                      £{Number(j.driver_charge || j.total_price || 0).toFixed(0)}
                    </Text>
                    <Text style={styles.upcomingStatus}>
                      {(j.status || "").replace(/_/g, " ")}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        {/* Bids */}
        <Card
          testID="section-bids"
          tintBg={colors.tintPurpleBg}
          tintFg={colors.tintPurpleFg}
          glyph="🏷"
          title="Active Bids"
          rightLabel="Browse jobs"
          onRight={() => nav.navigate("AvailableJobs" as never)}
        >
          <View style={styles.grid3}>
            <MiniStat
              label="Pending"
              value={String(bids.active || 0)}
              accent={bids.active ? colors.warning : colors.textMuted}
            />
            <MiniStat label="Accepted" value={String(bids.accepted || 0)} accent={colors.success} />
            <MiniStat label="Nearby jobs" value={String(jobs.nearby_count || 0)} accent={colors.brand} />
          </View>
        </Card>

        {/* Rating */}
        <Card
          testID="section-rating"
          tintBg={colors.tintAmberBg}
          tintFg={colors.tintAmberFg}
          glyph="★"
          title="Rating"
          rightLabel="Profile"
          onRight={() => nav.navigate("Profile" as never)}
        >
          <View style={styles.ratingRow}>
            <Text style={styles.ratingValue}>{Number(rating).toFixed(2)}</Text>
            <View>
              <Text style={styles.ratingStars}>
                {"★".repeat(Math.round(rating))}
                <Text style={{ color: colors.border }}>{"★".repeat(5 - Math.round(rating))}</Text>
              </Text>
              <Text style={styles.ratingCount}>
                Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </Card>

        {/* Verification */}
        <Card
          testID="section-verification"
          tintBg={(verify.docs_rejected || 0) > 0 ? colors.tintRedBg : colors.tintGreenBg}
          tintFg={(verify.docs_rejected || 0) > 0 ? colors.tintRedFg : colors.tintGreenFg}
          glyph="✓"
          title="Vehicle & Document Status"
          rightLabel="Documents"
          onRight={() =>
            Alert.alert("Documents", "The documents screen ships in a later phase.")
          }
        >
          <View style={styles.grid3}>
            <MiniStat label="Verified" value={String(verify.docs_verified || 0)} accent={colors.success} />
            <MiniStat label="Pending" value={String(verify.docs_pending || 0)} accent={colors.warning} />
            <MiniStat label="Rejected" value={String(verify.docs_rejected || 0)} accent={colors.danger} />
          </View>
          <Text style={styles.cardHint}>
            Account: {verify.account_status || user?.status || "—"}
          </Text>
        </Card>

        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </View>
  );
}

/* -----------------------------------------------------------------------
 * Reusable dashboard building blocks (mirror the web helpers in
 * Dashboard.jsx: Card / EarnCell / MiniStat).
 * ----------------------------------------------------------------------- */

function Card({
  glyph,
  tintBg,
  tintFg,
  title,
  rightLabel,
  onRight,
  testID,
  children,
}: {
  glyph: string;
  tintBg: string;
  tintFg: string;
  title: string;
  rightLabel?: string;
  onRight?: () => void;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.iconRing, { backgroundColor: tintBg }]}>
            <Text style={[styles.iconRingGlyph, { color: tintFg }]}>{glyph}</Text>
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {rightLabel && onRight ? (
          <Pressable onPress={onRight} hitSlop={8}>
            <Text style={styles.cardLink}>{rightLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EarnCell({ label, value, accent = colors.text }: { label: string; value?: number; accent?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color: accent }]}>£{Number(value || 0).toFixed(0)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, accent = colors.text }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusChip({ status }: { status?: string }) {
  const on = status === "active";
  return (
    <View
      style={[
        styles.statusChip,
        { backgroundColor: on ? colors.tintGreenBg : colors.tintAmberBg },
      ]}
    >
      <Text
        style={[
          styles.statusChipText,
          { color: on ? colors.success : colors.amberText },
        ]}
      >
        {(status || "—").toUpperCase()}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bootRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  headerSafe: { backgroundColor: colors.header },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.header,
  },
  hi: { ...typography.headerName, color: colors.textOnDark },
  headerSub: { marginTop: 2, fontSize: 13, color: colors.textWhiteFaint },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.headerBtnBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonGlyph: { fontSize: 18, color: colors.textOnDark },
  headerBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    height: 18,
    minWidth: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: { fontSize: 10, fontWeight: "700", color: colors.textOnDark },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.headerBtnBg,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: "700", color: colors.textOnDark },

  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  errorBanner: {
    borderRadius: radius.card,
    backgroundColor: colors.bannerChangesBg,
    borderWidth: 1,
    borderColor: colors.bannerChangesBorder,
    padding: spacing.md,
  },
  errorBannerText: { color: colors.danger, ...typography.bodySm },

  /* Warning banners */
  warnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.bannerPendingBorder,
    backgroundColor: colors.bannerPendingBg,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  warnIcon: { fontSize: 22, color: colors.warning },
  warnTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  warnBody: { marginTop: 2, fontSize: 13, color: colors.darkAmberText, lineHeight: 18 },
  chevron: { fontSize: 20, color: colors.dividerLight },

  changesCard: {
    borderWidth: 1,
    borderColor: colors.bannerChangesBorder,
    backgroundColor: colors.bannerChangesBg,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  changesRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  changesBody: { marginTop: 2, fontSize: 13, color: colors.darkAmberText, lineHeight: 18 },
  changesActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  pillBtnFilled: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  pillBtnFilledText: { color: colors.textOnDark, fontSize: 13, fontWeight: "700" },
  pillBtnOutlined: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  pillBtnOutlinedText: { color: colors.danger, fontSize: 13, fontWeight: "700" },

  suspendedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.bannerChangesBorder,
    backgroundColor: colors.bannerChangesBg,
    borderRadius: radius.card,
    padding: spacing.lg,
  },

  /* Card */
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconRing: {
    width: 36,
    height: 36,
    borderRadius: radius.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  iconRingGlyph: { fontSize: 16, fontWeight: "700" },
  cardTitle: { ...typography.cardTitle, color: colors.text },
  cardLink: { fontSize: 13, fontWeight: "700", color: colors.brand },
  cardHint: { marginTop: spacing.md, fontSize: 12, color: colors.textMuted },

  /* Stats grid */
  grid3: { flexDirection: "row", gap: spacing.sm },
  grid4: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  statCell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    padding: spacing.md,
    minWidth: "22%",
  },
  statValue: { ...typography.statValue },
  statLabel: {
    marginTop: 4,
    ...typography.micro,
    textTransform: "uppercase",
    color: colors.textMuted,
  },

  /* Fleet — vehicle row */
  vehRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    padding: spacing.md,
  },
  vehIcon: { fontSize: 20 },
  vehTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  vehSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusChipText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  /* Fleet — empty CTA */
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    padding: spacing.md,
  },
  emptyCtaPlus: { fontSize: 20, fontWeight: "700", color: colors.brand },
  emptyCtaTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  emptyCtaBody: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  /* Messages */
  unreadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.tintAmberBg,
    borderRadius: radius.chip,
    padding: spacing.md,
  },
  unreadTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  unreadBody: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  unreadBadge: {
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { fontSize: 12, fontWeight: "700", color: colors.textOnDark },

  emptyCol: {
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    padding: spacing.lg,
  },
  emptyGlyph: { fontSize: 22, color: colors.dividerLight },
  emptyText: { fontSize: 13, color: colors.textMuted },
  emptyLink: { marginTop: 4, fontSize: 13, fontWeight: "700", color: colors.brand },

  /* Upcoming */
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    padding: spacing.md,
  },
  upcomingTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  upcomingRoute: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  upcomingPrice: { ...typography.jobPrice, color: colors.text },
  upcomingStatus: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },

  /* Rating */
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  ratingValue: { ...typography.ratingValue, color: colors.text },
  ratingStars: { fontSize: 16, color: colors.warning, letterSpacing: 2 },
  ratingCount: { marginTop: 4, fontSize: 12, color: colors.textMuted },
});
