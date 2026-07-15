import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import MapView from "@/src/components/MapView";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function CustomerJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [j, bs] = await Promise.all([
        api(`/jobs/${id}`),
        api<any[]>(`/jobs/${id}/bids`),
      ]);
      setJob(j);
      setBids(bs);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function acceptBid(bidId: string) {
    setAccepting(bidId);
    try {
      await api(`/bids/${bidId}/accept`, { method: "POST" });
      // Create booking
      const booking: any = await api("/bookings", {
        method: "POST",
        body: { job_id: id },
      });
      router.replace(`/(customer)/booking/${booking.id}`);
    } catch (e: any) {
      // ignore
    } finally {
      setAccepting(null);
    }
  }

  async function goToBookingForFixedJob() {
    try {
      const booking: any = await api("/bookings", {
        method: "POST",
        body: { job_id: id },
      });
      router.replace(`/(customer)/booking/${booking.id}`);
    } catch {
      // ignore
    }
  }

  if (!job) {
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="job-detail-back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{job.title}</Text>
          <StatusPill status={job.status} />
        </View>

        <View style={styles.map}>
          <MapView
            pickup={{ lat: job.pickup_lat, lng: job.pickup_lng, label: "Pickup" }}
            dropoff={{ lat: job.dropoff_lat, lng: job.dropoff_lng, label: "Dropoff" }}
            height={200}
          />
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeValue}>{job.pickup_town}</Text>
            </View>
          </View>
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: colors.brand }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeValue}>{job.dropoff_town}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{job.distance_miles} mi · {job.category.replace("_", " ")}</Text>
          </View>
        </View>

        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Description</Text>
          <Text style={styles.detailValue}>{job.description || "—"}</Text>
        </View>

        <View style={styles.priceCard}>
          <View>
            <Text style={styles.priceLabel}>
              {job.pricing_type === "fixed" ? "Fixed price" : "Suggested price"}
            </Text>
            <Text style={styles.priceValue}>
              £{Number(job.fixed_price || job.suggested_price).toFixed(0)}
            </Text>
          </View>
          <View style={styles.pricingBadge}>
            <Ionicons
              name={job.pricing_type === "bidding" ? "megaphone" : "pricetag"}
              size={14}
              color={colors.text}
            />
            <Text style={styles.pricingBadgeText}>
              {job.pricing_type === "bidding" ? "Open to bids" : "Fixed"}
            </Text>
          </View>
        </View>

        {job.status === "posted" && job.pricing_type === "bidding" && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={styles.sectionTitle}>Bids ({bids.length})</Text>
            {bids.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="hourglass-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.emptyText}>Waiting for drivers to bid...</Text>
              </View>
            ) : (
              bids.map((b) => (
                <View key={b.id} style={styles.bidCard} testID={`bid-card-${b.id}`}>
                  <View style={styles.bidHead}>
                    <View style={styles.bidAvatar}>
                      <Text style={styles.bidAvatarText}>
                        {b.driver_name?.[0]?.toUpperCase() || "D"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bidName}>Driver #{b.driver_id.slice(0, 6)}</Text>
                      <View style={styles.bidMeta}>
                        <Ionicons name="star" size={12} color={colors.accent} />
                        <Text style={styles.bidMetaText}>{Number(b.driver_rating).toFixed(1)}</Text>
                        {b.eta_hours ? (
                          <Text style={styles.bidMetaText}>· ~{b.eta_hours}h ETA</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.bidAmount}>£{Number(b.amount).toFixed(0)}</Text>
                  </View>
                  {b.message ? <Text style={styles.bidMsg}>{b.message}</Text> : null}
                  <Button
                    title="Accept Bid"
                    small
                    onPress={() => acceptBid(b.id)}
                    loading={accepting === b.id}
                    testID={`accept-bid-${b.id}`}
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              ))
            )}
          </View>
        )}

        {job.status === "posted" && job.pricing_type === "fixed" && (
          <View style={styles.empty}>
            <Ionicons name="hourglass-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Waiting for a driver to accept the fixed price...</Text>
          </View>
        )}

        {job.status === "accepted" && (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.acceptedBox}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={styles.acceptedText}>
                Driver accepted! Pay deposit to unlock contact details and chat.
              </Text>
            </View>
            <Button
              title="Continue to Payment"
              onPress={goToBookingForFixedJob}
              testID="continue-to-payment-button"
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  title: { flex: 1, fontSize: 26, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.4 },
  map: { height: 200, borderRadius: radius.lg, overflow: "hidden", marginTop: spacing.sm },
  routeBox: {
    padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.bgSecondary,
    gap: spacing.md,
  },
  routeItem: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  routeValue: { fontSize: font.lg, color: colors.text, fontWeight: weight.semibold },
  metaRow: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  metaText: { fontSize: font.sm, color: colors.textSecondary, textTransform: "capitalize" },
  detailBox: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs },
  detailValue: { fontSize: font.base, color: colors.text, lineHeight: 22 },
  priceCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.text,
  },
  priceLabel: { fontSize: font.sm, color: "rgba(255,255,255,0.7)" },
  priceValue: { fontSize: 32, fontWeight: weight.bold, color: "#fff", marginTop: 2 },
  pricingBadge: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: "#fff", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  pricingBadgeText: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.text },
  sectionTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text, marginBottom: spacing.md },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: font.base, textAlign: "center" },
  bidCard: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  bidHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bidAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text,
    alignItems: "center", justifyContent: "center",
  },
  bidAvatarText: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold },
  bidName: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  bidMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  bidMetaText: { fontSize: font.sm, color: colors.textSecondary },
  bidAmount: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  bidMsg: { fontSize: font.base, color: colors.textSecondary, marginTop: spacing.sm },
  acceptedBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg,
    backgroundColor: "#F0FDF4", borderRadius: radius.md,
  },
  acceptedText: { flex: 1, color: colors.text, fontSize: font.base, lineHeight: 20 },
});
