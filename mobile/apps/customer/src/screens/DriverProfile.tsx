/**
 * DriverProfileScreen — public driver profile view, mirrors web
 * /driver-profile/:id. Opened from BookingDetail / Bids so customers
 * can see reviews before they accept a bid.
 */
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { SharedAPI, DriverProfile } from "@cargoone/core";

type P = NativeStackScreenProps<RootStackParamList, "DriverProfile">;

export function DriverProfileScreen({ route }: P) {
  const { driverId } = route.params;
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    SharedAPI.driverProfile(driverId).then(setProfile).catch((e) => setErr(e?.message || "Failed to load driver profile"));
  }, [driverId]);

  if (err) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.body}>
          <Text style={{ color: "#B91C1C" }}>{err}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const anyProfile: any = profile || {};
  const reviews = anyProfile.reviews || [];

  return (
    <SafeAreaView style={styles.root} testID="driver-profile-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(anyProfile.name || "?").slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.name}>{anyProfile.name || "Driver"}</Text>
          {anyProfile.rating_average != null ? (
            <Text style={styles.rating}>★ {Number(anyProfile.rating_average).toFixed(1)} · {anyProfile.review_count || 0} review{anyProfile.review_count === 1 ? "" : "s"}</Text>
          ) : null}
        </View>

        {anyProfile.bio ? <Text style={styles.bio}>{anyProfile.bio}</Text> : null}

        <Text style={styles.sectionTitle}>Recent reviews</Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyReviews}>No reviews yet.</Text>
        ) : (
          reviews.map((r: any, i: number) => (
            <View key={r.id || i} style={styles.review}>
              <Text style={styles.reviewRating}>{"★".repeat(Math.round(r.rating || 0))}</Text>
              {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              {r.customer_name ? <Text style={styles.reviewAuthor}>— {r.customer_name}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  body: { padding: 20 },
  header: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#D62828", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#FFFFFF", fontSize: 36, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "700", color: "#111827" },
  rating: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  bio: { fontSize: 14, color: "#374151", lineHeight: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", color: "#6B7280", letterSpacing: 0.5, marginBottom: 12 },
  emptyReviews: { fontSize: 14, color: "#6B7280" },
  review: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 14, marginBottom: 8 },
  reviewRating: { color: "#F59E0B", fontSize: 14, marginBottom: 4 },
  reviewComment: { fontSize: 14, color: "#111827", lineHeight: 20 },
  reviewAuthor: { fontSize: 12, color: "#6B7280", marginTop: 6 },
});
