/**
 * PostJobScreen — full 5-step native customer wizard.
 * 1:1 port of frontend/src/pages/portal/customer/PostJob.jsx. Preserves
 * every field, every state, every backend contract:
 *   1. What are you shipping? (category + title + description)
 *   2. Route (pickup + dropoff via native AddressAutocomplete + Mapbox)
 *   3. Details (weight / dims / items / dates / loading aids)
 *   4. Vehicle (auto-recommend or explicit pick)
 *   5. Pricing & Review (bidding vs fixed, live fee preview, submit)
 *
 * Photos: web supports up to 4 pickup photos via `<PhotoUpload>`; the
 * native photo picker requires `expo-image-picker` and is out of scope
 * for this parity pass. The step-1 photo section is intentionally
 * absent in native and will land in a follow-up commit that pulls in
 * the picker. Every OTHER field is fully implemented.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ChevronLeft,
  Truck,
  Package as PackageIcon,
  Sparkles,
  Megaphone,
  Tag,
  Check,
  Navigation as NavIcon,
  Clock,
  PoundSterling,
  Plane,
} from "lucide-react-native";
import { SharedAPI, CustomerAPI, QuoteEstimate, FeePreview } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import {
  IconButton,
  Input,
  Label,
  Page,
  PrimaryButton,
  ProgressBar,
  SummaryRow,
} from "../ui";
import { useShellMenu } from "../components/AppShell";
import { AddressAutocomplete, PlaceResult } from "../components/AddressAutocomplete";
import { RouteMap } from "../components/RouteMap";
import { PhotoUpload } from "../components/PhotoUpload";

const STEP_COUNT = 5;
const NOT_SURE_KEY = "__not_sure__";

function volumeFromDims(l: string, w: string, h: string): number | null {
  const ln = Number(l), wn = Number(w), hn = Number(h);
  if (ln > 0 && wn > 0 && hn > 0) return Number((ln * wn * hn).toFixed(2));
  return null;
}
function fmtDur(mins: number | null | undefined) {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function PostJobScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  const [categoryKey, setCategoryKey] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pickup, setPickup] = useState<PlaceResult | null>(null);
  const [dropoff, setDropoff] = useState<PlaceResult | null>(null);
  const [quote, setQuote] = useState<QuoteEstimate | null>(null);

  const [weightKg, setWeightKg] = useState("");
  const [lengthM, setLengthM] = useState("");
  const [widthM, setWidthM] = useState("");
  const [heightM, setHeightM] = useState("");
  const [itemCount, setItemCount] = useState("");
  const [needsForklift, setNeedsForklift] = useState(false);
  const [needsLoadingHelp, setNeedsLoadingHelp] = useState(false);
  const [collectionDate, setCollectionDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const [vehicleKey, setVehicleKey] = useState("");
  const [pricingType, setPricingType] = useState<"bidding" | "fixed">("bidding");
  const [fixedPrice, setFixedPrice] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    SharedAPI.categories().then((c) => {
      setCategories(Array.isArray(c) ? c : []);
      if (Array.isArray(c) && c.length > 0 && !categoryKey) setCategoryKey(c[0].key);
    });
    SharedAPI.vehicles().then((v) => setVehicles(Array.isArray(v) ? v : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.key === categoryKey) || null,
    [categories, categoryKey],
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.key === vehicleKey) || null,
    [vehicles, vehicleKey],
  );

  // Live quote — same guard as web: only fire when both lat/lng are valid.
  useEffect(() => {
    const pickupOk =
      pickup && Number.isFinite(Number(pickup.lat)) && Number.isFinite(Number(pickup.lng));
    const dropoffOk =
      dropoff && Number.isFinite(Number(dropoff.lat)) && Number.isFinite(Number(dropoff.lng));
    if (!pickupOk || !dropoffOk || !categoryKey) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vol = volumeFromDims(lengthM, widthM, heightM);
        const q = await SharedAPI.quoteEstimate({
          pickup_lat: pickup!.lat,
          pickup_lng: pickup!.lng,
          dropoff_lat: dropoff!.lat,
          dropoff_lng: dropoff!.lng,
          category: categoryKey,
          pickup_country_code: pickup!.country_code,
          dropoff_country_code: dropoff!.country_code,
          weight_kg: weightKg || null,
          volume_m3: vol,
        });
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, categoryKey, weightKg, lengthM, widthM, heightM]);

  const previewCharge = useMemo(() => {
    if (pricingType === "fixed" && fixedPrice) return Number(fixedPrice);
    if (pricingType === "bidding" && maxBudget) return Number(maxBudget);
    if (quote?.suggested_price) return quote.suggested_price;
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
        const r = await SharedAPI.feePreview(previewCharge);
        if (!cancelled) setFeePreview(r);
      } catch {
        if (!cancelled) setFeePreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, previewCharge]);

  const canNext1 = !!categoryKey && title.trim().length > 0;
  const canNext2 = !!pickup && !!dropoff;
  const canNext3 = !!collectionDate && !!deliveryDate;
  const canNext4 = !!vehicleKey;
  const canSubmit = pricingType === "fixed" ? !!fixedPrice && Number(fixedPrice) > 0 : true;

  async function submit() {
    setErr(null);
    if (!pickup || !dropoff) return setErr("Please choose pickup and delivery addresses");
    if (!selectedCategory) return setErr("Please choose a service category");
    setLoading(true);
    try {
      const effectiveVehicleKey =
        vehicleKey === NOT_SURE_KEY ? selectedCategory?.default_vehicles?.[0] || "" : vehicleKey;
      const body: any = {
        title: title.trim(),
        category: selectedCategory.key,
        description: description.trim(),
        pickup_address: pickup.formatted_address,
        pickup_town: pickup.town || pickup.formatted_address.split(",").pop()?.trim() || "",
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_postcode: pickup.postcode || null,
        pickup_region: pickup.region || null,
        pickup_country: pickup.country || null,
        pickup_country_code: pickup.country_code || null,
        pickup_place_id: pickup.place_id || null,
        dropoff_address: dropoff.formatted_address,
        dropoff_town: dropoff.town || dropoff.formatted_address.split(",").pop()?.trim() || "",
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_postcode: dropoff.postcode || null,
        dropoff_region: dropoff.region || null,
        dropoff_country: dropoff.country || null,
        dropoff_country_code: dropoff.country_code || null,
        dropoff_place_id: dropoff.place_id || null,
        weight_kg: weightKg ? Number(weightKg) : null,
        dimensions: [lengthM, widthM, heightM].filter(Boolean).join("×") || null,
        dimensions_l_m: lengthM ? Number(lengthM) : null,
        dimensions_w_m: widthM ? Number(widthM) : null,
        dimensions_h_m: heightM ? Number(heightM) : null,
        volume_m3: volumeFromDims(lengthM, widthM, heightM),
        item_count: itemCount ? Number(itemCount) : null,
        needs_forklift: needsForklift,
        needs_loading_help: needsLoadingHelp,
        collection_date: collectionDate,
        delivery_date: deliveryDate,
        pricing_type: pricingType,
        fixed_price: pricingType === "fixed" ? Number(fixedPrice) : null,
        max_budget: maxBudget ? Number(maxBudget) : null,
        vehicle_required: effectiveVehicleKey || null,
        photos: photos,
      };
      const job: any = await CustomerAPI.createJob(body);
      if (pricingType === "bidding") {
        nav.replace("Bids", { jobId: job.id });
      } else {
        nav.replace("JobDetail", { jobId: job.id });
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to post job");
    } finally {
      setLoading(false);
    }
  }

  const backOrPrev = () => (step > 1 ? setStep((s) => s - 1) : nav.goBack());

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page testID="customer-post-job">
        {/* Header */}
        <View style={styles.header}>
          <IconButton onPress={backOrPrev} testID="post-job-back" accessibilityLabel="Back">
            <ChevronLeft size={20} color={colors.ink} />
          </IconButton>
          <Text style={[typography.h1, { flex: 1 }]}>Post a Job</Text>
          <View style={styles.stepPill}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.inkMuted }}>
              Step {step}/{STEP_COUNT}
            </Text>
          </View>
          {showMenu ? (
            <Pressable onPress={openDrawer} style={{ marginLeft: 4 }}>
              <View style={styles.menuLines}>
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
              </View>
            </Pressable>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <ProgressBar progress={step / STEP_COUNT} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}>
          {step === 1 && (
            <View testID="postjob-step-1">
              <Text style={typography.h1}>What are you shipping?</Text>
              <Text style={[typography.bodyMuted, { marginTop: 4 }]}>Pick a service category and give it a title.</Text>
              <View style={styles.catGrid}>
                {categories.map((c) => {
                  const active = c.key === categoryKey;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setCategoryKey(c.key)}
                      testID={`postjob-cat-${c.key}`}
                      style={[styles.catTile, active && styles.catTileActive]}
                    >
                      {active ? (
                        <View style={styles.catCheck}>
                          <Check size={12} color="#FFFFFF" />
                        </View>
                      ) : null}
                      <View style={styles.catIcon}>
                        <PackageIcon size={16} color={colors.ink} />
                      </View>
                      <Text style={styles.catLabel} numberOfLines={2}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Label>Job title</Label>
              <Input value={title} onChangeText={setTitle} placeholder="e.g. 3-seater sofa delivery" testID="postjob-title-input" />
              <Label>Description</Label>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add details, notes, or special requirements"
                placeholderTextColor={colors.inkMuted}
                multiline
                testID="postjob-desc-input"
                style={styles.textarea}
              />
              <View style={{ marginTop: 12 }}>
                <PhotoUpload photos={photos} onChange={setPhotos} max={4} testID="postjob-photos" />
              </View>
            </View>
          )}

          {step === 2 && (
            <View testID="postjob-step-2">
              <Text style={typography.h1}>Route</Text>
              <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 12 }]}>
                Search pickup and delivery addresses.
              </Text>
              <AddressAutocomplete label="Pickup address" value={pickup} onSelect={setPickup} testID="pickup-address-picker" />
              <AddressAutocomplete label="Delivery address" value={dropoff} onSelect={setDropoff} testID="dropoff-address-picker" />
              {pickup && dropoff ? (
                <View style={{ marginTop: 8, gap: 12 }} testID="route-preview">
                  <RouteMap
                    pickup={{ lat: pickup.lat, lng: pickup.lng, label: "Pickup" }}
                    dropoff={{ lat: dropoff.lat, lng: dropoff.lng, label: "Dropoff" }}
                    summary={
                      quote && !quote.requires_manual_review
                        ? {
                            pickupTown: pickup.town,
                            dropoffTown: dropoff.town,
                            distanceMiles: quote.distance_miles,
                            durationMinutes: quote.duration_minutes,
                          }
                        : { pickupTown: pickup.town, dropoffTown: dropoff.town }
                    }
                  />
                  {quote?.requires_manual_review ? (
                    <View style={styles.warnBanner} testID="intl-route-banner">
                      <Plane size={18} color="#B45309" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#78350F" }}>
                          International route: {quote.origin_country} → {quote.destination_country}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#78350F", marginTop: 2 }}>
                          {quote.manual_review_message || "Our team will provide a bespoke quote within one business day."}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {quote && !quote.requires_manual_review ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <QuoteStat Icon={NavIcon} label="Distance" value={`${quote.distance_miles} mi`} />
                      <QuoteStat Icon={Clock} label="Est. time" value={fmtDur(quote.duration_minutes)} />
                      <QuoteStat Icon={PoundSterling} label="Suggested" value={`£${quote.suggested_price}`} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}

          {step === 3 && (
            <View testID="postjob-step-3">
              <Text style={typography.h1}>Details</Text>
              <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 12 }]}>
                These help us match you to the right vehicle & price.
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Label>Weight (kg)</Label>
                  <Input value={weightKg} onChangeText={setWeightKg} placeholder="e.g. 250" keyboardType="numeric" testID="postjob-weight-input" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>Item count</Label>
                  <Input value={itemCount} onChangeText={setItemCount} placeholder="e.g. 3" keyboardType="numeric" testID="postjob-item-count" />
                </View>
              </View>
              <Text style={[typography.strong, { marginTop: 12, marginBottom: 6, fontSize: 13 }]}>
                Approximate dimensions (m)
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Label>Length</Label>
                  <Input value={lengthM} onChangeText={setLengthM} placeholder="1.2" keyboardType="decimal-pad" testID="postjob-length" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>Width</Label>
                  <Input value={widthM} onChangeText={setWidthM} placeholder="0.8" keyboardType="decimal-pad" testID="postjob-width" />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>Height</Label>
                  <Input value={heightM} onChangeText={setHeightM} placeholder="0.9" keyboardType="decimal-pad" testID="postjob-height" />
                </View>
              </View>
              <View style={{ marginTop: 12, gap: 8 }}>
                <Toggle
                  label="Forklift / loading equipment available?"
                  value={needsForklift}
                  onChange={setNeedsForklift}
                  testID="postjob-forklift"
                />
                <Toggle
                  label="Loading assistance required (tail lift, extra hands)?"
                  value={needsLoadingHelp}
                  onChange={setNeedsLoadingHelp}
                  testID="postjob-loading-help"
                />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Label>Collection date</Label>
                  <Input
                    value={collectionDate}
                    onChangeText={setCollectionDate}
                    placeholder="YYYY-MM-DD"
                    testID="postjob-collection-date"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>Delivery date</Label>
                  <Input
                    value={deliveryDate}
                    onChangeText={setDeliveryDate}
                    placeholder="YYYY-MM-DD"
                    testID="postjob-delivery-date"
                  />
                </View>
              </View>
            </View>
          )}

          {step === 4 && (
            <View testID="postjob-step-4">
              <Text style={typography.h1}>Which vehicle do you need?</Text>
              <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 12 }]}>
                Choose one, or let our engine recommend the right vehicle.
              </Text>
              <VehicleTile
                active={vehicleKey === NOT_SURE_KEY}
                onPress={() => setVehicleKey(NOT_SURE_KEY)}
                name="Not sure — recommend for me"
                description="We'll suggest suitable vehicles based on your load."
                highlight
                Icon={Sparkles}
                testID="veh-not-sure"
              />
              {vehicles.map((v) => (
                <VehicleTile
                  key={v.key}
                  active={vehicleKey === v.key}
                  onPress={() => setVehicleKey(v.key)}
                  name={v.name}
                  description={v.description}
                  Icon={Truck}
                  testID={`veh-${v.key}`}
                />
              ))}
            </View>
          )}

          {step === 5 && (
            <View testID="postjob-step-5">
              <Text style={typography.h1}>Pricing &amp; Review</Text>
              <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 12 }]}>
                Choose how you want to price, then review your job.
              </Text>
              <View style={styles.pricingTabs}>
                <PriceTab active={pricingType === "bidding"} onPress={() => setPricingType("bidding")} Icon={Megaphone} label="Open to Bids" testID="pricing-bidding-tab" />
                <PriceTab active={pricingType === "fixed"} onPress={() => setPricingType("fixed")} Icon={Tag} label="Fixed Price" testID="pricing-fixed-tab" />
              </View>
              {pricingType === "fixed" ? (
                <>
                  <Label>Driver charge (£)</Label>
                  <Input
                    value={fixedPrice}
                    onChangeText={setFixedPrice}
                    placeholder={quote?.suggested_price ? String(quote.suggested_price) : "e.g. 150"}
                    keyboardType="decimal-pad"
                    testID="postjob-fixed-price"
                  />
                </>
              ) : (
                <>
                  <Label>Max driver charge (£, optional)</Label>
                  <Input
                    value={maxBudget}
                    onChangeText={setMaxBudget}
                    placeholder={quote?.suggested_price ? String(quote.suggested_price) : "e.g. 250"}
                    keyboardType="decimal-pad"
                    testID="postjob-max-budget"
                  />
                </>
              )}

              <View style={[styles.summaryCard, { marginTop: 16 }]} testID="postjob-summary">
                <Text style={typography.micro}>Quote Summary</Text>
                <View style={{ marginTop: 8 }}>
                  <SummaryRow label="Service" value={selectedCategory?.name || "—"} />
                  <SummaryRow label="Vehicle" value={selectedVehicle?.name || "—"} />
                  <SummaryRow label="Distance" value={quote ? `${quote.distance_miles} miles` : "—"} />
                  <SummaryRow label="Journey time" value={quote ? fmtDur(quote.duration_minutes) : "—"} />
                  <View style={styles.divider} />
                  <SummaryRow label="Driver charge" value={previewCharge ? `£${previewCharge.toFixed(2)}` : "—"} emphasise />
                  <SummaryRow
                    label="Cargo One booking fee"
                    value={feePreview ? `£${feePreview.booking_fee.toFixed(2)}` : "£—"}
                    testID="postjob-summary-booking-fee"
                  />
                  <View style={styles.divider} />
                  <SummaryRow
                    label="Total booking price"
                    value={feePreview ? `£${feePreview.customer_total.toFixed(2)}` : "£—"}
                    big
                    testID="postjob-summary-total"
                  />
                </View>
                <Text style={[typography.small, { marginTop: 12, lineHeight: 18 }]}>
                  Only the Cargo One booking fee is charged now via Stripe. The driver charge is paid on delivery.
                </Text>
              </View>
              {err ? (
                <Text style={{ marginTop: 8, color: colors.errorInk, fontSize: 13 }} testID="postjob-error">
                  {err}
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          {step < STEP_COUNT ? (
            <PrimaryButton
              title="Continue"
              onPress={() => setStep((s) => s + 1)}
              disabled={
                step === 1 ? !canNext1 : step === 2 ? !canNext2 : step === 3 ? !canNext3 : !canNext4
              }
              testID="postjob-next-button"
            />
          ) : (
            <PrimaryButton title="Post Job" onPress={submit} loading={loading} disabled={!canSubmit} testID="postjob-submit-button" />
          )}
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}

/* ---------------- leaf components ---------------- */

function QuoteStat({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderRadius: radius.base, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, padding: 10, alignItems: "center", gap: 6 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center" }}>
        <Icon size={14} color={colors.ink} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.inkMuted }}>{label}</Text>
    </View>
  );
}

function Toggle({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      testID={testID}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: 12,
          borderRadius: radius.base,
          borderWidth: 1,
          borderColor: value ? colors.ink : colors.border,
          backgroundColor: value ? colors.ink : colors.bg,
        },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: "500", color: value ? "#FFFFFF" : colors.ink, flex: 1 }}>{label}</Text>
      <View style={{ width: 40, height: 24, borderRadius: 12, padding: 2, backgroundColor: value ? colors.brand : colors.border, alignItems: value ? "flex-end" : "flex-start" }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" }} />
      </View>
    </Pressable>
  );
}

function VehicleTile({
  active,
  onPress,
  name,
  description,
  Icon,
  highlight,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  name: string;
  description?: string;
  Icon: any;
  highlight?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[
        styles.vehTile,
        active && { borderColor: colors.brand },
        highlight && !active && { borderColor: colors.brand, borderStyle: "dashed", backgroundColor: "#FFF7ED" },
      ]}
    >
      <View style={[styles.vehIcon, active && { backgroundColor: colors.brand }]}>
        <Icon size={20} color={active ? "#FFFFFF" : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: active ? colors.brand : colors.ink }}>{name}</Text>
        {description ? <Text style={[typography.small, { marginTop: 2 }]} numberOfLines={2}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

function PriceTab({ active, onPress, Icon, label, testID }: { active: boolean; onPress: () => void; Icon: any; label: string; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={[styles.priceTab, active && styles.priceTabActive]}>
      <Icon size={16} color={active ? "#FFFFFF" : colors.inkMuted} />
      <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#FFFFFF" : colors.inkMuted }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  stepPill: {
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  menuLines: { gap: 4, width: 20, height: 20, justifyContent: "center" },
  menuLine: { width: 18, height: 2, backgroundColor: colors.ink, borderRadius: 2 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  catTile: {
    width: "31%",
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 6,
    minHeight: 92,
  },
  catTileActive: { borderColor: colors.ink, backgroundColor: "#FAFAFA" },
  catCheck: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  catIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { fontSize: 12, fontWeight: "600", color: colors.ink, lineHeight: 15 },
  textarea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    padding: 12,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
    textAlignVertical: "top",
  },
  warnBanner: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  vehTile: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  vehIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  pricingTabs: {
    flexDirection: "row",
    backgroundColor: colors.bgSecondary,
    borderRadius: 999,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  priceTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
  },
  priceTabActive: { backgroundColor: colors.ink },
  summaryCard: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 8 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
});
