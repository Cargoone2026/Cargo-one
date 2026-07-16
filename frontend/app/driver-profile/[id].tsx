import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Profile = {
  id: string;
  name: string;
  role: string;
  rating: number;
  total_jobs: number;
  review_count: number;
  completed_bookings: number;
  vehicle?: any;
  profile_photo?: string | null;
  verified_driver?: boolean;
  documents_verified?: boolean;
  created_at: string;
  reviews: any[];
};

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res: any = await api(`/users/${id}/profile`);
        setP(res);
      } catch {
        // silent
      }
    })();
  }, [id]);

  if (!p) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const memberSince = new Date(p.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long",
  });
  const initials = p.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="profile-back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{p.role === "driver" ? "Driver" : "Profile"}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {p.profile_photo ? (
              <Image source={{ uri: p.profile_photo }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <Text style={styles.name}>{p.name}</Text>
          {p.verified_driver && (
            <View style={styles.verified} testID="profile-verified">
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.verifiedText}>VERIFIED DRIVER</Text>
            </View>
          )}
          <Text style={styles.memberSince}>Member since {memberSince}</Text>

          <View style={styles.statsRow}>
            <Stat value={p.rating.toFixed(1)} label="Rating" icon="star" color={colors.accent} />
            <Stat value={String(p.completed_bookings)} label="Deliveries" icon="checkmark-done" color={colors.success} />
            <Stat value={String(p.review_count)} label="Reviews" icon="chatbubbles" color={colors.info} />
          </View>
        </View>

        {p.vehicle && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Vehicle</Text>
            <View style={styles.vehicleRow}>
              <Ionicons name="car-sport" size={28} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleTitle}>
                  {p.vehicle.make || "Vehicle"} {p.vehicle.model || ""}
                </Text>
                {p.vehicle.capacity && (
                  <Text style={styles.vehicleSub}>{p.vehicle.capacity}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Reviews ({p.review_count})</Text>
        {p.reviews.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No reviews yet.</Text>
          </View>
        ) : (
          p.reviews.map((r) => (
            <View key={r.id} style={styles.review} testID={`review-${r.id}`}>
              <View style={styles.reviewHead}>
                <Text style={styles.reviewFrom}>{r.from_name}</Text>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= r.rating ? "star" : "star-outline"}
                      size={14}
                      color={colors.accent}
                    />
                  ))}
                </View>
              </View>
              {r.verified_delivery && (
                <View style={styles.verifiedDeliveryBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                  <Text style={styles.verifiedDeliveryText}>VERIFIED DELIVERY</Text>
                </View>
              )}
              {r.comment ? <Text style={styles.reviewText}>{r.comment}</Text> : null}
              {r.photos && r.photos.length > 0 && (
                <View style={styles.reviewPhotos}>
                  {r.photos.map((ph: string, i: number) => (
                    <Image key={i} source={{ uri: ph }} style={styles.reviewPhoto} />
                  ))}
                </View>
              )}
              <Text style={styles.reviewDate}>
                {new Date(r.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, icon, color }: any) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  avatar: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.text,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 96, height: 96 },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: weight.bold },
  name: { fontSize: 26, fontWeight: weight.bold, color: colors.text, marginTop: spacing.sm, letterSpacing: -0.3 },
  verified: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill,
  },
  verifiedText: { color: "#fff", fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.8 },
  memberSince: { fontSize: font.sm, color: colors.textSecondary },
  statsRow: {
    flexDirection: "row", gap: spacing.md, marginTop: spacing.lg,
    width: "100%",
  },
  stat: {
    flex: 1, padding: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    alignItems: "center", gap: 4,
  },
  statValue: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.3 },
  statLabel: { fontSize: font.sm, color: colors.textSecondary },
  card: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.semibold,
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  vehicleTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  vehicleSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text, marginTop: spacing.md },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm },
  emptyText: { color: colors.textSecondary },
  review: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    gap: spacing.sm,
  },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewFrom: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  reviewStars: { flexDirection: "row", gap: 2 },
  verifiedDeliveryBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start", backgroundColor: colors.successBg,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  verifiedDeliveryText: { color: colors.success, fontSize: 10, fontWeight: weight.bold, letterSpacing: 0.5 },
  reviewText: { fontSize: font.base, color: colors.text, lineHeight: 20 },
  reviewPhotos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  reviewPhoto: { width: 80, height: 80, borderRadius: radius.sm, backgroundColor: colors.bgSecondary },
  reviewDate: { fontSize: font.sm, color: colors.textTertiary },
});
