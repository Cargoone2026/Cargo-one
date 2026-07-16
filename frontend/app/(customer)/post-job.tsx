import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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
import { CATEGORIES, colors, font, radius, spacing, weight } from "@/src/theme";

export default function PostJob() {
  const params = useLocalSearchParams<{ category?: string }>();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(params.category || "furniture");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pickup, setPickup] = useState<PlaceResult | null>(null);
  const [dropoff, setDropoff] = useState<PlaceResult | null>(null);
  const [quote, setQuote] = useState<{
    distance_miles: number; duration_minutes: number;
    suggested_price: number; vehicle: string;
  } | null>(null);
  const [weight_kg, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [pricingType, setPricingType] = useState<"fixed" | "bidding">("bidding");
  const [fixedPrice, setFixedPrice] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live quote whenever route changes
  useEffect(() => {
    if (!pickup || !dropoff) { setQuote(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const q: any = await api(
          `/quote/estimate?pickup_lat=${pickup.lat}&pickup_lng=${pickup.lng}` +
          `&dropoff_lat=${dropoff.lat}&dropoff_lng=${dropoff.lng}&category=${category}`,
        );
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => { cancelled = true; };
  }, [pickup, dropoff, category]);

  const canNext1 = category && title.trim();
  const canNext2 = !!pickup && !!dropoff;
  const canNext3 = collectionDate && deliveryDate;
  const canSubmit =
    pricingType === "bidding"
      ? !!maxBudget || !!fixedPrice || true
      : !!fixedPrice;

  async function submit() {
    setErr(null);
    if (!pickup || !dropoff) {
      setErr("Please choose pickup and delivery addresses");
      return;
    }
    setLoading(true);
    try {
      const body: any = {
        title: title.trim(),
        category,
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
        weight_kg: weight_kg ? Number(weight_kg) : null,
        dimensions: dimensions || null,
        collection_date: collectionDate,
        delivery_date: deliveryDate,
        pricing_type: pricingType,
        fixed_price: pricingType === "fixed" ? Number(fixedPrice) : null,
        max_budget: maxBudget ? Number(maxBudget) : null,
      };
      const job = await api("/jobs", { method: "POST", body });
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
        <Text style={styles.step}>Step {step}/4</Text>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <View>
              <Text style={styles.title}>What are you shipping?</Text>
              <Text style={styles.sub}>Pick a category and give it a title.</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategory(c.id)}
                    style={[styles.catCard, category === c.id && styles.catCardActive]}
                    testID={`postjob-cat-${c.id}`}
                  >
                    <Ionicons
                      name={c.icon as any}
                      size={24}
                      color={category === c.id ? "#fff" : colors.text}
                    />
                    <Text
                      style={[styles.catLabel, category === c.id && { color: "#fff" }]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Input
                label="Job title"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. 3-seater sofa"
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
                      <QuoteStat label="Vehicle" value={quote.vehicle} icon="car-sport" />
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Details</Text>
              <Text style={styles.sub}>Optional but helps drivers quote accurately.</Text>
              <Input
                label="Weight (kg)"
                value={weight_kg}
                onChangeText={setWeight}
                placeholder="e.g. 50"
                keyboardType="numeric"
                testID="postjob-weight-input"
              />
              <Input
                label="Dimensions"
                value={dimensions}
                onChangeText={setDimensions}
                placeholder="L x W x H (cm)"
                testID="postjob-dims-input"
              />
              <Input
                label="Collection date"
                value={collectionDate}
                onChangeText={setCollectionDate}
                placeholder="YYYY-MM-DD"
                testID="postjob-collection-date"
              />
              <Input
                label="Delivery date"
                value={deliveryDate}
                onChangeText={setDeliveryDate}
                placeholder="YYYY-MM-DD"
                testID="postjob-delivery-date"
              />
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.title}>Pricing</Text>
              <Text style={styles.sub}>Choose fixed price or let drivers bid.</Text>
              <View style={styles.priceTabs}>
                <Pressable
                  onPress={() => setPricingType("bidding")}
                  style={[styles.priceTab, pricingType === "bidding" && styles.priceTabActive]}
                  testID="pricing-bidding-tab"
                >
                  <Ionicons
                    name="megaphone"
                    size={20}
                    color={pricingType === "bidding" ? "#fff" : colors.text}
                  />
                  <Text
                    style={[
                      styles.priceTabText,
                      pricingType === "bidding" && { color: "#fff" },
                    ]}
                  >
                    Open to Bids
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPricingType("fixed")}
                  style={[styles.priceTab, pricingType === "fixed" && styles.priceTabActive]}
                  testID="pricing-fixed-tab"
                >
                  <Ionicons
                    name="pricetag"
                    size={20}
                    color={pricingType === "fixed" ? "#fff" : colors.text}
                  />
                  <Text
                    style={[
                      styles.priceTabText,
                      pricingType === "fixed" && { color: "#fff" },
                    ]}
                  >
                    Fixed Price
                  </Text>
                </Pressable>
              </View>

              {pricingType === "fixed" ? (
                <View>
                  <Input
                    label="Driver charge (£)"
                    value={fixedPrice}
                    onChangeText={setFixedPrice}
                    placeholder="e.g. 150"
                    keyboardType="numeric"
                    testID="postjob-fixed-price"
                  />
                  <Text style={styles.hint}>
                    This is the amount the driver receives. Cargo One&apos;s booking fee is added on top at checkout.
                  </Text>
                </View>
              ) : (
                <View>
                  <Input
                    label="Max driver charge (£, optional)"
                    value={maxBudget}
                    onChangeText={setMaxBudget}
                    placeholder="e.g. 250"
                    keyboardType="numeric"
                    testID="postjob-max-budget"
                  />
                  <Text style={styles.hint}>
                    Drivers will bid what they want to receive. Cargo One&apos;s booking fee is added on top at checkout.
                  </Text>
                </View>
              )}

              <View style={styles.notice}>
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                <Text style={styles.noticeText}>
                  Free to post. You&apos;ll only pay a small deposit when you choose a driver.
                </Text>
              </View>

              {err ? <Text style={styles.err}>{err}</Text> : null}
            </View>
          )}
        </ScrollView>

        <View style={styles.foot}>
          {step < 4 ? (
            <Button
              title="Continue"
              onPress={() => setStep(step + 1)}
              disabled={step === 1 ? !canNext1 : step === 2 ? !canNext2 : !canNext3}
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

function fmtDur(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  step: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  progress: { height: 3, backgroundColor: colors.bgSecondary, marginHorizontal: spacing.xl, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: colors.brand, borderRadius: 2 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: 26, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.4 },
  sub: { fontSize: font.base, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  routePreview: { marginTop: spacing.md, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  mapPreview: { height: 180 },
  quoteRow: { flexDirection: "row", padding: spacing.md, gap: spacing.sm, backgroundColor: colors.bg },
  quoteStat: { flex: 1, alignItems: "center", gap: 2 },
  quoteStatIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xs,
  },
  quoteStatValue: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  quoteStatLabel: { fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  label: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catCard: {
    width: "31%", aspectRatio: 1.1, backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", gap: spacing.xs,
  },
  catCardActive: { backgroundColor: colors.text },
  catLabel: { fontSize: font.sm, fontWeight: weight.medium, color: colors.text, textAlign: "center" },
  chipRow: { flexDirection: "row", marginBottom: spacing.md },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center",
    marginRight: spacing.sm, flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: font.base, fontWeight: weight.medium },
  chipTextActive: { color: "#fff" },
  priceTabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  priceTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  priceTabActive: { backgroundColor: colors.text },
  priceTabText: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  notice: {
    flexDirection: "row", gap: spacing.sm, padding: spacing.md,
    backgroundColor: "#F0FDF4", borderRadius: radius.md, marginTop: spacing.md,
  },
  noticeText: { flex: 1, color: colors.text, fontSize: font.base, lineHeight: 20 },
  err: { color: colors.error, marginTop: spacing.md },
  hint: { fontSize: font.sm, color: colors.textSecondary, marginTop: -8, marginBottom: spacing.md, lineHeight: 18 },
  foot: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg,
  },
});
