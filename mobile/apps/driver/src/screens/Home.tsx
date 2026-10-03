/**
 * CargoOne Driver — Home / Dashboard (Phase 8 dark redesign).
 *
 * Approved visual source of truth:
 *   /app/memory/mockups/phase8_driver_home_v2_dark.html
 *
 * Information-architecture upgrade on top of the Phase 2B/2C baseline.
 * The Phase 2C-LOCKED `PageHeader` component in `../ui` is reused
 * verbatim — only its `title`/`subtitle`/`right` content is passed as
 * ReactNodes so the text renders in white on the new dark surface.
 * No change to `ui.tsx`, `AppShell.tsx`, `AuthContext.tsx`, or any
 * locked Phase 1-7 file.
 *
 * Scope rules (Phase 8 brief):
 *   • Dark Cargo One Driver content surface (#0A0A0A), elevated cards
 *     (#141414), inner surfaces (#1A1A1A). Primary CTA uses orange-red
 *     (#F97316 → #FB923C) matching the approved mockup.
 *   • Reuses existing `DriverAPI.dashboard / listNotifications /
 *     messagesUnreadCount / resubmitVerification` — no backend
 *     contract changes.
 *   • Fixes four "ships-in-a-later-phase" alerts that pointed to
 *     screens which already exist (`Documents`, `BookingDetail`).
 *   • No new deps. No native changes. No translateZ / matrix.
 *
 * New top-to-bottom order below the locked bar:
 *   A. (locked bar — PageHeader with hamburger + bell)
 *   B. Today / Earnings hero
 *   C. Status banners (pending / changes_requested / suspended)
 *   D. Next up
 *   E. Your bids
 *   F. Documents
 *   G. Fleet
 *   H. Rating + Messages (side-by-side)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { DriverAPI, type DriverDashboard } from "@cargoone/core";
import {
  Page,
  PageHeader,
  IconButton,
  Icon,
  PrimaryButton,
  colors,
  space,
} from "../ui";
import { useAuth } from "../AuthContext";

// Local Phase-8 dark palette. Not added to the shared theme so no
// other screen or locked phase is affected.
const DARK = {
  bg: "#0A0A0A",
  surface: "#141414",
  surface2: "#1A1A1A",
  surface3: "#0F0F0F",
  divider: "rgba(255,255,255,0.06)",
  dividerStrong: "rgba(255,255,255,0.10)",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.56)",
  textFaint: "rgba(255,255,255,0.34)",
  textDim: "rgba(255,255,255,0.72)",
  brand: colors.brand,            // #D62828
  cta: "#F97316",
  ctaHi: "#FB923C",
  success: "#10B981",
  successBg: "rgba(16,185,129,0.14)",
  warning: "#F59E0B",
  warningBg: "rgba(245,158,11,0.14)",
  info: "#3B82F6",
  purple: "#A78BFA",
  plate: "#F4C430",
};

const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTH_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

function todayLabel(d: Date = new Date()) {
  return `TODAY · ${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

function fmt0(n: unknown) {
  return Number(n || 0).toFixed(0);
}
function fmt2(n: unknown) {
  return Number(n || 0).toFixed(2);
}

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

  const firstName = user?.name?.split(" ")[0] || "there";
  const subtitle = suspended
    ? "Account suspended — contact support"
    : changesRequested
      ? "Action required — see below"
      : pending
        ? "Complete verification to earn"
        : "Ready to earn today?";

  const nextUp = useMemo(() => {
    const list = Array.isArray(jobs.upcoming) ? jobs.upcoming : [];
    return (list[0] as any) || null;
  }, [jobs.upcoming]);

  const activeVehicle = useMemo(() => {
    const list = Array.isArray(fleet.vehicles) ? fleet.vehicles : [];
    return list.find((v: any) => v?.is_default) || list[0] || null;
  }, [fleet.vehicles]);

  const bidsPending = Number(bids.active || 0);
  const bidsAccepted = Number(bids.accepted || 0);
  const bidsPlaced = bidsPending + bidsAccepted;
  const pendingPct =
    bidsPlaced > 0 ? Math.round((bidsPending / bidsPlaced) * 100) : 0;
  const acceptedPct = bidsPlaced > 0 ? 100 - pendingPct : 0;

  const docsVerified = Number(verify.docs_verified || 0);
  const docsPending = Number(verify.docs_pending || 0);
  const docsRejected = Number(verify.docs_rejected || 0);
  const docsTotal = Math.max(5, docsVerified + docsPending + docsRejected);
  const docSegments = Array.from({ length: docsTotal }).map((_, i) => {
    if (i < docsVerified) return "verified";
    if (i < docsVerified + docsPending) return "pending";
    if (i < docsVerified + docsPending + docsRejected) return "rejected";
    return "off";
  });

  const stars = Math.round(Number(rating) || 0);
  const today = new Date();
  const todayDow = today.getDay() === 0 ? 6 : today.getDay() - 1;

  // Header renderers — passed as JSX nodes so the title/subtitle text
  // renders white on the dark surface without modifying ui.tsx.
  const titleNode = (
    <Text style={styles.hdrTitle} testID="driver-home-title">
      {`Hi ${firstName}`}
    </Text>
  );
  const subtitleNode = (
    <Text style={styles.hdrSub} testID="driver-home-sub">
      {subtitle}
    </Text>
  );

  if (loading) {
    return (
      <Page testID="driver-home-loading" bg={DARK.bg}>
        <PageHeader title={titleNode} subtitle={subtitleNode} large />
      </Page>
    );
  }

  return (
    <Page
      testID="driver-home"
      bg={DARK.bg}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={DARK.cta}
        />
      }
    >
      <PageHeader
        title={titleNode}
        subtitle={subtitleNode}
        large
        right={
          <IconButton
            testID="driver-notifications-button"
            accessibilityLabel="Notifications"
            badged={notifUnread > 0}
            variant="ghost"
            onPress={() => nav.navigate("Notifications")}
          >
            <Icon name="bell" size={22} color={DARK.text} />
          </IconButton>
        }
      />

      <View style={styles.content}>
        {error ? (
          <View style={styles.errorBanner} testID="driver-home-error">
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* B. Today / Earnings hero -------------------------------- */}
        <View style={styles.card} testID="driver-status-hero">
          <View style={styles.rowBetween}>
            <Text style={styles.heroEyebrow}>{todayLabel(today)}</Text>
            <View style={[styles.chip, { backgroundColor: DARK.successBg }]} testID="driver-status-pill">
              <View style={[styles.chipDot, { backgroundColor: DARK.success }]} />
              <Text style={[styles.chipText, { color: DARK.success }]}>
                {suspended ? "Suspended" : changesRequested ? "Review" : pending ? "Pending" : "Online"}
              </Text>
            </View>
          </View>

          <View style={styles.heroAmountRow}>
            <Text style={styles.heroCur}>£</Text>
            <Text style={styles.heroBig}>{fmt0(earnings.today)}</Text>
            <Text style={styles.heroPence}>
              .{(fmt2(earnings.today).split(".")[1] || "00")}
            </Text>
          </View>
          <Text style={styles.heroCaption}>
            Earned today · {earnings.completed_count || 0} completed deliver
            {earnings.completed_count === 1 ? "y" : "ies"}
          </Text>

          <View style={styles.weekStrip}>
            <View style={styles.weekBars}>
              {WEEK_LETTERS.map((_, i) => (
                <View
                  key={`b${i}`}
                  style={[
                    styles.weekBar,
                    i === todayDow && styles.weekBarActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.weekLetters}>
              {WEEK_LETTERS.map((L, i) => (
                <Text
                  key={`l${i}`}
                  style={[
                    styles.weekLetter,
                    i === todayDow && styles.weekLetterActive,
                  ]}
                >
                  {L}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.wma}>
            <View style={styles.wmaCell}>
              <Text style={styles.wmaLabel}>WEEK</Text>
              <Text style={styles.wmaValue}>£{fmt2(earnings.week)}</Text>
            </View>
            <View style={styles.wmaCell}>
              <Text style={styles.wmaLabel}>MONTH</Text>
              <Text style={styles.wmaValue}>£{fmt2(earnings.month)}</Text>
            </View>
            <View style={styles.wmaCell}>
              <Text style={styles.wmaLabel}>ALL-TIME</Text>
              <Text style={styles.wmaValue}>£{fmt2(earnings.all_time)}</Text>
            </View>
          </View>

          {!suspended && !changesRequested && !pending ? (
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => nav.navigate("LiveMode")}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
                testID="driver-go-live-cta"
              >
                <Icon name="zap" size={18} color="#FFFFFF" />
                <Text style={styles.ctaText}>Open Live Mode</Text>
              </Pressable>
              <Pressable
                onPress={() => nav.navigate("Earnings")}
                style={({ pressed }) => [styles.ctaIcon, pressed && { opacity: 0.85 }]}
                accessibilityLabel="Open earnings details"
                testID="driver-earnings-details"
              >
                <Icon name="trending-up" size={20} color={DARK.text} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* C. Status banners --------------------------------------- */}
        {pending ? (
          <Pressable
            onPress={() => nav.navigate("Documents")}
            style={styles.bannerWarn}
            testID="driver-warning-card"
          >
            <Icon name="alert-triangle" size={22} color={DARK.warning} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bannerTitle}>Account under review</Text>
              <Text style={styles.bannerBody}>
                Upload driving licence, insurance, ID and vehicle photos to
                start receiving jobs.
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={DARK.textMuted} />
          </Pressable>
        ) : null}

        {changesRequested ? (
          <View
            style={[styles.bannerWarn, { borderColor: "rgba(220,38,38,0.3)" }]}
            testID="driver-changes-card"
          >
            <View style={styles.rowStart}>
              <Icon name="alert-triangle" size={22} color="#F87171" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.bannerTitle}>Admin has requested changes</Text>
                {changesReason ? (
                  <Text style={styles.bannerBody}>{changesReason}</Text>
                ) : null}
                {changesDocTypes.length > 0 ? (
                  <Text style={styles.bannerBody}>
                    Please re-upload:{" "}
                    {changesDocTypes
                      .map((k: string) => k.replace(/_/g, " "))
                      .join(", ")}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <PrimaryButton
                title="Update documents"
                onPress={() => nav.navigate("Documents")}
                testID="driver-changes-upload"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Re-submit"
                variant="danger"
                onPress={resubmit}
                testID="driver-changes-resubmit"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}

        {suspended ? (
          <View
            style={[styles.bannerWarn, { borderColor: "rgba(220,38,38,0.3)" }]}
            testID="driver-suspended-card"
          >
            <Icon name="slash" size={22} color="#F87171" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bannerTitle}>Account suspended</Text>
              <Text style={styles.bannerBody}>
                Contact support if you believe this is a mistake.
              </Text>
            </View>
          </View>
        ) : null}

        {/* D. Next up ---------------------------------------------- */}
        <View style={styles.card} testID="section-next-up">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Next up</Text>
            <Pressable
              onPress={() => nav.navigate("MyJobs")}
              hitSlop={8}
              testID="next-up-all-upcoming"
            >
              <Text style={styles.cardRightMuted}>All upcoming →</Text>
            </Pressable>
          </View>

          {!nextUp ? (
            <View style={styles.emptyBox} testID="next-up-empty">
              <Icon name="calendar" size={22} color={DARK.textFaint} />
              <Text style={styles.emptyText}>No confirmed pickups yet.</Text>
              <Pressable
                onPress={() => nav.navigate("AvailableJobs")}
                testID="next-up-find-jobs"
              >
                <Text style={styles.emptyLink}>Find jobs →</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                nav.navigate("BookingDetail", { bookingId: nextUp.id })
              }
              style={({ pressed }) => [
                styles.nextBox,
                pressed && { opacity: 0.9 },
              ]}
              testID={`next-up-${nextUp.id}`}
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {nextUp.title || "Booking"}
                  </Text>
                  {nextUp.payment_status === "paid" ? (
                    <View style={styles.nextPaid}>
                      <Icon name="check" size={14} color={DARK.success} />
                      <Text style={styles.nextPaidText}>Deposit paid</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.nextPrice}>
                  £{fmt0(nextUp.driver_charge || nextUp.total_price)}
                </Text>
              </View>

              <View style={styles.route}>
                <View style={styles.routeTrack} />
                <View style={styles.routeLeg}>
                  <View style={styles.pickupDot} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.routeKey}>PICKUP</Text>
                    <Text style={styles.routeValue} numberOfLines={1}>
                      {nextUp.pickup_town || "—"}
                    </Text>
                  </View>
                </View>
                <View style={styles.routeLeg}>
                  <View style={styles.dropDot} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.routeKey}>DROP-OFF</Text>
                    <Text style={styles.routeValue} numberOfLines={1}>
                      {nextUp.dropoff_town || "—"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.arrowBtn} testID="next-up-arrow">
                <Icon name="arrow-right" size={20} color={DARK.bg} />
              </View>
            </Pressable>
          )}
        </View>

        {/* E. Your bids -------------------------------------------- */}
        <View style={styles.card} testID="section-bids">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Your bids</Text>
            <Text style={styles.cardRightMuted}>{bidsPlaced} placed</Text>
          </View>
          <View style={styles.bidBar}>
            <View style={[styles.bidBarPending, { width: `${pendingPct}%` }]} />
            <View style={[styles.bidBarAccepted, { width: `${acceptedPct}%` }]} />
          </View>
          <View style={styles.row2}>
            <View style={styles.statCell}>
              <View style={styles.statCellTop}>
                <View style={[styles.statDot, { backgroundColor: DARK.warning }]} />
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <Text style={styles.statValue}>{bidsPending}</Text>
            </View>
            <View style={styles.statCell}>
              <View style={styles.statCellTop}>
                <View style={[styles.statDot, { backgroundColor: DARK.success }]} />
                <Text style={styles.statLabel}>Accepted</Text>
              </View>
              <Text style={styles.statValue}>{bidsAccepted}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => nav.navigate("AvailableJobs")}
            style={({ pressed }) => [styles.nearRow, pressed && { opacity: 0.9 }]}
            testID="driver-browse-jobs"
          >
            <Icon name="map-pin" size={16} color={DARK.textMuted} />
            <Text style={styles.nearText}>
              {jobs.nearby_count || 0} jobs near you
            </Text>
            <Text style={styles.nearAction}>Browse →</Text>
          </Pressable>
        </View>

        {/* F. Documents -------------------------------------------- */}
        <View style={styles.card} testID="section-documents">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Documents</Text>
            <View style={styles.rowStart}>
              <View style={[styles.chipDot, { backgroundColor: DARK.success }]} />
              <Text style={[styles.cardRightMuted, { color: DARK.success }]}>
                Account {verify.account_status || user?.status || "pending"}
              </Text>
            </View>
          </View>
          <View style={styles.docSummary}>
            <View style={styles.docIconBox}>
              <Icon name="shield" size={22} color={DARK.warning} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.docTitle}>
                {docsPending > 0
                  ? `${docsPending} document${docsPending === 1 ? "" : "s"} in review`
                  : docsRejected > 0
                    ? `${docsRejected} rejected`
                    : docsVerified > 0
                      ? `${docsVerified} verified`
                      : "No documents yet"}
              </Text>
              <Text style={styles.docSub}>
                {docsVerified} verified · {docsRejected} rejected
              </Text>
            </View>
          </View>
          <View style={styles.docSegRow}>
            {docSegments.map((kind, i) => (
              <View
                key={`seg${i}`}
                style={[
                  styles.docSeg,
                  kind === "verified" && { backgroundColor: DARK.success },
                  kind === "pending" && { backgroundColor: DARK.warning },
                  kind === "rejected" && { backgroundColor: DARK.brand },
                ]}
              />
            ))}
          </View>
          <Pressable
            onPress={() => nav.navigate("Documents")}
            hitSlop={6}
            testID="driver-manage-documents"
          >
            <Text style={styles.docManage}>Manage documents →</Text>
          </Pressable>
        </View>

        {/* G. Fleet ------------------------------------------------- */}
        <View style={styles.card} testID="section-fleet">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Fleet</Text>
            <Pressable
              onPress={() => nav.navigate("Fleet")}
              hitSlop={8}
              testID="fleet-manage"
            >
              <Text style={styles.cardRightMuted}>Manage →</Text>
            </Pressable>
          </View>
          {!fleet.count || !activeVehicle ? (
            <Pressable
              onPress={() => nav.navigate("Fleet")}
              style={({ pressed }) => [styles.fleetRow, pressed && { opacity: 0.9 }]}
              testID="fleet-empty-cta"
            >
              <View style={styles.fleetIcon}>
                <Icon name="plus" size={22} color={DARK.cta} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fleetTitle}>Register your first vehicle</Text>
                <Text style={styles.docSub}>
                  Drivers must have at least one vehicle to accept jobs.
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={DARK.textMuted} />
            </Pressable>
          ) : (
            <>
              <View style={styles.fleetRow} testID="fleet-active-row">
                <View style={styles.fleetIcon}>
                  <Icon name="truck" size={22} color={DARK.textDim} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fleetTitle}>
                    {activeVehicle.vehicle_type_name || "Vehicle"}
                    <Text style={styles.fleetDefault}>
                      {activeVehicle.is_default ? " · Default" : ""}
                    </Text>
                  </Text>
                  <View style={styles.fleetMeta}>
                    {activeVehicle.registration ? (
                      <View style={styles.plate}>
                        <Text style={styles.plateText}>
                          {activeVehicle.registration}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.rowStart}>
                      <View
                        style={[
                          styles.chipDot,
                          {
                            backgroundColor:
                              activeVehicle.status === "approved" ||
                              activeVehicle.status === "active"
                                ? DARK.success
                                : DARK.warning,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.onlineText,
                          {
                            color:
                              activeVehicle.status === "approved" ||
                              activeVehicle.status === "active"
                                ? DARK.success
                                : DARK.warning,
                          },
                        ]}
                      >
                        {activeVehicle.status || "pending"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.fleetFooter}>
                <Text style={styles.footerItem}>
                  <Text style={styles.footerBold}>{fleet.count}</Text> vehicle
                  {fleet.count === 1 ? "" : "s"}
                </Text>
                <Text style={styles.footerItem}>
                  <Text style={styles.footerBold}>
                    {fleet.active_count || 0}
                  </Text>{" "}
                  active
                </Text>
                <Text style={styles.footerItem}>
                  <Text style={styles.footerBold}>
                    {fleet.capabilities?.length || 0}
                  </Text>{" "}
                  capabilit{fleet.capabilities?.length === 1 ? "y" : "ies"}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* H. Rating + Messages ------------------------------------ */}
        <View style={styles.row2}>
          <Pressable
            onPress={() => nav.navigate("Profile")}
            style={({ pressed }) => [styles.mini, pressed && { opacity: 0.9 }]}
            testID="section-rating"
          >
            <View style={styles.miniHead}>
              <Icon name="star" size={14} color={DARK.warning} />
              <Text style={styles.miniTitle}>Rating</Text>
            </View>
            <Text style={styles.miniValue} testID="rating-value">
              {fmt2(rating)}
            </Text>
            <Text style={styles.stars}>
              {"★".repeat(stars)}
              <Text style={styles.starsEmpty}>
                {"★".repeat(Math.max(0, 5 - stars))}
              </Text>
            </Text>
            <Text style={styles.miniCap}>
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </Text>
            <Text style={styles.miniAction}>Profile →</Text>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate("MyJobs")}
            style={({ pressed }) => [styles.mini, pressed && { opacity: 0.9 }]}
            testID="section-messages"
          >
            <View style={styles.miniHead}>
              <Icon name="mail" size={14} color={DARK.cta} />
              <Text style={styles.miniTitle}>Messages</Text>
            </View>
            <Text style={styles.miniValue} testID="driver-messages-unread-value">
              {msgUnread > 99 ? "99+" : msgUnread}
            </Text>
            <Text style={styles.miniCap} testID="driver-messages-caption">
              {msgUnread > 0
                ? `unread ${msgUnread === 1 ? "message" : "messages"}`
                : "All caught up"}
            </Text>
            <Text style={[styles.miniAction, { marginTop: 10 }]}>
              Open inbox →
            </Text>
          </Pressable>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  // Header text overrides (so the LOCKED PageHeader renders white on dark)
  hdrTitle: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: DARK.text,
  },
  hdrSub: {
    marginTop: 2,
    fontSize: 13,
    color: DARK.textMuted,
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: space[8],
    gap: 14,
  },

  errorBanner: {
    borderRadius: 14,
    backgroundColor: "rgba(220,38,38,0.14)",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.4)",
    padding: 12,
  },
  errorBannerText: { color: "#FCA5A5", fontSize: 14 },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  row2: { flexDirection: "row", gap: 12 },

  // Cards
  card: {
    backgroundColor: DARK.surface,
    borderWidth: 1,
    borderColor: DARK.divider,
    borderRadius: 22,
    padding: 16,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -0.1,
  },
  cardRightMuted: {
    fontSize: 13,
    fontWeight: "600",
    color: DARK.textMuted,
  },

  // Hero
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "700",
    color: DARK.textFaint,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },

  heroAmountRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  heroCur: {
    fontSize: 36,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -1,
    marginRight: 4,
    lineHeight: 54,
  },
  heroBig: {
    fontSize: 56,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  heroPence: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -0.5,
    marginLeft: 2,
    lineHeight: 44,
  },
  heroCaption: { marginTop: 8, fontSize: 14, color: DARK.textMuted },

  weekStrip: { marginTop: 22 },
  weekBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 14,
  },
  weekBar: {
    flex: 1,
    marginHorizontal: 2.5,
    height: 3,
    borderRadius: 2,
    backgroundColor: DARK.dividerStrong,
  },
  weekBarActive: { backgroundColor: DARK.cta, height: 9 },
  weekLetters: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  weekLetter: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: DARK.textFaint,
    letterSpacing: 0.4,
  },
  weekLetterActive: { color: DARK.text },

  wma: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  wmaCell: { flex: 1 },
  wmaLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: DARK.textFaint,
    fontWeight: "700",
  },
  wmaValue: {
    marginTop: 6,
    fontSize: 19,
    color: DARK.text,
    fontWeight: "800",
    letterSpacing: -0.4,
  },

  heroActions: { marginTop: 18, flexDirection: "row", gap: 10 },
  cta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: DARK.cta,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: DARK.cta,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  ctaIcon: {
    width: 52,
    borderRadius: 14,
    backgroundColor: DARK.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  // Banners
  bannerWarn: {
    backgroundColor: DARK.surface2,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  bannerTitle: { color: DARK.text, fontSize: 15, fontWeight: "800" },
  bannerBody: {
    color: DARK.textMuted,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },

  // Next up
  nextBox: {
    backgroundColor: DARK.surface2,
    borderRadius: 16,
    padding: 16,
    position: "relative",
  },
  nextTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -0.2,
  },
  nextPaid: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextPaidText: {
    color: DARK.success,
    fontSize: 13,
    fontWeight: "700",
  },
  nextPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -0.3,
  },
  route: {
    marginTop: 14,
    paddingLeft: 22,
    position: "relative",
  },
  routeTrack: {
    position: "absolute",
    left: 5,
    top: 14,
    bottom: 22,
    width: 2,
    backgroundColor: DARK.dividerStrong,
    borderRadius: 1,
  },
  routeLeg: { marginBottom: 14, position: "relative" },
  routeKey: {
    fontSize: 10,
    letterSpacing: 1,
    color: DARK.textFaint,
    fontWeight: "700",
  },
  routeValue: {
    fontSize: 16,
    color: DARK.text,
    fontWeight: "700",
    marginTop: 2,
  },
  pickupDot: {
    position: "absolute",
    left: -22,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: DARK.text,
  },
  dropDot: {
    position: "absolute",
    left: -22,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: DARK.brand,
  },
  arrowBtn: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty
  emptyBox: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 20,
    backgroundColor: DARK.surface2,
    borderRadius: 16,
  },
  emptyText: { color: DARK.textMuted, fontSize: 13 },
  emptyLink: {
    color: DARK.cta,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },

  // Bids
  bidBar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: DARK.surface3,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 14,
  },
  bidBarPending: { height: 5, backgroundColor: DARK.warning },
  bidBarAccepted: { height: 5, backgroundColor: DARK.success },

  statCell: {
    flex: 1,
    backgroundColor: DARK.surface2,
    borderRadius: 14,
    padding: 14,
  },
  statCellTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 2 },
  statLabel: { fontSize: 12, color: DARK.textMuted, fontWeight: "700" },
  statValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -0.4,
  },
  nearRow: {
    marginTop: 14,
    backgroundColor: DARK.surface2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nearText: { flex: 1, fontSize: 14, color: DARK.text, fontWeight: "600" },
  nearAction: { fontSize: 14, fontWeight: "800", color: DARK.cta },

  // Documents
  docSummary: {
    backgroundColor: DARK.surface2,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  docIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  docTitle: { fontSize: 15, color: DARK.text, fontWeight: "800" },
  docSub: { fontSize: 13, color: DARK.textMuted, marginTop: 2 },
  docSegRow: { marginTop: 14, flexDirection: "row", gap: 6 },
  docSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: DARK.surface3,
  },
  docManage: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "800",
    color: DARK.text,
  },

  // Fleet
  fleetRow: {
    backgroundColor: DARK.surface2,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  fleetIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  fleetTitle: { fontSize: 15, fontWeight: "800", color: DARK.text },
  fleetDefault: { color: DARK.textMuted, fontWeight: "600" },
  fleetMeta: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  plate: {
    backgroundColor: DARK.plate,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 5,
  },
  plateText: {
    fontSize: 12,
    fontWeight: "800",
    color: DARK.bg,
    letterSpacing: 1,
  },
  onlineText: { fontSize: 13, fontWeight: "700" },
  fleetFooter: {
    marginTop: 14,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  footerItem: { fontSize: 13, color: DARK.textMuted },
  footerBold: { color: DARK.text, fontWeight: "800" },

  // Mini cards
  mini: {
    flex: 1,
    backgroundColor: DARK.surface,
    borderWidth: 1,
    borderColor: DARK.divider,
    borderRadius: 22,
    padding: 16,
  },
  miniHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: DARK.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  miniValue: {
    fontSize: 34,
    fontWeight: "800",
    color: DARK.text,
    letterSpacing: -0.8,
    marginTop: 4,
    lineHeight: 38,
  },
  stars: { color: DARK.warning, fontSize: 15, letterSpacing: 2, marginTop: 2 },
  starsEmpty: { color: "rgba(255,255,255,0.12)" },
  miniCap: { fontSize: 12, color: DARK.textMuted, marginTop: 2 },
  miniAction: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    color: DARK.cta,
  },
});
