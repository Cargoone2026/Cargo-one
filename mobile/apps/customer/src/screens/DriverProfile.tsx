/**
 * DriverProfileScreen — public driver profile view. Mirrors web
 * /driver-profile/:id, opened from BookingDetail / Bids.
 */
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Star, MessageSquare } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { SharedAPI, DriverProfile } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { EmptyState, Page, PageHeader } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "DriverProfile">;

export function DriverProfileScreen({ route }: P) {
  const { driverId } = route.params;
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    SharedAPI.driverProfile(driverId)
      .then(setProfile)
      .catch((e) => setErr(e?.message || "Failed to load driver profile"));
  }, [driverId]);

  if (err) {
    return (
      <Page testID="driver-profile-error">
        <PageHeader title="Driver" />
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.errorInk }}>{err}</Text>
        </View>
      </Page>
    );
  }

  const anyProfile: any = profile || {};
  const reviews: any[] = anyProfile.reviews || [];

  return (
    <Page testID="driver-profile-screen">
      <ScrollView>
        <PageHeader title="Driver" />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 20 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(anyProfile.name || "?").slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={typography.h2}>{anyProfile.name || "Driver"}</Text>
            {anyProfile.rating_average != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Star size={14} color={colors.accent} fill={colors.accent} />
                <Text style={typography.caption}>
                  {Number(anyProfile.rating_average).toFixed(1)} · {anyProfile.review_count || 0} review
                  {anyProfile.review_count === 1 ? "" : "s"}
                </Text>
              </View>
            ) : null}
          </View>

          {anyProfile.bio ? (
            <Text style={[typography.body, { lineHeight: 22, color: colors.ink }]}>{anyProfile.bio}</Text>
          ) : null}

          <Text style={typography.micro}>Recent reviews</Text>
          {reviews.length === 0 ? (
            <EmptyState Icon={MessageSquare} title="No reviews yet" />
          ) : (
            reviews.map((r: any, i: number) => (
              <View key={r.id || i} style={styles.reviewCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {Array.from({ length: Math.round(r.rating || 0) }, (_, k) => (
                    <Star key={k} size={14} color={colors.accent} fill={colors.accent} />
                  ))}
                </View>
                {r.comment ? (
                  <Text style={[typography.body, { marginTop: 6, lineHeight: 20 }]}>{r.comment}</Text>
                ) : null}
                {r.customer_name ? (
                  <Text style={[typography.small, { marginTop: 6 }]}>— {r.customer_name}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 8,
  },
  avatarText: { color: "#FFFFFF", fontSize: 36, fontWeight: "700" as const },
  reviewCard: {
    padding: 14,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
