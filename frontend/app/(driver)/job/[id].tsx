import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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
import { Input } from "@/src/components/Input";
import MapView from "@/src/components/MapView";
import { StatusPill } from "@/src/components/StatusPill";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function DriverJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMsg, setBidMsg] = useState("");
  const [eta, setEta] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [feePreview, setFeePreview] = useState<{
    driver_charge: number;
    booking_fee: number;
    customer_total: number;
  } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const j = await api(`/jobs/${id}`);
      setJob(j);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live booking-fee preview while typing (or from job.fixed_price for fixed jobs)
  useEffect(() => {
    const dc = Number(bidAmount) || Number(job?.fixed_price);
    if (!dc || Number.isNaN(dc) || dc <= 0) {
      setFeePreview(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r: any = await api(`/booking-fees/preview?driver_charge=${dc}`);
        if (!cancelled) setFeePreview(r);
      } catch {
        if (!cancelled) setFeePreview(null);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [bidAmount, job?.fixed_price]);

  async function accept() {
    setErr(null);
    setSubmitting(true);
    try {
      await api(`/jobs/${id}/accept`, { method: "POST" });
      router.replace("/(driver)/my-jobs");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitBid() {
    setErr(null);
    if (!bidAmount) return;
    setSubmitting(true);
    try {
      await api(`/jobs/${id}/bids`, {
        method: "POST",
        body: {
          amount: Number(bidAmount),
          message: bidMsg || undefined,
          eta_hours: eta ? Number(eta) : undefined,
        },
      });
      router.replace("/(driver)/my-jobs");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
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

  const pendingApproval = user?.status === "pending";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="driver-job-back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Job Details</Text>
        <StatusPill status={job.status} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.category}>{job.category.replace("_", " ")}</Text>

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
                <Text style={styles.routeLabel}>Pickup town</Text>
                <Text style={styles.routeValue}>{job.pickup_town}</Text>
              </View>
            </View>
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: colors.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Dropoff town</Text>
                <Text style={styles.routeValue}>{job.dropoff_town}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {job.distance_miles} mi · {job.weight_kg ? `${job.weight_kg}kg` : "Weight not specified"}
              </Text>
            </View>
          </View>

          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailValue}>{job.description || "—"}</Text>
          </View>

          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>
                {job.pricing_type === "fixed" ? "Fixed price" : "Max budget"}
              </Text>
              <Text style={styles.priceValue}>
                £{Number(job.fixed_price || job.max_budget || job.suggested_price).toFixed(0)}
              </Text>
            </View>
          </View>

          <View style={styles.lockNotice}>
            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
            <Text style={styles.lockText}>
              Customer details unlock after they pay the deposit.
            </Text>
          </View>

          {pendingApproval && (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={18} color={colors.warning} />
              <Text style={styles.warningText}>
                Approval required. Upload documents to accept jobs.
              </Text>
            </View>
          )}

          {!pendingApproval && job.status === "posted" && job.pricing_type === "bidding" && (
            <View style={styles.bidBox}>
              <Text style={styles.bidBoxTitle}>Enter Your Bid</Text>
              <Text style={styles.bidBoxHint}>
                This is what you&apos;ll receive after the delivery. Cargo One&apos;s booking fee is added on top.
              </Text>
              <Input
                label="Your bid (£)"
                value={bidAmount}
                onChangeText={setBidAmount}
                keyboardType="numeric"
                placeholder="150"
                testID="driver-bid-amount"
              />

              {feePreview && (
                <View style={styles.breakdown} testID="bid-breakdown">
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Your Bid</Text>
                    <Text style={styles.breakdownDriver}>
                      £{feePreview.driver_charge.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Cargo One Booking Fee</Text>
                    <Text style={styles.breakdownFee}>
                      £{feePreview.booking_fee.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                    <Text style={styles.breakdownTotalLabel}>Customer Pays</Text>
                    <Text style={styles.breakdownTotal}>
                      £{feePreview.customer_total.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <Input
                label="ETA (hours, optional)"
                value={eta}
                onChangeText={setEta}
                keyboardType="numeric"
                placeholder="24"
                testID="driver-bid-eta"
              />
              <Input
                label="Message (optional)"
                value={bidMsg}
                onChangeText={setBidMsg}
                placeholder="Add a message to the customer"
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: "top" }}
                testID="driver-bid-message"
              />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Button
                title="Place Bid"
                onPress={submitBid}
                loading={submitting}
                testID="driver-bid-submit"
              />
            </View>
          )}

          {!pendingApproval && job.status === "posted" && job.pricing_type === "fixed" && (
            <View>
              <View style={styles.acceptFixed}>
                <View style={styles.acceptRow}>
                  <Text style={styles.acceptLabel}>You&apos;ll receive</Text>
                  <Text style={styles.acceptDriver}>£{Number(job.fixed_price).toFixed(2)}</Text>
                </View>
                {feePreview && (
                  <>
                    <View style={styles.acceptRow}>
                      <Text style={styles.acceptLabel}>Cargo One Booking Fee (customer pays)</Text>
                      <Text style={styles.acceptFee}>£{feePreview.booking_fee.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.acceptRow, { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
                      <Text style={styles.acceptLabel}>Customer pays total</Text>
                      <Text style={styles.acceptTotal}>£{feePreview.customer_total.toFixed(2)}</Text>
                    </View>
                  </>
                )}
              </View>
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Button
                title={`Accept — Earn £${Number(job.fixed_price).toFixed(0)}`}
                onPress={accept}
                loading={submitting}
                testID="driver-accept-fixed"
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  title: { fontSize: 26, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.4 },
  category: { fontSize: font.base, color: colors.textSecondary, textTransform: "capitalize" },
  map: { height: 200, borderRadius: radius.lg, overflow: "hidden", marginTop: spacing.sm },
  routeBox: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.bgSecondary, gap: spacing.md },
  routeItem: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  routeValue: { fontSize: font.lg, color: colors.text, fontWeight: weight.semibold },
  metaRow: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  metaText: { fontSize: font.sm, color: colors.textSecondary, textTransform: "capitalize" },
  detailBox: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  detailLabel: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  detailValue: { fontSize: font.base, color: colors.text, lineHeight: 22 },
  priceCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.text },
  priceLabel: { fontSize: font.sm, color: "rgba(255,255,255,0.7)" },
  priceValue: { fontSize: 32, fontWeight: weight.bold, color: "#fff", marginTop: 2 },
  lockNotice: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md,
  },
  lockText: { fontSize: font.sm, color: colors.textSecondary, flex: 1 },
  warningCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md,
    backgroundColor: "#FFFBEB", borderRadius: radius.md, borderWidth: 1, borderColor: "#FDE68A",
  },
  warningText: { flex: 1, fontSize: font.base, color: colors.text },
  bidBox: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  bidBoxTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  bidBoxHint: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 18 },
  breakdown: {
    padding: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    gap: spacing.sm, marginBottom: spacing.sm,
  },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { fontSize: font.base, color: colors.textSecondary },
  breakdownDriver: { fontSize: font.lg, color: colors.text, fontWeight: weight.bold },
  breakdownFee: { fontSize: font.base, color: colors.brand, fontWeight: weight.semibold },
  breakdownTotalRow: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  breakdownTotalLabel: { fontSize: font.base, color: colors.text, fontWeight: weight.semibold },
  breakdownTotal: { fontSize: font.xl, color: colors.success, fontWeight: weight.bold },
  acceptFixed: {
    padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.bgSecondary,
    gap: spacing.sm, marginBottom: spacing.md,
  },
  acceptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  acceptLabel: { fontSize: font.base, color: colors.textSecondary, flex: 1, marginRight: spacing.sm },
  acceptDriver: { fontSize: font.xxl, color: colors.text, fontWeight: weight.bold, letterSpacing: -0.3 },
  acceptFee: { fontSize: font.base, color: colors.brand, fontWeight: weight.semibold },
  acceptTotal: { fontSize: font.xl, color: colors.success, fontWeight: weight.bold },
  err: { color: colors.error, marginBottom: spacing.sm },
});
