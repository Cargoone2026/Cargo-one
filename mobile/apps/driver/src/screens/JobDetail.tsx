/**
 * JobDetailScreen — Cargo One Driver Job Detail.
 *
 * Faithful port of the web page (frontend/src/pages/portal/driver/JobDetail.jsx)
 * feature-for-feature:
 *
 *   • GET /jobs/:id via DriverAPI.jobDetail.
 *   • Header: chevron-back + title + status pill.
 *   • Title, category label.
 *   • Compact @rnmapbox/maps route map (pickup pin + dropoff pin) —
 *     mirrors the web `RouteMap` component. Uses the same
 *     `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` as the P1-a AvailableJobs map.
 *   • Route summary card (pickup town / dropoff town / distance + weight).
 *   • Description card.
 *   • AcceptanceInfo (suitable vehicle + required capabilities) —
 *     inlined to match dense structure since the shared web component
 *     is not portable.
 *   • JobExtras (dimensions, forklift, loading help, item count) —
 *     inlined for the same reason; renders only the fields the backend
 *     actually returns for the job.
 *   • Customer photo gallery (grid + full-screen viewer on tap).
 *   • Dark price block ("Fixed price" or "Max budget").
 *   • Lock notice ("Customer details unlock after deposit").
 *   • Pending-approval banner when user.status === "pending".
 *   • Bidding box when pricing_type === "bidding" && status === "posted":
 *       - Amount input (required), ETA input (optional, hours),
 *         message textarea (optional). Live fee-preview under Amount,
 *         debounced 250 ms — identical shape to web (BreakRow rows).
 *   • Accept box when pricing_type === "fixed" && status === "posted":
 *       - "You'll receive £X" + fee preview.
 *       - "Accept — Earn £X" CTA.
 *   • On success (both flows): navigate to MyJobs, replacing the stack
 *     so Back doesn't return here.
 *   • Errors surface inline; already-accepted / unavailable jobs are
 *     handled cleanly (status pill + no CTAs).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Mapbox from "@rnmapbox/maps";
import {
  AlertTriangle,
  ChevronLeft,
  Lock,
  X as XIcon,
} from "lucide-react-native";
import { DriverAPI, type FeePreview, type Job } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { Page, StatusPill } from "../ui";
import type { RootStackParamList } from "../App";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

type J = Job & Record<string, any>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function JobDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "JobDetail">>();
  const { user } = useAuth();
  const jobId = route.params?.jobId;

  const [job, setJob] = useState<J | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fee, setFee] = useState<FeePreview | null>(null);

  const [bidAmount, setBidAmount] = useState("");
  const [bidMsg, setBidMsg] = useState("");
  const [eta, setEta] = useState("");

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const j = await DriverAPI.jobDetail(jobId);
      setJob(j as J);
    } catch (e: any) {
      setJob(null);
      setErr(e?.message || "Could not load job");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced fee preview — matches web (250 ms).
  useEffect(() => {
    const dc = Number(bidAmount) || Number(job?.fixed_price);
    if (!dc || Number.isNaN(dc) || dc <= 0) {
      setFee(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await DriverAPI.feePreview(dc);
        if (!cancelled) setFee(r);
      } catch {
        if (!cancelled) setFee(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bidAmount, job?.fixed_price]);

  const accept = async () => {
    if (!jobId) return;
    setErr(null);
    setSubmitting(true);
    try {
      await DriverAPI.acceptFixedPrice(jobId);
      // Same UX as web: land on My Jobs, remove JobDetail from stack.
      (nav as any).reset({ index: 0, routes: [{ name: "MyJobs" }] });
    } catch (e: any) {
      setErr(e?.message || "Could not accept job");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBid = async () => {
    if (!jobId) return;
    setErr(null);
    const amountNum = Number(bidAmount);
    if (!bidAmount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      setErr("Enter a valid bid amount.");
      return;
    }
    setSubmitting(true);
    try {
      const etaNum = eta ? Number(eta) : undefined;
      await DriverAPI.submitBid(
        jobId,
        amountNum,
        bidMsg.trim() ? bidMsg.trim() : undefined,
        etaNum && !Number.isNaN(etaNum) ? etaNum : undefined,
      );
      (nav as any).reset({ index: 0, routes: [{ name: "MyJobs" }] });
    } catch (e: any) {
      setErr(e?.message || "Could not place bid");
    } finally {
      setSubmitting(false);
    }
  };

  if (!job) {
    return (
      <Page testID="driver-job-detail">
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={styles.backBtn}
            testID="driver-job-back"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
          {loading ? (
            <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
              <ActivityIndicator color={colors.brand} />
              <Text style={typography.bodyMuted}>Loading job…</Text>
            </View>
          ) : (
            <Text style={typography.bodyMuted}>Job not found.</Text>
          )}
          {err ? <Text style={styles.errText}>{err}</Text> : null}
        </ScrollView>
      </Page>
    );
  }

  const pendingApproval = user?.status === "pending";
  const bidding = job.pricing_type === "bidding";
  const posted = job.status === "posted";
  const photos: string[] = Array.isArray(job.photos) ? job.photos : [];
  const heroPrice = Number(job.fixed_price || job.max_budget || job.suggested_price || 0);
  const priceLabel = job.pricing_type === "fixed" ? "Fixed price" : "Max budget";

  return (
    <Page testID="driver-job-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => nav.goBack()}
            style={styles.backBtn}
            testID="driver-job-back"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Job Details</Text>
          <StatusPill status={job.status} />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobCategory}>{String(job.category || "").replace(/_/g, " ")}</Text>

          {/* Compact route map */}
          <JobRouteMap job={job} />

          {/* Route summary */}
          <View style={styles.routeCard}>
            <RouteRow color="#16A34A" label="Pickup town" value={job.pickup_town || "—"} />
            <View style={{ height: 8 }} />
            <RouteRow color="#D62828" label="Dropoff town" value={job.dropoff_town || "—"} />
            <View style={styles.divider} />
            <Text style={{ fontSize: 13, color: colors.inkMuted }}>
              {job.distance_miles != null ? `${Number(job.distance_miles).toFixed(0)} mi` : "Distance unknown"}
              {" · "}
              {job.weight_kg ? `${job.weight_kg}kg` : "Weight not specified"}
            </Text>
          </View>

          {/* Description */}
          <View style={styles.plainCard}>
            <Text style={styles.kicker}>Description</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 }}>
              {job.description || "—"}
            </Text>
          </View>

          {/* AcceptanceInfo (suitable vehicle + capabilities) */}
          <AcceptanceInfoBlock job={job} />

          {/* JobExtras */}
          <JobExtrasBlock job={job} />

          {/* Customer photos */}
          {photos.length > 0 ? (
            <View style={styles.plainCard}>
              <Text style={styles.kicker}>Customer photos</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingTop: 10 }}
                testID="driver-job-photos"
              >
                {photos.map((p, i) => (
                  <Pressable
                    key={`${p}-${i}`}
                    onPress={() => {
                      setGalleryIndex(i);
                      setGalleryOpen(true);
                    }}
                    testID={`driver-job-photo-${i}`}
                  >
                    <Image
                      source={{ uri: p }}
                      style={styles.photoThumb}
                      onError={() => {
                        /* Silent — a missing photo is not a screen error. */
                      }}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Dark price block */}
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>{priceLabel}</Text>
            <Text style={styles.priceValue}>£{heroPrice.toFixed(0)}</Text>
          </View>

          {/* Lock notice */}
          <View style={styles.lockNotice} testID="lock-notice">
            <Lock size={16} color={colors.inkMuted} />
            <Text style={{ fontSize: 13, color: colors.inkMuted, flex: 1 }}>
              Customer details unlock after they pay the deposit.
            </Text>
          </View>

          {/* Pending-approval banner */}
          {pendingApproval ? (
            <View style={styles.pendingBanner} testID="pending-approval-warning">
              <AlertTriangle size={18} color="#F59E0B" />
              <Text style={{ fontSize: 13, color: "#78350F", flex: 1 }}>
                Approval required. Upload documents to accept jobs.
              </Text>
            </View>
          ) : null}

          {/* Bidding box */}
          {!pendingApproval && posted && bidding ? (
            <View style={styles.actionCard} testID="bid-box">
              <View>
                <Text style={styles.actionTitle}>Enter Your Bid</Text>
                <Text style={styles.actionHelp}>
                  This is what you'll receive after the delivery. Cargo One's booking fee is added
                  on top.
                </Text>
              </View>

              <LabeledInput
                label="Your bid (£)"
                value={bidAmount}
                onChangeText={setBidAmount}
                placeholder="150"
                keyboardType="decimal-pad"
                testID="driver-bid-amount"
              />

              {fee ? (
                <View style={styles.breakdown} testID="bid-breakdown">
                  <BreakRow label="Your Bid" value={`£${fee.driver_charge.toFixed(2)}`} strong />
                  <BreakRow
                    label="Cargo One Booking Fee"
                    value={`£${fee.booking_fee.toFixed(2)}`}
                    accent="#D62828"
                  />
                  <View style={styles.divider} />
                  <BreakRow
                    label="Customer Pays"
                    value={`£${fee.customer_total.toFixed(2)}`}
                    big
                  />
                </View>
              ) : null}

              <LabeledInput
                label="ETA (hours, optional)"
                value={eta}
                onChangeText={setEta}
                placeholder="24"
                keyboardType="numeric"
                testID="driver-bid-eta"
              />

              <View>
                <Text style={styles.inputLabel}>Message (optional)</Text>
                <TextInput
                  value={bidMsg}
                  onChangeText={setBidMsg}
                  placeholder="Add a message to the customer"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                  testID="driver-bid-message"
                />
              </View>

              {err ? (
                <Text style={styles.errText} testID="bid-error">
                  {err}
                </Text>
              ) : null}

              <Pressable
                onPress={submitBid}
                disabled={submitting}
                style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
                testID="driver-bid-submit"
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Place Bid</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* Accept fixed box */}
          {!pendingApproval && posted && !bidding ? (
            <View style={{ gap: 12 }}>
              <View style={styles.breakdown} testID="accept-fixed-box">
                <BreakRow
                  label="You'll receive"
                  value={`£${Number(job.fixed_price || 0).toFixed(2)}`}
                  big
                />
                {fee ? (
                  <>
                    <BreakRow
                      label="Cargo One Booking Fee (customer pays)"
                      value={`£${fee.booking_fee.toFixed(2)}`}
                      accent="#D62828"
                    />
                    <View style={styles.divider} />
                    <BreakRow
                      label="Customer pays total"
                      value={`£${fee.customer_total.toFixed(2)}`}
                      strong
                    />
                  </>
                ) : null}
              </View>
              {err ? (
                <Text style={styles.errText} testID="accept-error">
                  {err}
                </Text>
              ) : null}
              <Pressable
                onPress={accept}
                disabled={submitting}
                style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
                testID="driver-accept-fixed"
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    Accept — Earn £{Number(job.fixed_price || 0).toFixed(0)}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* Non-posted jobs: read-only, no action buttons. Web has the
              same behaviour by conditionally omitting the accept/bid box. */}
          {!posted ? (
            <View style={[styles.plainCard, { alignItems: "center" }]}>
              <Text style={{ fontSize: 13, color: colors.inkMuted, textAlign: "center" }}>
                This job is no longer available for acceptance.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Full-screen photo viewer */}
      <PhotoViewer
        open={galleryOpen}
        photos={photos}
        index={galleryIndex}
        onIndex={setGalleryIndex}
        onClose={() => setGalleryOpen(false)}
      />
    </Page>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */

function RouteRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.kickerSmall}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>{value}</Text>
      </View>
    </View>
  );
}

function BreakRow({
  label,
  value,
  strong,
  big,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
  accent?: string;
}) {
  const valueStyle = big
    ? { fontSize: 20, fontWeight: "700" as const, color: accent || "#16A34A" }
    : strong
    ? { fontSize: 16, fontWeight: "700" as const, color: accent || colors.ink }
    : { fontSize: 14, fontWeight: "600" as const, color: accent || colors.ink };
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ fontSize: 13, color: colors.inkMuted }}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  testID?: string;
}) {
  return (
    <View>
      <Text style={styles.inputLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={props.keyboardType}
        style={styles.input}
        testID={props.testID}
      />
    </View>
  );
}

function JobRouteMap({ job }: { job: J }) {
  const hasPickup = Number.isFinite(job.pickup_lat) && Number.isFinite(job.pickup_lng);
  const hasDropoff = Number.isFinite(job.dropoff_lat) && Number.isFinite(job.dropoff_lng);
  const centre: [number, number] = hasPickup
    ? [Number(job.pickup_lng), Number(job.pickup_lat)]
    : hasDropoff
    ? [Number(job.dropoff_lng), Number(job.dropoff_lat)]
    : [-0.1278, 51.5074];
  if (!hasPickup && !hasDropoff) return null;
  return (
    <View style={styles.mapWrap} testID="driver-jobdetail-map">
      <Mapbox.MapView style={StyleSheet.absoluteFillObject} styleURL={Mapbox.StyleURL.Street}>
        <Mapbox.Camera zoomLevel={8} centerCoordinate={centre} animationDuration={0} />
        {hasPickup ? (
          <Mapbox.PointAnnotation
            id="pickup"
            coordinate={[Number(job.pickup_lng), Number(job.pickup_lat)]}
          >
            <View style={[styles.mapPin, { backgroundColor: "#16A34A" }]}>
              <Text style={styles.mapPinText}>P</Text>
            </View>
          </Mapbox.PointAnnotation>
        ) : null}
        {hasDropoff ? (
          <Mapbox.PointAnnotation
            id="dropoff"
            coordinate={[Number(job.dropoff_lng), Number(job.dropoff_lat)]}
          >
            <View style={[styles.mapPin, { backgroundColor: colors.brand }]}>
              <Text style={styles.mapPinText}>D</Text>
            </View>
          </Mapbox.PointAnnotation>
        ) : null}
      </Mapbox.MapView>
    </View>
  );
}

function AcceptanceInfoBlock({ job }: { job: J }) {
  const suitable = job.recommended_vehicle || job.vehicle_label;
  const caps: string[] = Array.isArray(job.required_capabilities) ? job.required_capabilities : [];
  const isRecovery = String(job.service_type || "") === "breakdown_recovery" || job.service_type === "recovery";
  if (!suitable && caps.length === 0) return null;
  return (
    <View style={styles.plainCard} testID="driver-jobdetail-accept-block">
      {suitable ? (
        <View style={{ marginBottom: caps.length ? 10 : 0 }}>
          <Text style={styles.kicker}>{isRecovery ? "Recovery vehicle required" : "Suitable vehicle"}</Text>
          <Text style={{ fontSize: 14, color: colors.ink, marginTop: 4 }} testID="driver-jobdetail-accept-vehicle">
            {suitable}
          </Text>
        </View>
      ) : null}
      {caps.length > 0 ? (
        <View>
          <Text style={styles.kicker}>Required capabilities</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {caps.map((c) => (
              <View key={c} style={styles.capChip} testID={`driver-jobdetail-cap-${c}`}>
                <Text style={styles.capChipText}>{c.replace(/_/g, " ")}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function JobExtrasBlock({ job }: { job: J }) {
  const chips: { label: string; testID: string; tone?: "amber" | "red" }[] = [];
  if (job.needs_forklift) chips.push({ label: "Forklift required", testID: "extras-forklift", tone: "amber" });
  if (job.needs_loading_help || job.loading_help)
    chips.push({ label: "Loading help", testID: "extras-loading-help", tone: "amber" });
  if (job.item_count) chips.push({ label: `${job.item_count} item(s)`, testID: "extras-item-count" });
  if (job.pallets) chips.push({ label: `${job.pallets} pallet(s)`, testID: "extras-pallets" });
  if (job.volume_m3) chips.push({ label: `${job.volume_m3} m³`, testID: "extras-volume" });
  if (job.dimensions) chips.push({ label: String(job.dimensions), testID: "extras-dimensions" });
  else if (job.dimensions_l_m || job.dimensions_w_m || job.dimensions_h_m)
    chips.push({
      label: `${job.dimensions_l_m || "?"} × ${job.dimensions_w_m || "?"} × ${job.dimensions_h_m || "?"} m`,
      testID: "extras-dimensions",
    });
  if (chips.length === 0) return null;
  return (
    <View style={styles.plainCard} testID="driver-jobdetail-extras">
      <Text style={styles.kicker}>Load details</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {chips.map((c) => (
          <View
            key={c.testID}
            style={[
              styles.capChip,
              c.tone === "amber" && { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
              c.tone === "red" && { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
            ]}
            testID={c.testID}
          >
            <Text
              style={[
                styles.capChipText,
                c.tone === "amber" && { color: "#78350F" },
                c.tone === "red" && { color: "#7F1D1D" },
              ]}
            >
              {c.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PhotoViewer({
  open,
  photos,
  index,
  onIndex,
  onClose,
}: {
  open: boolean;
  photos: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  if (!open || photos.length === 0) return null;
  const clamped = Math.max(0, Math.min(index, photos.length - 1));
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <Pressable
          onPress={onClose}
          style={styles.viewerClose}
          testID="driver-job-photos-close"
          accessibilityLabel="Close photo"
        >
          <XIcon size={22} color="#FFFFFF" />
        </Pressable>
        <ScrollView
          horizontal
          pagingEnabled
          contentOffset={{ x: 0, y: 0 }}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const w = e.nativeEvent.layoutMeasurement.width;
            const idx = Math.round(e.nativeEvent.contentOffset.x / w);
            onIndex(idx);
          }}
        >
          {photos.map((p, i) => (
            <View key={`${p}-${i}`} style={styles.viewerPage}>
              <Image source={{ uri: p }} style={styles.viewerImage} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>
        <Text style={styles.viewerCount}>
          {clamped + 1} / {photos.length}
        </Text>
      </View>
    </Modal>
  );
}

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.ink },
  backBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: "#F4F4F4",
    alignItems: "center", justifyContent: "center",
  },
  jobTitle: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  jobCategory: { fontSize: 13, color: colors.inkMuted, textTransform: "capitalize" },

  mapWrap: {
    height: 200, borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1, borderColor: "#E5E7EB",
    marginTop: 4,
  },
  mapPin: {
    width: 28, height: 28, borderRadius: 999,
    borderWidth: 2, borderColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
  mapPinText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  routeCard: {
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    padding: 16,
  },
  plainCard: {
    borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  kicker: {
    fontSize: 11, fontWeight: "700",
    letterSpacing: 1, color: colors.inkMuted,
    textTransform: "uppercase",
  },
  kickerSmall: {
    fontSize: 11, fontWeight: "500",
    letterSpacing: 0.6, color: colors.inkMuted,
    textTransform: "uppercase",
  },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },

  capChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#F4F4F4",
  },
  capChipText: { fontSize: 12, fontWeight: "500", color: colors.ink, textTransform: "capitalize" },

  photoThumb: {
    width: 88, height: 88,
    borderRadius: 10,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#F4F4F4",
  },

  priceBlock: {
    padding: 16, borderRadius: 12,
    backgroundColor: "#111111",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  priceValue: {
    color: "#FFFFFF",
    fontSize: 28, fontWeight: "700",
    letterSpacing: -0.4,
    marginTop: 2,
  },

  lockNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1, borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },

  actionCard: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  actionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  actionHelp: { fontSize: 13, color: colors.inkMuted, marginTop: 4, lineHeight: 20 },
  inputLabel: {
    fontSize: 13, fontWeight: "600",
    color: colors.ink,
    marginBottom: 4,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
    fontSize: 14, color: colors.ink,
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    minHeight: 88,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
    fontSize: 14, color: colors.ink,
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
  },
  breakdown: {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },

  primaryBtn: {
    height: 48, borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  errText: { fontSize: 13, color: "#DC2626" },

  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  viewerClose: {
    position: "absolute",
    top: 40, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  viewerPage: {
    width: 360, // updated at runtime via flex; kept as an intent-only fallback
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: { width: "100%", height: "100%" },
  viewerCount: {
    position: "absolute",
    bottom: 40, alignSelf: "center",
    color: "#FFFFFF", fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
});
