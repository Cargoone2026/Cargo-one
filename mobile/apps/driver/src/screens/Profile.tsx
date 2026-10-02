/**
 * ProfileScreen — Driver mobile port of frontend/src/pages/portal/driver/Profile.jsx.
 *
 * Visual language mirrors Customer Profile.tsx verbatim where possible:
 *   • Centered identity card: avatar, name, email, status/verified pills,
 *     rating pill. (Camera FAB intentionally hidden in this pass — no
 *     image-picker native dep in Driver autolinking.)
 *   • Saved-address summary card (parity with Customer).
 *   • Menu groups: Edit profile / Change password / Documents (view-only)
 *     · Account (Fleet, Notifications, Settings) · Legal · Danger (Logout).
 */
import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DriverAPI, type Review } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import {
  Card, Icon, MenuRow, Page, PageHeader, Section,
  colors, radius, space, typography,
} from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: P) {
  const { user, logout } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let alive = true;
    if (!user?.id) return;
    (async () => {
      const rvs = await DriverAPI.myReviews(user.id).catch(() => [] as Review[]);
      if (alive) setReviews(Array.isArray(rvs) ? rvs : []);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  if (!user) return null;

  const confirmLogout = () => logout();

  const initial = (user.name || user.email || "?").slice(0, 1).toUpperCase();
  const rating = Number(user.rating || 0).toFixed(1);
  const reviewCount = user.review_count ?? reviews.length;
  const jobs = user.total_jobs ?? 0;

  const addressLine =
    user.address_line1 || user.town || user.postcode
      ? [
          user.address_line1,
          user.address_line2,
          [user.town, user.county].filter(Boolean).join(", "),
          user.postcode,
          user.country,
        ].filter(Boolean).join(" · ")
      : null;

  const statusLabel =
    user.status === "active" ? "Approved driver"
      : user.status === "changes_requested" ? "Action needed"
      : user.status === "suspended" ? "Suspended"
      : "Pending approval";
  const statusDot =
    user.status === "active" ? colors.success
      : user.status === "suspended" ? colors.error
      : colors.warning;

  return (
    <Page testID="driver-profile">
      <PageHeader title="Profile" large />
      <Section gap={space[4]}>
        {/* Identity card */}
        <View style={styles.identity} testID="driver-profile-header">
          <View style={styles.avatarWrap}>
            {user.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={styles.avatar} testID="driver-profile-photo-img" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </View>
          <Text style={[typography.h2, { marginTop: space[3], textAlign: "center" }]} testID="driver-profile-name">
            {user.name || "Cargo One driver"}
          </Text>
          <Text style={[typography.caption, { marginTop: 2, textAlign: "center" }]} testID="driver-profile-email">
            {user.email}
          </Text>

          {user.verified_driver ? (
            <View style={[styles.verifiedPill]} testID="verified-driver-badge">
              <Icon name="shield" size={13} color="#FFFFFF" />
              <Text style={styles.verifiedPillText}>VERIFIED DRIVER</Text>
            </View>
          ) : null}

          <View style={styles.statusRow} testID="driver-status-pill">
            <View style={[styles.statusDot, { backgroundColor: statusDot }]} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>

          <View style={styles.ratingPill}>
            <Icon name="star" size={12} color={colors.accentDark} />
            <Text style={styles.ratingText}>
              {rating} · {reviewCount} {reviewCount === 1 ? "review" : "reviews"} · {jobs} jobs
            </Text>
          </View>
        </View>

        {/* Edit profile / Change password */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="Edit profile"
            subtitle="Name, phone, registered address"
            testID="driver-profile-edit"
            leftGlyph={<Glyph name="user" />}
            onPress={() => navigation.navigate("EditProfile")}
          />
          <MenuRow
            label="Change password"
            subtitle="Requires current password"
            testID="driver-profile-change-password"
            leftGlyph={<Glyph name="lock" />}
            onPress={() => navigation.navigate("ChangePassword")}
          />
        </Card>

        {/* Saved address summary (parity with Customer) */}
        {addressLine ? (
          <View style={styles.addressCard} testID="driver-profile-address-view">
            <View style={styles.addressIcon}>
              <Icon name="map-pin" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.micro}>REGISTERED ADDRESS</Text>
              <Text style={[typography.body, { marginTop: 4, lineHeight: 20 }]}>{addressLine}</Text>
            </View>
          </View>
        ) : null}

        {/* Account */}
        <Text style={typography.micro}>ACCOUNT</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="My fleet"
            subtitle="Register / edit vehicles and capabilities"
            testID="open-fleet"
            leftGlyph={<Glyph name="truck" />}
            onPress={() => navigation.navigate("Fleet")}
          />
          <MenuRow
            label="Verification documents"
            subtitle="View your submitted verification documents"
            testID="open-documents"
            leftGlyph={<Glyph name="file-text" />}
            onPress={() => navigation.navigate("Documents")}
          />
          <MenuRow
            label="Notifications"
            subtitle="Dispatch, payment and message updates"
            testID="profile-notifications"
            leftGlyph={<Glyph name="bell" />}
            onPress={() => navigation.navigate("Notifications")}
          />
          <MenuRow
            label="Settings"
            subtitle="Preferences, legal, account"
            testID="profile-settings"
            leftGlyph={<Glyph name="settings" />}
            onPress={() => navigation.navigate("Settings")}
          />
        </Card>

        {/* Reviews summary */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="star" size={14} color={colors.accentDark} />
              <Text style={typography.cardTitle}>Customer reviews</Text>
            </View>
            <Text style={typography.small} testID="driver-reviews-count">{reviewCount} total</Text>
          </View>
          {reviews.length === 0 ? (
            <Text style={[typography.caption, { marginTop: space[2] }]}>
              No reviews yet. Complete deliveries to start collecting reviews.
            </Text>
          ) : (
            <View style={{ marginTop: space[3], gap: space[3] }}>
              {reviews.slice(0, 3).map((r) => (
                <View key={r.id} testID={`driver-review-${r.id}`} style={styles.reviewRow}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[typography.strong, { fontSize: 13 }]} numberOfLines={1}>
                      {r.from_name || "Customer"}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accentDark }}>
                      {"★".repeat(r.rating || 0) + "☆".repeat(Math.max(0, 5 - (r.rating || 0)))}
                    </Text>
                  </View>
                  {r.comment ? (
                    <Text style={[typography.caption, { marginTop: 4, lineHeight: 18 }]} numberOfLines={3}>
                      {r.comment}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Legal */}
        <Text style={typography.micro}>LEGAL</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="Terms & Conditions"
            testID="profile-terms"
            leftGlyph={<Glyph name="file-text" />}
            onPress={() => navigation.navigate("Legal", { slug: "terms" })}
          />
          <MenuRow
            label="Privacy Policy"
            testID="profile-privacy"
            leftGlyph={<Glyph name="shield" />}
            onPress={() => navigation.navigate("Legal", { slug: "privacy" })}
          />
          <MenuRow
            label="Cookie Policy"
            testID="profile-cookies"
            leftGlyph={<Glyph name="info" />}
            onPress={() => navigation.navigate("Legal", { slug: "cookies" })}
          />
        </Card>

        {/* Logout */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="Log out"
            testID="driver-logout"
            leftGlyph={<Glyph name="log-out" />}
            onPress={confirmLogout}
          />
        </Card>
      </Section>
    </Page>
  );
}

function Glyph({ name }: { name: React.ComponentProps<typeof Icon>["name"] }) {
  return (
    <View style={styles.rowGlyph}>
      <Icon name={name} size={18} color={colors.ink} />
    </View>
  );
}

const styles = {
  identity: {
    alignItems: "center" as const,
    padding: space[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 2,
  },
  avatarWrap: { position: "relative" as const, width: 88, height: 88 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  avatarInitial: { color: "#FFFFFF", fontSize: 30, fontWeight: "800" as const },
  verifiedPill: {
    marginTop: 8,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 0.8,
    color: "#FFFFFF",
  },
  statusRow: {
    marginTop: 6,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.bgSecondary,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600" as const, color: colors.ink },
  ratingPill: {
    marginTop: 6,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
  },
  ratingText: { fontSize: 12, fontWeight: "700" as const, color: colors.accentDark },
  addressCard: {
    flexDirection: "row" as const,
    gap: 12,
    padding: space[4],
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  addressIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: colors.bgSecondary,
  },
  rowGlyph: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: colors.bgSecondary,
  },
  reviewRow: {
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
} as const;
