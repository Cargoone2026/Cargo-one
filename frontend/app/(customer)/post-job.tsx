import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { CATEGORIES, colors, font, radius, spacing, weight } from "@/src/theme";

// Preset UK city coordinates for demo (no Google API needed for MVP)
const CITIES: Record<string, { lat: number; lng: number }> = {
  London: { lat: 51.5074, lng: -0.1278 },
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Birmingham: { lat: 52.4862, lng: -1.8904 },
  Liverpool: { lat: 53.4084, lng: -2.9916 },
  Leeds: { lat: 53.8008, lng: -1.5491 },
  Bristol: { lat: 51.4545, lng: -2.5879 },
  Glasgow: { lat: 55.8642, lng: -4.2518 },
  Edinburgh: { lat: 55.9533, lng: -3.1883 },
  Cardiff: { lat: 51.4816, lng: -3.1791 },
  Newcastle: { lat: 54.9783, lng: -1.6178 },
  Sheffield: { lat: 53.3811, lng: -1.4701 },
  Nottingham: { lat: 52.9548, lng: -1.1581 },
};

export default function PostJob() {
  const params = useLocalSearchParams<{ category?: string }>();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(params.category || "furniture");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pickupTown, setPickupTown] = useState("London");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffTown, setDropoffTown] = useState("Manchester");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [weight_kg, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [pricingType, setPricingType] = useState<"fixed" | "bidding">("bidding");
  const [fixedPrice, setFixedPrice] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canNext1 = category && title.trim();
  const canNext2 = pickupTown && dropoffTown && pickupAddress.trim() && dropoffAddress.trim();
  const canNext3 = collectionDate && deliveryDate;
  const canSubmit =
    pricingType === "bidding"
      ? !!maxBudget || !!fixedPrice || true
      : !!fixedPrice;

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const pu = CITIES[pickupTown] || CITIES.London;
      const dt = CITIES[dropoffTown] || CITIES.Manchester;
      const body: any = {
        title: title.trim(),
        category,
        description: description.trim(),
        photos: [],
        pickup_address: pickupAddress.trim(),
        pickup_town: pickupTown,
        pickup_lat: pu.lat,
        pickup_lng: pu.lng,
        dropoff_address: dropoffAddress.trim(),
        dropoff_town: dropoffTown,
        dropoff_lat: dt.lat,
        dropoff_lng: dt.lng,
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
              <Text style={styles.sub}>Pickup and delivery locations.</Text>

              <Text style={styles.label}>Pickup town</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {Object.keys(CITIES).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setPickupTown(t)}
                    style={[styles.chip, pickupTown === t && styles.chipActive]}
                    testID={`pickup-town-${t}`}
                  >
                    <Text style={[styles.chipText, pickupTown === t && styles.chipTextActive]}>
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Input
                label="Pickup address"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="Street, postcode"
                testID="postjob-pickup-input"
              />

              <Text style={styles.label}>Delivery town</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {Object.keys(CITIES).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setDropoffTown(t)}
                    style={[styles.chip, dropoffTown === t && styles.chipActive]}
                    testID={`dropoff-town-${t}`}
                  >
                    <Text style={[styles.chipText, dropoffTown === t && styles.chipTextActive]}>
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Input
                label="Delivery address"
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                placeholder="Street, postcode"
                testID="postjob-dropoff-input"
              />
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
                <Input
                  label="Fixed price (£)"
                  value={fixedPrice}
                  onChangeText={setFixedPrice}
                  placeholder="e.g. 150"
                  keyboardType="numeric"
                  testID="postjob-fixed-price"
                />
              ) : (
                <Input
                  label="Max budget (£, optional)"
                  value={maxBudget}
                  onChangeText={setMaxBudget}
                  placeholder="e.g. 250"
                  keyboardType="numeric"
                  testID="postjob-max-budget"
                />
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
  foot: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg,
  },
});
