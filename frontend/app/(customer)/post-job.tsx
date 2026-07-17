import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AddressAutocomplete, PlaceResult } from "@/src/components/AddressAutocomplete";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import MapView from "@/src/components/MapView";
import {
  RecommendedVehicle,
  VehicleType,
  requestRecommendation,
  useCategories,
  useVehicles,
} from "@/src/hooks/useCatalog";
import { colors, font, radius, spacing, weight } from "@/src/theme";

const STEP_COUNT = 5;
const NOT_SURE_KEY = "__not_sure__";

type Quote = {
  distance_miles: number;
  duration_minutes: number;
  suggested_price: number;
  vehicle: string;
  category_key: string;
};

type FeePreview = {
  driver_charge: number;
  booking_fee: number;
  customer_total: number;
};

export default function PostJob() {
  const params = useLocalSearchParams<{ category?: string }>();
  const router = useRouter();
  const { data: categories, loading: catLoading } = useCategories();
  const { data: vehicles, loading: vehLoading } = useVehicles();

  const [step, setStep] = useState(1);
  const [categoryKey, setCategoryKey] = useState<string>(params.category || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pickup, setPickup] = useState<PlaceResult | null>(null);
  const [dropoff, setDropoff] = useState<PlaceResult | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  // Details
  const [weightKg, setWeightKg] = useState("");
  const [lengthM, setLengthM] = useState("");
  const [widthM, setWidthM] = useState("");
  const [heightM, setHeightM] = useState("");
  const [itemCount, setItemCount] = useState("");
  const [needsForklift, setNeedsForklift] = useState(false);
  const [needsLoadingHelp, setNeedsLoadingHelp] = useState(false);
  const [collectionDate, setCollectionDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  // Vehicle
  const [vehicleKey, setVehicleKey] = useState<string>("");
  const [recs, setRecs] = useState<RecommendedVehicle[] | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  // Pricing
  const [pricingType, setPricingType] = useState<"fixed" | "bidding">("bidding");
  const [fixedPrice, setFixedPrice] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.key === categoryKey) || null,
    [categories, categoryKey],
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.key === vehicleKey) || null,
    [vehicles, vehicleKey],
  );

  // Default to first category once loaded
  useEffect(() => {
    if (!categoryKey && categories.length > 0) {
      setCategoryKey(categories[0].key);
    }
  }, [categories, categoryKey]);

  // Live route quote whenever route / category / weight / volume changes
  useEffect(() => {
    if (!pickup || !dropoff || !categoryKey) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const parts: string[] = [
          `pickup_lat=${pickup.lat}`,
          `pickup_lng=${pickup.lng}`,
          `dropoff_lat=${dropoff.lat}`,
          `dropoff_lng=${dropoff.lng}`,
          `category=${encodeURIComponent(categoryKey)}`,
        ];
        if (weightKg) parts.push(`weight_kg=${weightKg}`);
        const vol = volumeFromDims(lengthM, widthM, heightM);
        if (vol) parts.push(`volume_m3=${vol}`);
        const q: Quote = await api(`/quote/estimate?${parts.join("&")}`);
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, categoryKey, weightKg, lengthM, widthM, heightM]);

  // Live booking-fee preview at step 5 as the driver charge changes
  const previewCharge = useMemo(() => {
    if (pricingType === "fixed" && fixedPrice) return Number(fixedPrice);
    if (pricingType === "bidding" && maxBudget) return Number(maxBudget);
    if (quote) return quote.suggested_price;
    return 0;
  }, [pricingType, fixedPrice, maxBudget, quote]);

  useEffect(() => {
    if (step !== 5 || previewCharge <= 0) {
      setFeePreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r: FeePreview = await api(
          `/booking-fees/preview?driver_charge=${encodeURIComponent(previewCharge)}`,
        );
        if (!cancelled) setFeePreview(r);
      } catch {
        if (!cancelled) setFeePreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, previewCharge]);

  // Auto-request recommendation when "Not Sure" chosen
  const requestRec = async () => {
    if (!selectedCategory) return;
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await requestRecommendation({
        category_key: selectedCategory.key,
        weight_kg: weightKg ? Number(weightKg) : null,
        volume_m3: volumeFromDims(lengthM, widthM, heightM),
        dimensions_l_m: lengthM ? Number(lengthM) : null,
        dimensions_w_m: widthM ? Number(widthM) : null,
        dimensions_h_m: heightM ? Number(heightM) : null,
        item_count: itemCount ? Number(itemCount) : null,
        needs_forklift: needsForklift,
        needs_loading_help: needsLoadingHelp,
      });
      setRecs(res.recommendations || []);
    } catch (e: any) {
      setRecError(e?.message || "Could not fetch recommendations");
    } finally {
      setRecLoading(false);
    }
  };

  useEffect(() => {
    if (step === 4 && vehicleKey === NOT_SURE_KEY) requestRec();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, vehicleKey, needsForklift, needsLoadingHelp]);

  const canNext1 = !!categoryKey && title.trim().length > 0;
  const canNext2 = !!pickup && !!dropoff;
  const canNext3 = !!collectionDate && !!deliveryDate;
  const canNext4 = !!vehicleKey && (vehicleKey !== NOT_SURE_KEY || !!recs);
  const canSubmit =
    pricingType === "fixed" ? !!fixedPrice && Number(fixedPrice) > 0 : true;

  const effectiveVehicleKey =
    vehicleKey === NOT_SURE_KEY
      ? recs?.[0]?.key || selectedCategory?.default_vehicles?.[0] || ""
      : vehicleKey;

  async function submit() {
    setErr(null);
    if (!pickup || !dropoff) {
      setErr("Please choose pickup and delivery addresses");
      return;
    }
    if (!selectedCategory) {
      setErr("Please choose a service category");
      return;
    }
    setLoading(true);
    try {
      const body = {
        title: title.trim(),
        category: selectedCategory.key,
        description: description.trim(),
        photos: [],
        pickup_address: pickup.formatted_address,
        pickup_town: pickup.town || pickup.formatted_address.split(",").pop()?.trim() || "",
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: dropoff.formatted_address,
        dropoff_town: dropoff.town || dropoff.formatted_address.split(",").pop()?.trim() || "",
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        weight_kg: weightKg ? Number(weightKg) : null,
        dimensions: [lengthM, widthM, heightM].filter(Boolean).join("×") || null,
        collection_date: collectionDate,
        delivery_date: deliveryDate,
        pricing_type: pricingType,
        fixed_price: pricingType === "fixed" ? Number(fixedPrice) : null,
        max_budget: maxBudget ? Number(maxBudget) : null,
        vehicle_required: effectiveVehicleKey || null,
      };
      const job: any = await api("/jobs", { method: "POST", body });
      router.replace(`/(customer)/job/${job.id}`);
    } catch (e: any) {
      setErr(e.message || "Failed to post job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          hitSlop={12}
          testID="post-job-back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <Text style={styles.stepPill}>Step {step}/{STEP_COUNT}</Text>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(step / STEP_COUNT) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Step 1 — category & title */}
          {step === 1 && (
            <View>
              <Text style={styles.title}>What are you shipping?</Text>
              <Text style={styles.sub}>Pick a service category and give it a title.</Text>

              {catLoading ? (
                <ActivityIndicator style={{ marginVertical: spacing.xl }} color={colors.brand} />
              ) : (
                <View style={styles.catGrid}>
                  {categories.map((c) => {
                    const active = c.key === categoryKey;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => setCategoryKey(c.key)}
                        style={[styles.catCard, active && styles.catCardActive]}
                        testID={`postjob-cat-${c.key}`}
                      >
                        <Ionicons
                          name={c.icon as any}
                          size={22}
                          color={active ? "#fff" : colors.text}
                        />
                        <Text style={[styles.catLabel, active && { color: "#fff" }]} numberOfLines={2}>
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Input
                label="Job title"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. 3-seater sofa delivery"
                testID="postjob-title-input"
                containerStyle={{ marginTop: spacing.lg }}
              />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Add details, notes, or special requirements"
                multiline
                numberOfLines={4}
                style={{ minHeight: 100, textAlignVertical: "top" }}
                testID="postjob-desc-input"
              />
            </View>
          )}

          {/* Step 2 — route */}
          {step === 2 && (
            <View>
              <Text style={styles.title}>Route</Text>
              <Text style={styles.sub}>Search pickup and delivery addresses.</Text>

              <AddressAutocomplete
                label="Pickup address"
                value={pickup}
                placeholder="Search for pickup address"
                onSelect={setPickup}
                testID="pickup-address-picker"
              />
              <AddressAutocomplete
                label="Delivery address"
                value={dropoff}
                placeholder="Search for delivery address"
                onSelect={setDropoff}
                testID="dropoff-address-picker"
              />

              {pickup && dropoff && (
                <View style={styles.routePreview} testID="route-preview">
                  <View style={styles.mapPreview}>
                    <MapView
                      pickup={{ lat: pickup.lat, lng: pickup.lng, label: "Pickup" }}
                      dropoff={{ lat: dropoff.lat, lng: dropoff.lng, label: "Dropoff" }}
                      height={180}
                    />
                  </View>
                  {quote && (
                    <View style={styles.quoteRow}>
                      <QuoteStat label="Distance" value={`${quote.distance_miles} mi`} icon="navigate" />
                      <QuoteStat label="Est. time" value={fmtDur(quote.duration_minutes)} icon="time" />
                      <QuoteStat label="Suggested" value={`£${quote.suggested_price}`} icon="pricetag" />
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Step 3 — details */}
          {step === 3 && (
            <View>
              <Text style={styles.title}>Details</Text>
              <Text style={styles.sub}>These help us match you to the right vehicle & price.</Text>

              <View style={styles.row2}>
                <View style={styles.rowItem}>
                  <Input
                    label="Weight (kg)"
                    value={weightKg}
                    onChangeText={setWeightKg}
                    placeholder="e.g. 250"
                    keyboardType="numeric"
                    testID="postjob-weight-input"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Input
                    label="Item count"
                    value={itemCount}
                    onChangeText={setItemCount}
                    placeholder="e.g. 3"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.groupLabel}>Approximate dimensions (m)</Text>
              <View style={styles.row3}>
                <View style={styles.rowItem}>
                  <Input label="Length" value={lengthM} onChangeText={setLengthM} placeholder="1.2" keyboardType="numeric" />
                </View>
                <View style={styles.rowItem}>
                  <Input label="Width" value={widthM} onChangeText={setWidthM} placeholder="0.8" keyboardType="numeric" />
                </View>
                <View style={styles.rowItem}>
                  <Input label="Height" value={heightM} onChangeText={setHeightM} placeholder="0.9" keyboardType="numeric" />
                </View>
              </View>

              <View style={{ height: spacing.md }} />
              <Toggle
                label="Forklift or loading equipment available at pickup / drop-off?"
                value={needsForklift}
                onChange={setNeedsForklift}
              />
              <Toggle
                label="Loading assistance required (e.g. tail lift, extra hands)?"
                value={needsLoadingHelp}
                onChange={setNeedsLoadingHelp}
              />

              <View style={{ height: spacing.lg }} />
              <View style={styles.row2}>
                <View style={styles.rowItem}>
                  <Input
                    label="Collection date"
                    value={collectionDate}
                    onChangeText={setCollectionDate}
                    placeholder="YYYY-MM-DD"
                    testID="postjob-collection-date"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Input
                    label="Delivery date"
                    value={deliveryDate}
                    onChangeText={setDeliveryDate}
                    placeholder="YYYY-MM-DD"
                    testID="postjob-delivery-date"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Step 4 — vehicle */}
          {step === 4 && (
            <View>
              <Text style={styles.title}>Which vehicle do you need?</Text>
              <Text style={styles.sub}>Choose one, or let our engine recommend the right vehicle.</Text>

              {vehLoading ? (
                <ActivityIndicator style={{ marginVertical: spacing.xl }} color={colors.brand} />
              ) : (
                <View style={styles.vehList}>
                  <VehicleCard
                    active={vehicleKey === NOT_SURE_KEY}
                    onPress={() => setVehicleKey(NOT_SURE_KEY)}
                    name="Not Sure — Recommend for me"
                    description="We'll suggest 2–4 suitable vehicles based on your load."
                    icon="sparkles"
                    highlight
                  />
                  {vehicles.map((v) => (
                    <VehicleCard
                      key={v.key}
                      active={vehicleKey === v.key}
                      onPress={() => setVehicleKey(v.key)}
                      name={v.name}
                      description={v.description}
                      icon={v.icon}
                    />
                  ))}
                </View>
              )}

              {vehicleKey === NOT_SURE_KEY && (
                <View style={styles.recBox}>
                  <View style={styles.recBoxHead}>
                    <Ionicons name="sparkles" size={20} color={colors.brand} />
                    <Text style={styles.recBoxTitle}>Recommended for your load</Text>
                  </View>
                  {recLoading ? (
                    <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.brand} />
                  ) : recError ? (
                    <Text style={styles.err}>{recError}</Text>
                  ) : recs && recs.length > 0 ? (
                    <View style={{ gap: spacing.sm }}>
                      {recs.map((r) => (
                        <View key={r.key} style={[styles.recRow, r.is_best_match && styles.recRowBest]}>
                          <View style={styles.recIcon}>
                            <Ionicons name={r.icon as any} size={22} color={colors.brand} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" }}>
                              <Text style={styles.recName}>{r.name}</Text>
                              <View style={styles.recBadge}>
                                <Text style={styles.recBadgeText}>{r.recommendation_label}</Text>
                              </View>
                            </View>
                            <Text style={styles.recDesc}>{r.description}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.recEmpty}>No suggestions available.</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Step 5 — pricing + summary */}
          {step === 5 && (
            <View>
              <Text style={styles.title}>Pricing & Review</Text>
              <Text style={styles.sub}>Choose how you want to price, then review your job.</Text>

              <View style={styles.priceTabs}>
                <Pressable
                  onPress={() => setPricingType("bidding")}
                  style={[styles.priceTab, pricingType === "bidding" && styles.priceTabActive]}
                  testID="pricing-bidding-tab"
                >
                  <Ionicons name="megaphone" size={18} color={pricingType === "bidding" ? "#fff" : colors.text} />
                  <Text style={[styles.priceTabText, pricingType === "bidding" && { color: "#fff" }]}>
                    Open to Bids
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPricingType("fixed")}
                  style={[styles.priceTab, pricingType === "fixed" && styles.priceTabActive]}
                  testID="pricing-fixed-tab"
                >
                  <Ionicons name="pricetag" size={18} color={pricingType === "fixed" ? "#fff" : colors.text} />
                  <Text style={[styles.priceTabText, pricingType === "fixed" && { color: "#fff" }]}>
                    Fixed Price
                  </Text>
                </Pressable>
              </View>

              {pricingType === "fixed" ? (
                <Input
                  label="Driver charge (£)"
                  value={fixedPrice}
                  onChangeText={setFixedPrice}
                  placeholder={quote ? String(quote.suggested_price) : "e.g. 150"}
                  keyboardType="numeric"
                  testID="postjob-fixed-price"
                />
              ) : (
                <Input
                  label="Max driver charge (£, optional)"
                  value={maxBudget}
                  onChangeText={setMaxBudget}
                  placeholder={quote ? String(quote.suggested_price) : "e.g. 250"}
                  keyboardType="numeric"
                  testID="postjob-max-budget"
                />
              )}

              {/* Quote summary card */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryHead}>Quote Summary</Text>
                <SummaryRow label="Service" value={selectedCategory?.name || "—"} />
                <SummaryRow label="Vehicle" value={summaryVehicleLabel(selectedVehicle, recs, vehicleKey)} />
                <SummaryRow label="Distance" value={quote ? `${quote.distance_miles} miles` : "—"} />
                <SummaryRow label="Journey time" value={quote ? fmtDur(quote.duration_minutes) : "—"} />
                <View style={styles.summaryDivider} />
                <SummaryRow
                  label="Driver charge"
                  value={previewCharge ? `£${previewCharge.toFixed(2)}` : "—"}
                  emphasise
                />
                <SummaryRow
                  label="Cargo One booking fee"
                  value={feePreview ? `£${feePreview.booking_fee.toFixed(2)}` : "£—"}
                />
                <View style={styles.summaryDivider} />
                <SummaryRow
                  label="Total booking price"
                  value={feePreview ? `£${feePreview.customer_total.toFixed(2)}` : "£—"}
                  emphasise
                  big
                />
                <Text style={styles.summaryNote}>
                  Only the Cargo One booking fee is charged now via Stripe. The driver charge is paid
                  directly on delivery.
                </Text>
              </View>

              <View style={styles.pricingBanner}>
                <Ionicons
                  name={pricingType === "bidding" ? "megaphone" : "pricetag"}
                  size={20}
                  color={colors.brand}
                />
                <Text style={styles.pricingBannerText}>
                  {pricingType === "bidding"
                    ? "Drivers will now submit bids for this delivery."
                    : "The first suitable driver can accept this delivery."}
                </Text>
              </View>

              {err ? <Text style={styles.err}>{err}</Text> : null}
            </View>
          )}
        </ScrollView>

        <View style={styles.foot}>
          {step < STEP_COUNT ? (
            <Button
              title="Continue"
              onPress={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !canNext1 : step === 2 ? !canNext2 : step === 3 ? !canNext3 : !canNext4}
              testID="postjob-next-button"
            />
          ) : (
            <Button
              title="Post Job"
              onPress={submit}
              loading={loading}
              disabled={!canSubmit}
              testID="postjob-submit-button"
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function volumeFromDims(l: string, w: string, h: string): number | null {
  const lN = Number(l);
  const wN = Number(w);
  const hN = Number(h);
  if (lN > 0 && wN > 0 && hN > 0) return Number((lN * wN * hN).toFixed(2));
  return null;
}

function summaryVehicleLabel(
  selected: VehicleType | null,
  recs: RecommendedVehicle[] | null,
  vehicleKey: string,
): string {
  if (vehicleKey === NOT_SURE_KEY) {
    if (recs && recs.length > 0) return `${recs[0].name} (recommended)`;
    return "Recommend for me";
  }
  return selected?.name || "—";
}

function QuoteStat({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.quoteStat}>
      <View style={styles.quoteStatIcon}>
        <Ionicons name={icon} size={16} color={colors.text} />
      </View>
      <Text style={styles.quoteStatValue}>{value}</Text>
      <Text style={styles.quoteStatLabel}>{label}</Text>
    </View>
  );
}

function VehicleCard({
  active,
  onPress,
  name,
  description,
  icon,
  highlight = false,
}: {
  active: boolean;
  onPress: () => void;
  name: string;
  description: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.vehCard, active && styles.vehCardActive, highlight && styles.vehCardHighlight]}
    >
      <View style={[styles.vehIcon, active && { backgroundColor: colors.brand }]}>
        <Ionicons name={icon as any} size={22} color={active ? "#fff" : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.vehName, active && { color: colors.brand }]}>{name}</Text>
        <Text style={styles.vehDesc} numberOfLines={2}>
          {description}
        </Text>
      </View>
      {active ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value && { backgroundColor: colors.brand }]}>
        <View style={[styles.toggleThumb, value && { transform: [{ translateX: 18 }] }]} />
      </View>
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  emphasise = false,
  big = false,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
  big?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          emphasise && { color: colors.text, fontWeight: weight.bold },
          big && { fontSize: font.xl },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function fmtDur(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  stepPill: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  progress: { height: 3, backgroundColor: colors.bgSecondary, marginHorizontal: spacing.xl, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: colors.brand, borderRadius: 2 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: 26, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.4 },
  sub: { fontSize: font.base, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },

  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catCard: {
    width: "31.5%",
    minHeight: 92,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    gap: spacing.xs,
  },
  catCardActive: { backgroundColor: colors.text },
  catLabel: { fontSize: 11, fontWeight: weight.semibold, color: colors.text, textAlign: "center" },

  row2: { flexDirection: "row", gap: spacing.md },
  row3: { flexDirection: "row", gap: spacing.sm },
  rowItem: { flex: 1 },
  groupLabel: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  routePreview: { marginTop: spacing.md, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  mapPreview: { height: 180 },
  quoteRow: { flexDirection: "row", padding: spacing.md, gap: spacing.sm, backgroundColor: colors.bg },
  quoteStat: { flex: 1, alignItems: "center", gap: 2 },
  quoteStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  quoteStatValue: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  quoteStatLabel: { fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },

  vehList: { gap: spacing.sm },
  vehCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehCardActive: { borderColor: colors.brand, backgroundColor: "#FFF5F5" },
  vehCardHighlight: {
    borderColor: colors.brand,
    borderStyle: "dashed" as any,
    backgroundColor: "#FFFBEB",
  },
  vehIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  vehName: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  vehDesc: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },

  recBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: "#0B0B0F",
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  recBoxHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  recBoxTitle: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold },
  recRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  recRowBest: { borderColor: colors.brand, backgroundColor: "rgba(214,40,40,0.12)" },
  recIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(214,40,40,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  recName: { color: "#fff", fontSize: font.base, fontWeight: weight.bold },
  recDesc: { color: "rgba(255,255,255,0.7)", fontSize: font.sm, marginTop: 2 },
  recBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
  },
  recBadgeText: { color: "#fff", fontSize: 10, fontWeight: weight.bold, letterSpacing: 0.5 },
  recEmpty: { color: "rgba(255,255,255,0.6)", fontSize: font.base },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { flex: 1, color: colors.text, fontSize: font.base },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },

  priceTabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  priceTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  priceTabActive: { backgroundColor: colors.text },
  priceTabText: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },

  summaryCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  summaryHead: {
    fontSize: font.lg,
    fontWeight: weight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  summaryLabel: { color: colors.textSecondary, fontSize: font.base, flex: 1 },
  summaryValue: { color: colors.text, fontSize: font.base, fontWeight: weight.medium, textAlign: "right" },
  summaryDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  summaryNote: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.sm, lineHeight: 18 },

  pricingBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: "#FFF5F5",
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pricingBannerText: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: weight.medium },

  err: { color: colors.error, marginTop: spacing.md, fontSize: font.base },
  foot: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
});
