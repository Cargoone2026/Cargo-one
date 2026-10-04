/**
 * CargoOne Driver — Job Detail.
 *
 * Faithful mobile adaptation of /driver/job/:id
 * (frontend/src/pages/portal/driver/JobDetail.jsx). Shows the
 * full posted-job context so a driver can decide to Accept or Bid.
 *
 * API usage (from mobile/packages/core):
 *   DriverAPI.jobDetail(id)        → GET /jobs/:id        (full job)
 *   DriverAPI.acceptFixedPrice(id) → POST /jobs/:id/accept (fixed price)
 *   DriverAPI.submitBid(id, amt)   → POST /jobs/:id/bids   (bidding)
 *
 * After Accept: navigate home — the booking appears in the dashboard's
 * Upcoming Jobs card and in My Jobs (both of which are already live).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { DriverAPI, type Job } from "@cargoone/core";
import {
  Page, PageHeader, Section, Card, Icon, IconButton, PrimaryButton,
  SecondaryButton, Caption, colors, radius, space, typography,
} from "../ui";
import { RouteMap, MapFallback } from "../components/RouteMap";
import type { RootStackParamList } from "../App";

type Route = RouteProp<RootStackParamList, "JobDetail">;

export default function JobDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<Route>();
  const { jobId } = route.params || ({} as any);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bidOpen, setBidOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const j = await DriverAPI.jobDetail(jobId);
      setJob(j || null);
    } catch (e: any) {
      setError(e?.message || "Couldn't load this job.");
    }
  }, [jobId]);

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, [load]);

  const onAccept = useCallback(async () => {
    if (!job) return;
    setSubmitting(true);
    try {
      await DriverAPI.acceptFixedPrice(job.id!);
      Alert.alert(
        "Job accepted",
        "The customer has been notified. Open My Jobs to see this booking.",
        [{ text: "OK", onPress: () => nav.navigate("MyJobs") }],
      );
    } catch (e: any) {
      Alert.alert("Couldn't accept", e?.message || "Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }, [job, nav]);

  const onSubmitBid = useCallback(async () => {
    if (!job) return;
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Enter a valid bid", "Your bid must be a positive amount in £.");
      return;
    }
    setSubmitting(true);
    try {
      await DriverAPI.submitBid(job.id!, amount, bidMessage.trim() || undefined);
      Alert.alert(
        "Bid placed",
        "The customer will review bids and respond shortly.",
        [{ text: "OK", onPress: () => { setBidOpen(false); nav.goBack(); } }],
      );
    } catch (e: any) {
      Alert.alert("Couldn't place bid", e?.message || "Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }, [job, bidAmount, bidMessage, nav]);

  // Phase 9: scroll bid section into view when the amount input focuses
  // so the iOS numeric keyboard never covers it. These hooks must run on
  // every render (including loading/error) — never place them after an
  // early return, or React will throw "Rendered more hooks than…".
  const scrollRef = useRef<ScrollView>(null);
  const bidY = useRef(0);
  const onBidFocus = useCallback(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: Math.max(0, bidY.current - 24), animated: true }),
    );
  }, []);

  if (loading) {
    return (
      <Page testID="driver-job-detail-loading">
        <PageHeader title="Job" onBack={() => nav.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </Page>
    );
  }

  if (error || !job) {
    return (
      <Page testID="driver-job-detail-error">
        <PageHeader title="Job" onBack={() => nav.goBack()} />
        <Section>
          <Card style={styles.errorCard}>
            <Icon name="alert-triangle" size={20} color={colors.error} />
            <Text style={{ fontSize: 14, color: colors.error }}>
              {error || "This job is no longer available."}
            </Text>
            <PrimaryButton title="Try again" onPress={load} testID="driver-job-detail-retry" />
          </Card>
        </Section>
      </Page>
    );
  }

  const isFixed = job.pricing_type === "fixed";
  const price = isFixed ? job.fixed_price : ((job as any).max_budget ?? (job as any).suggested_price ?? 0);
  const photos = Array.isArray((job as any).photos) ? ((job as any).photos as string[]) : [];

  return (
    <Page testID="driver-job-detail" scroll={false}>
      <PageHeader
        title="Job"
        onBack={() => nav.goBack()}
        right={
          <IconButton onPress={load} accessibilityLabel="Refresh" testID="driver-job-detail-refresh">
            <Icon name="refresh-cw" size={20} />
          </IconButton>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: space[8] }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          showsVerticalScrollIndicator={false}
        >

      <Section>
        {/* Header — title, category, price */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={typography.h1} numberOfLines={2}>{job.title}</Text>
              <Text style={[typography.caption, { marginTop: 4, textTransform: "capitalize" }]}>
                {(job.category || "").replace(/_/g, " ")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={typography.priceBig}>£{Number(price || 0).toFixed(0)}</Text>
              <Text style={typography.micro}>{isFixed ? "FIXED" : "MAX"}</Text>
            </View>
          </View>
        </Card>

        {/* Map preview — pickup → dropoff. Falls back cleanly when the
            backend hasn't geocoded one or both ends. */}
        {Number.isFinite((job as any).pickup_lat)
          && Number.isFinite((job as any).pickup_lng)
          && Number.isFinite((job as any).dropoff_lat)
          && Number.isFinite((job as any).dropoff_lng) ? (
          <RouteMap
            testID="driver-jobdetail-map"
            pickup={{ lat: (job as any).pickup_lat, lng: (job as any).pickup_lng }}
            dropoff={{ lat: (job as any).dropoff_lat, lng: (job as any).dropoff_lng }}
            height={200}
            summary={{
              pickupTown: job.pickup_town,
              dropoffTown: job.dropoff_town,
              distanceMiles: job.distance_miles,
              durationMinutes: (job as any).duration_minutes,
            }}
          />
        ) : (
          <MapFallback
            testID="driver-jobdetail-map-fallback"
            pickupTown={job.pickup_town}
            dropoffTown={job.dropoff_town}
          />
        )}

        {/* Route */}
        <Card>
          <View style={styles.routeRow}>
            <View style={styles.greenDot} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={typography.micro}>PICKUP</Text>
              <Text style={typography.strong} numberOfLines={1}>{job.pickup_town || "—"}</Text>
              {(job as any).pickup_postcode ? (
                <Caption numberOfLines={1}>{(job as any).pickup_postcode}</Caption>
              ) : null}
            </View>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeRow}>
            <Icon name="map-pin" size={14} color={colors.brand} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={typography.micro}>DROP-OFF</Text>
              <Text style={typography.strong} numberOfLines={1}>{job.dropoff_town || "—"}</Text>
              {(job as any).dropoff_postcode ? (
                <Caption numberOfLines={1}>{(job as any).dropoff_postcode}</Caption>
              ) : null}
            </View>
          </View>
          <View style={styles.metaRow}>
            {typeof job.distance_miles === "number" ? (
              <MetaChip>{job.distance_miles} mi job</MetaChip>
            ) : null}
            {typeof (job as any).distance_from_driver === "number" ? (
              <MetaChip>{(job as any).distance_from_driver} mi away</MetaChip>
            ) : null}
            <MetaChip>{((job as any).service_timing || "scheduled").toUpperCase()}</MetaChip>
          </View>
        </Card>

        {/* Description */}
        {job.description ? (
          <Card>
            <Text style={typography.cardTitle}>Description</Text>
            <Text style={[typography.body, { marginTop: space[2], lineHeight: 20 }]}>
              {job.description}
            </Text>
          </Card>
        ) : null}

        {/* Photos */}
        {photos.length > 0 ? (
          <Card>
            <Text style={typography.cardTitle}>Customer photos</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space[2], marginTop: space[2] }}
              testID="driver-job-detail-photos"
            >
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} />
              ))}
            </ScrollView>
          </Card>
        ) : null}

        {/* Vehicle / requirements */}
        <Card>
          <Text style={typography.cardTitle}>Requirements</Text>
          <View style={{ marginTop: space[2], gap: space[2] }}>
            {(job as any).recommended_vehicle ? (
              <RequirementRow
                icon="truck"
                label="Suitable vehicle"
                value={String((job as any).recommended_vehicle)}
              />
            ) : null}
            {Array.isArray((job as any).required_capabilities) && (job as any).required_capabilities.length > 0 ? (
              <RequirementRow
                icon="award"
                label="Required capabilities"
                value={(job as any).required_capabilities.map((c: string) => c.replace(/_/g, " ")).join(", ")}
              />
            ) : null}
            {(job as any).needs_forklift ? (
              <RequirementRow icon="package" label="Cargo aid" value="Forklift required" />
            ) : null}
            {(job as any).needs_loading_help ? (
              <RequirementRow icon="users" label="Cargo aid" value="Loading help required" />
            ) : null}
            {(job as any).service_type ? (
              <RequirementRow
                icon="briefcase"
                label="Service"
                value={String((job as any).service_type).replace(/_/g, " ")}
              />
            ) : null}
          </View>
        </Card>

        {/* Actions */}
        {!bidOpen ? (
          <View style={{ paddingHorizontal: space[4], gap: space[3] }}>
            {isFixed ? (
              <PrimaryButton
                title="Accept this job"
                onPress={onAccept}
                loading={submitting}
                testID="driver-job-detail-accept"
              />
            ) : (
              <PrimaryButton
                title="Place a bid"
                onPress={() => {
                  const starter =
                    (job as any).suggested_price != null ? String((job as any).suggested_price) :
                    (job as any).max_budget      != null ? String((job as any).max_budget)      : "";
                  setBidAmount(starter);
                  setBidOpen(true);
                }}
                testID="driver-job-detail-bid"
              />
            )}
            <SecondaryButton
              title="Not now"
              onPress={() => nav.goBack()}
              testID="driver-job-detail-cancel"
            />
          </View>
        ) : (
          <View onLayout={(e: any) => { bidY.current = e.nativeEvent.layout.y; }}>
          <Card>
            <Text style={typography.cardTitle}>Your bid</Text>
            <Caption style={{ marginTop: 4 }}>
              Up to £{Number((job as any).max_budget ?? (job as any).suggested_price ?? 0).toFixed(0)} max.
              Customers accept the best mix of price, timing and driver rating.
            </Caption>
            <View style={styles.bidAmountRow}>
              <Text style={styles.bidCurrency}>£</Text>
              <TextInput
                value={bidAmount}
                onChangeText={setBidAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.inkFaint}
                style={styles.bidAmountInput}
                onFocus={onBidFocus}
                testID="driver-bid-amount"
              />
            </View>
            <TextInput
              value={bidMessage}
              onChangeText={setBidMessage}
              placeholder="Optional note to the customer…"
              placeholderTextColor={colors.inkFaint}
              style={styles.bidMessage}
              multiline
              onFocus={onBidFocus}
              testID="driver-bid-message"
            />
            <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setBidOpen(false)}
                testID="driver-bid-cancel"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Submit bid"
                onPress={onSubmitBid}
                loading={submitting}
                testID="driver-bid-submit"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
          </View>
        )}
      </Section>
      </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}

function RequirementRow({
  icon, label, value,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.reqRow}>
      <View style={styles.reqIcon}>
        <Icon name={icon} size={16} color={colors.inkMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.inkMuted, letterSpacing: 0.6, textTransform: "uppercase" }}>
          {label}
        </Text>
        <Text style={[typography.body, { marginTop: 2, textTransform: "capitalize" }]}>{value}</Text>
      </View>
    </View>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  errorCard: { gap: space[3], alignItems: "flex-start" },

  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
  },
  routeDivider: {
    height: 20, width: 1,
    backgroundColor: colors.border,
    marginLeft: 4, marginVertical: 6,
  },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success, marginTop: 4 },

  metaRow: {
    flexDirection: "row", flexWrap: "wrap", gap: space[2],
    marginTop: space[3], paddingTop: space[2],
    borderTopWidth: 1, borderTopColor: colors.hairline,
  },
  metaChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.bgSecondary,
  },
  metaChipText: { fontSize: 12, color: colors.inkMuted, fontWeight: "500" },

  photo: {
    width: 128, height: 96, borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1, borderColor: colors.border,
  },

  reqRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  reqIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
  },

  bidAmountRow: {
    marginTop: space[3],
    flexDirection: "row", alignItems: "center", gap: space[2],
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.base,
    backgroundColor: colors.bg, paddingHorizontal: 14, paddingVertical: 10,
  },
  bidCurrency: { fontSize: 28, fontWeight: "700", color: colors.inkMuted },
  bidAmountInput: {
    flex: 1, fontSize: 28, fontWeight: "700",
    color: colors.ink, padding: 0, margin: 0,
  },
  bidMessage: {
    marginTop: space[3],
    minHeight: 72,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.base,
    backgroundColor: colors.bg,
    paddingHorizontal: 14, paddingVertical: 10,
    textAlignVertical: "top",
    fontSize: 14, color: colors.ink,
  },
});
