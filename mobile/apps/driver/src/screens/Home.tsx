/**
 * CargoOne Driver — Home / Dashboard.
 *
 * Content faithful to the Driver web dashboard
 * (frontend/src/pages/portal/driver/Dashboard.jsx) — same cards,
 * same API, same conditional warning banners. Visual language from
 * the Customer mobile design system (shared primitives in `../ui`).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { DriverAPI, type DriverDashboard } from "@cargoone/core";
import {
  Page, PageHeader, IconButton, Section, Card, CardTitleRow, StatCell,
  StatusPill, SectionTitle, Body, Caption, Row, PrimaryButton, EmptyState,
  HeroCard, MapPin, ChevronRight, Glyph,
  colors, radius, space, typography,
} from "../ui";
import { useAuth } from "../AuthContext";

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
    (async () => { await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const pending = user?.status === "pending";
  const changesRequested = user?.status === "changes_requested";
  const suspended = user?.status === "suspended";
  const accountStatus = suspended ? "suspended" : changesRequested ? "changes_requested" : pending ? "pending" : "active";

  const earnings = dash.earnings || {};
  const bids = dash.bids || {};
  const fleet = dash.fleet || {};
  const jobs = dash.jobs || {};
  const verify = dash.verification || {};
  const rating = dash.user?.rating ?? (user as any)?.rating ?? 5;
  const reviewCount = dash.user?.review_count ?? 0;
  const changesReason =
    (user as any)?.changes_requested_reason || dash?.user?.changes_requested_reason;
  const changesDocTypes =
    (user as any)?.changes_requested_doc_types || dash?.user?.changes_requested_doc_types || [];

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

  if (loading) {
    return (
      <Page testID="driver-home-loading">
        <PageHeader title={`Hi ${firstName}`} subtitle="Loading…" large />
      </Page>
    );
  }

  return (
    <Page
      testID="driver-home"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <PageHeader
        title={`Hi ${firstName}`}
        subtitle={subtitle}
        large
        right={
          <IconButton
            testID="driver-notifications-button"
            accessibilityLabel="Notifications"
            badged={notifUnread > 0}
            onPress={() =>
              Alert.alert("Notifications", "The notifications inbox ships in a later phase.")
            }
          >
            <Glyph name="bell" size={22} />
          </IconButton>
        }
      />

      <Section gap={space[3]}>
        {error ? (
          <View style={styles.errorBanner} testID="driver-home-error">
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Account status hero — Driver equivalent of Customer's "Post a job" hero */}
        <HeroCard
          testID="driver-status-hero"
          eyebrow="Today"
          title={
            suspended ? "Your account is suspended" :
            changesRequested ? "Admin requested changes" :
            pending ? "Finish verification to go live" :
            `You've earned £${Number(earnings.today || 0).toFixed(0)} today`
          }
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
            <StatusPill status={accountStatus} testID="driver-status-pill" />
            <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
              {earnings.completed_count || 0} completed deliver
              {earnings.completed_count === 1 ? "y" : "ies"}
            </Text>
          </View>
          {!suspended && !changesRequested && !pending ? (
            <Pressable
              onPress={() => nav.navigate("LiveMode")}
              style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
              testID="driver-go-live-cta"
            >
              <Glyph name="zap" size={16} color={colors.ink} />
              <Text style={styles.heroCtaText}>Open Live Mode</Text>
              <ChevronRight size={16} color={colors.ink} />
            </Pressable>
          ) : null}
        </HeroCard>

        {/* Pending — amber banner */}
        {pending ? (
          <Card
            onPress={() =>
              Alert.alert("Documents", "The documents screen ships in a later phase.")
            }
            testID="driver-warning-card"
            style={{ backgroundColor: colors.warningBg, borderColor: "#FDE68A" }}
          >
            <Row>
              <Glyph name="alert" size={22} color={colors.warning} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={typography.strong}>Account under review</Text>
                <Caption style={{ color: colors.warningInk, marginTop: 2 }}>
                  Upload driving licence, insurance, ID and vehicle photos to start receiving jobs.
                </Caption>
              </View>
              <ChevronRight size={18} />
            </Row>
          </Card>
        ) : null}

        {/* Changes requested — red banner */}
        {changesRequested ? (
          <Card
            testID="driver-changes-card"
            style={{ backgroundColor: colors.errorBg, borderColor: colors.error }}
          >
            <Row style={{ alignItems: "flex-start" }}>
              <Glyph name="alert" size={22} color={colors.error} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={typography.strong}>Admin has requested changes</Text>
                {changesReason ? (
                  <Caption style={{ color: colors.errorInk, marginTop: 4 }}>{changesReason}</Caption>
                ) : null}
                {changesDocTypes.length > 0 ? (
                  <Caption style={{ color: colors.errorInk, marginTop: 4 }}>
                    Please re-upload: {changesDocTypes.map((k: string) => k.replace(/_/g, " ")).join(", ")}
                  </Caption>
                ) : null}
              </View>
            </Row>
            <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3], flexWrap: "wrap" }}>
              <PrimaryButton
                title="Update documents"
                onPress={() =>
                  Alert.alert("Documents", "The documents screen ships in a later phase.")
                }
                testID="driver-changes-upload"
                style={{ flex: 1, minWidth: 160 }}
              />
              <PrimaryButton
                title="Re-submit for review"
                variant="danger"
                onPress={resubmit}
                testID="driver-changes-resubmit"
                style={{ flex: 1, minWidth: 160 }}
              />
            </View>
          </Card>
        ) : null}

        {/* Suspended — red banner */}
        {suspended ? (
          <Card
            testID="driver-suspended-card"
            style={{ backgroundColor: colors.errorBg, borderColor: colors.error }}
          >
            <Row style={{ alignItems: "flex-start" }}>
              <Glyph name="ban" size={22} color={colors.error} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={typography.strong}>Account suspended</Text>
                <Caption style={{ color: colors.errorInk, marginTop: 2 }}>
                  Contact support if you believe this is a mistake.
                </Caption>
              </View>
            </Row>
          </Card>
        ) : null}

        {/* Earnings */}
        <Card testID="section-earnings">
          <CardTitleRow
            glyph="coin"
            tintBg={colors.errorBg}
            tintFg={colors.brand}
            title="Earnings"
            rightLabel="Details"
            onRight={() => nav.navigate("Earnings")}
          />
          <Row style={{ gap: space[2], flexWrap: "wrap" }}>
            <StatCell label="Today"     value={`£${Number(earnings.today || 0).toFixed(0)}`}     accent={colors.success} />
            <StatCell label="Week"      value={`£${Number(earnings.week || 0).toFixed(0)}`} />
            <StatCell label="Month"     value={`£${Number(earnings.month || 0).toFixed(0)}`} />
            <StatCell label="All-time"  value={`£${Number(earnings.all_time || 0).toFixed(0)}`} accent={colors.brand} />
          </Row>
          <Caption style={{ marginTop: space[3] }}>
            {earnings.completed_count || 0} completed deliver
            {earnings.completed_count === 1 ? "y" : "ies"}
          </Caption>
        </Card>

        {/* Fleet */}
        <Card testID="section-fleet">
          <CardTitleRow
            glyph="truck"
            tintBg={colors.infoBg}
            tintFg={colors.info}
            title="Fleet Summary"
            rightLabel="Manage"
            onRight={() => nav.navigate("Fleet")}
          />
          {!fleet.count ? (
            <Pressable
              onPress={() => nav.navigate("Fleet")}
              style={({ pressed }) => [styles.innerRow, pressed && { backgroundColor: "#F3F4F6" }]}
              testID="fleet-empty-cta"
            >
              <Glyph name="plus" size={18} color={colors.brand} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>
                  Register your first vehicle
                </Text>
                <Caption style={{ marginTop: 2 }}>
                  Drivers must have at least one vehicle to accept jobs.
                </Caption>
              </View>
              <ChevronRight size={18} />
            </Pressable>
          ) : (
            <>
              <Row style={{ gap: space[2] }}>
                <StatCell label="Vehicles" value={String(fleet.count)} />
                <StatCell label="Active" value={String(fleet.active_count || 0)} accent={colors.success} />
                <StatCell label="Capabilities" value={String(fleet.capabilities?.length || 0)} />
              </Row>
              <View style={{ marginTop: space[3], gap: space[2] }}>
                {(fleet.vehicles || []).slice(0, 3).map((v: any) => (
                  <View key={v.id} style={styles.innerRow} testID={`fleet-veh-${v.id}`}>
                    <Glyph name="truck" size={20} color={colors.inkMuted} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }} numberOfLines={1}>
                        {v.vehicle_type_name || "Vehicle"}
                        {v.is_default ? " · Default" : ""}
                      </Text>
                      <Caption numberOfLines={1}>{v.registration || "—"}</Caption>
                    </View>
                    <StatusPill status={v.status || "pending"} />
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Messages */}
        <Card testID="section-messages">
          <CardTitleRow
            glyph="message"
            tintBg="#FFF7ED"
            tintFg={colors.accent}
            title="Messages"
            rightLabel="Open inbox"
            onRight={() => nav.navigate("MyJobs")}
          />
          {msgUnread > 0 ? (
            <View style={[styles.innerRow, { backgroundColor: colors.warningBg }]} testID="driver-messages-unread-card">
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>
                  {msgUnread} new {msgUnread === 1 ? "message" : "messages"}
                </Text>
                <Caption style={{ marginTop: 2 }}>
                  Open the booking to reply — reading a conversation marks it read.
                </Caption>
              </View>
              <View style={styles.redBadge}>
                <Text style={styles.redBadgeText}>{msgUnread > 99 ? "99+" : String(msgUnread)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.innerEmpty} testID="driver-messages-empty">
              <Glyph name="message" size={22} color={colors.inkFaint} />
              <Caption>No unread messages.</Caption>
            </View>
          )}
        </Card>

        {/* Upcoming Jobs */}
        <Card testID="section-upcoming">
          <CardTitleRow
            glyph="calendar"
            tintBg={colors.warningBg}
            tintFg={colors.warning}
            title="Upcoming Jobs"
            rightLabel="See all"
            onRight={() => nav.navigate("MyJobs")}
          />
          {!jobs.upcoming_count ? (
            <View style={styles.innerEmpty} testID="upcoming-empty">
              <Glyph name="calendar" size={22} color={colors.inkFaint} />
              <Caption>No confirmed pickups yet.</Caption>
              <Pressable onPress={() => nav.navigate("AvailableJobs")}>
                <Text style={{ marginTop: 4, fontSize: 13, fontWeight: "700", color: colors.brand }}>
                  Find jobs →
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: space[2] }}>
              {(jobs.upcoming || []).slice(0, 3).map((j: any) => (
                <Pressable
                  key={j.id}
                  onPress={() =>
                    Alert.alert("Job details", "The booking detail screen ships in a later phase.")
                  }
                  style={({ pressed }) => [styles.innerRow, pressed && { backgroundColor: "#F3F4F6" }]}
                  testID={`upcoming-${j.id}`}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }} numberOfLines={1}>
                      {j.title || "Booking"}
                    </Text>
                    <Row style={{ marginTop: 2, gap: 4 }}>
                      <MapPin size={12} />
                      <Caption numberOfLines={1} style={{ flex: 1 }}>
                        {j.pickup_town || "—"} → {j.dropoff_town || "—"}
                      </Caption>
                    </Row>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={typography.price}>
                      £{Number(j.driver_charge || j.total_price || 0).toFixed(0)}
                    </Text>
                    <StatusPill status={j.status || "confirmed"} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        {/* Active Bids */}
        <Card testID="section-bids">
          <CardTitleRow
            glyph="tag"
            tintBg="#F3E8FF"
            tintFg="#7C3AED"
            title="Active Bids"
            rightLabel="Browse jobs"
            onRight={() => nav.navigate("AvailableJobs")}
          />
          <Row style={{ gap: space[2] }}>
            <StatCell label="Pending"    value={String(bids.active || 0)}    accent={bids.active ? colors.warning : colors.inkMuted} />
            <StatCell label="Accepted"   value={String(bids.accepted || 0)}  accent={colors.success} />
            <StatCell label="Nearby jobs" value={String(jobs.nearby_count || 0)} accent={colors.brand} />
          </Row>
        </Card>

        {/* Rating */}
        <Card testID="section-rating">
          <CardTitleRow
            glyph="star"
            tintBg={colors.warningBg}
            tintFg={colors.warning}
            title="Rating"
            rightLabel="Profile"
            onRight={() => nav.navigate("Profile")}
          />
          <Row style={{ gap: space[4] }}>
            <Text style={{ fontSize: 42, fontWeight: "700", color: colors.ink, letterSpacing: -0.5 }}>
              {Number(rating).toFixed(2)}
            </Text>
            <View>
              <Text style={{ fontSize: 16, color: colors.warning, letterSpacing: 2 }}>
                {"★".repeat(Math.round(rating))}
                <Text style={{ color: colors.border }}>{"★".repeat(Math.max(0, 5 - Math.round(rating)))}</Text>
              </Text>
              <Caption style={{ marginTop: 4 }}>
                Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </Caption>
            </View>
          </Row>
        </Card>

        {/* Verification */}
        <Card testID="section-verification">
          <CardTitleRow
            glyph="shield"
            tintBg={(verify.docs_rejected || 0) > 0 ? colors.errorBg : colors.successBg}
            tintFg={(verify.docs_rejected || 0) > 0 ? colors.brand : colors.success}
            title="Vehicle & Document Status"
            rightLabel="Documents"
            onRight={() =>
              Alert.alert("Documents", "The documents screen ships in a later phase.")
            }
          />
          <Row style={{ gap: space[2] }}>
            <StatCell label="Verified" value={String(verify.docs_verified || 0)} accent={colors.success} />
            <StatCell label="Pending"  value={String(verify.docs_pending || 0)}  accent={colors.warning} />
            <StatCell label="Rejected" value={String(verify.docs_rejected || 0)} accent={colors.brand} />
          </Row>
          <Caption style={{ marginTop: space[3] }}>
            Account: {verify.account_status || user?.status || "—"}
          </Caption>
        </Card>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    borderRadius: radius.base,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
    padding: space[3],
  },
  errorBannerText: { color: colors.error, fontSize: 14 },
  heroCta: {
    marginTop: space[3],
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.inkInverse,
  },
  heroCtaText: { fontSize: 14, fontWeight: "700", color: colors.ink },
  innerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: "#F9FAFB",
    borderRadius: radius.md,
    padding: space[3],
  },
  innerEmpty: {
    alignItems: "center",
    gap: 4,
    paddingVertical: space[4],
    backgroundColor: "#F9FAFB",
    borderRadius: radius.md,
  },
  redBadge: {
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  redBadgeText: { fontSize: 12, fontWeight: "700", color: colors.inkInverse },
});
