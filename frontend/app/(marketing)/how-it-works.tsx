import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useResponsive } from "@/src/components/marketing/breakpoints";
import { FeatureCard } from "@/src/components/marketing/FeatureCard";
import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { SectionHeading } from "./index";

const STEPS = [
  {
    icon: "create-outline",
    title: "Post your delivery",
    body: "Choose your category, add pickup & drop-off, dates, dimensions and any photos. Set a fixed price or accept bids.",
  },
  {
    icon: "cash-outline",
    title: "Get instant quotes",
    body: "Our engine calculates distance, vehicle type and price in seconds. Compare bids side-by-side.",
  },
  {
    icon: "person-circle-outline",
    title: "Pick your driver",
    body: "Every driver is fully vetted — licence, insurance, ID and address checked. See ratings and reviews.",
  },
  {
    icon: "card-outline",
    title: "Pay a small booking fee",
    body: "Only the booking fee is charged now via Stripe. The driver’s bid is paid directly on delivery.",
  },
  {
    icon: "navigate-outline",
    title: "Track live in-app",
    body: "Watch your driver in real time. Chat in the app. See ETA and status updates end-to-end.",
  },
  {
    icon: "checkmark-done-outline",
    title: "Confirm & review",
    body: "Photo POD + signature captured on delivery. Confirm receipt and leave a review.",
  },
];

export default function HowItWorks() {
  const router = useRouter();
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="How It Works | Cargo One"
        description="Six simple steps to book a delivery on Cargo One. Post a job, compare quotes from vetted UK drivers, pay a small booking fee via Stripe, and track live to your doorstep."
        path="/how-it-works"
        image={IMG.heroHow}
      />
      <Hero
        bgImage={IMG.heroHow}
        eyebrow="HOW IT WORKS"
        title="Six steps. Zero surprises."
        subtitle="From posting to proof-of-delivery, here’s exactly how a Cargo One booking works."
        compact
        primaryCta={{ label: "Post a Job — Free", href: "/(auth)/register?role=customer" }}
      />

      <Section bg="#fff">
        <View style={styles.stepList}>
          {STEPS.map((s, i) => (
            <View
              key={s.title}
              style={[styles.stepRow, isMobile && { flexDirection: "column", alignItems: "flex-start" }]}
            >
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{String(i + 1).padStart(2, "0")}</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name={s.icon as any} size={22} color={colors.brand} />
                  <Text style={styles.stepTitle}>{s.title}</Text>
                </View>
                <Text style={styles.stepBody}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section bg={colors.bgSecondary}>
        <SectionHeading
          eyebrow="PRICING"
          title="Transparent, upfront pricing"
          subtitle="You pay a small Cargo One booking fee via Stripe. The driver’s exact bid is paid directly to them on delivery — no hidden commissions."
        />
        <View style={[styles.pricingSplit, isMobile && { flexDirection: "column" }]}>
          <View style={styles.pricingCard}>
            <View style={styles.pricingBadge}><Text style={styles.pricingBadgeText}>YOU PAY NOW</Text></View>
            <Text style={styles.pricingLabel}>Cargo One Booking Fee</Text>
            <Text style={styles.pricingValue}>From £10</Text>
            <Text style={styles.pricingSub}>
              Charged securely via Stripe. Calculated based on job value bands.
            </Text>
          </View>
          <View style={[styles.pricingCard, { backgroundColor: "#0B0B0F", borderColor: "#111" }]}>
            <View style={[styles.pricingBadge, { backgroundColor: "#FF6A00" }]}>
              <Text style={styles.pricingBadgeText}>ON DELIVERY</Text>
            </View>
            <Text style={[styles.pricingLabel, { color: "#fff" }]}>Driver Bid</Text>
            <Text style={[styles.pricingValue, { color: "#fff" }]}>Direct to Driver</Text>
            <Text style={[styles.pricingSub, { color: "rgba(255,255,255,0.7)" }]}>
              The exact amount the driver quoted. Paid cash or card on delivery.
            </Text>
          </View>
        </View>
      </Section>

      <Section bg="#fff">
        <SectionHeading
          eyebrow="BUILT IN SAFEGUARDS"
          title="Every booking is protected"
        />
        <View style={styles.featureGrid}>
          <FeatureCard icon="lock-closed" title="Encrypted payments" body="Stripe handles all card processing. We never see or store your card details." />
          <FeatureCard icon="shield-checkmark" title="Verified identities" body="Every driver’s licence, insurance, ID and address is confirmed by our team." />
          <FeatureCard icon="camera" title="Photo POD" body="Every delivery ends with time-stamped photos and an optional signature." />
          <FeatureCard icon="chatbubbles" title="Private in-app chat" body="Talk to your driver without ever exchanging phone numbers." />
        </View>
      </Section>

      <Section bg={colors.brand}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text style={styles.finalHead}>Ready to try it?</Text>
          <Text style={styles.finalSub}>Post your first delivery and see the difference in 60 seconds.</Text>
          <Pressable
            style={styles.finalBtn}
            onPress={() => router.push("/(auth)/register?role=customer")}
          >
            <Text style={styles.finalBtnText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.brand} />
          </Pressable>
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  stepList: { gap: spacing.lg },
  stepRow: {
    flexDirection: "row",
    gap: spacing.xl,
    padding: spacing.xl,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepIndex: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepIndexText: { color: "#fff", fontSize: font.xxl, fontWeight: weight.bold },
  stepTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  stepBody: { fontSize: font.base, color: colors.textSecondary, lineHeight: 22 },

  pricingSplit: { flexDirection: "row", gap: spacing.lg },
  pricingCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  pricingBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    marginBottom: spacing.sm,
  },
  pricingBadgeText: { color: "#fff", fontWeight: weight.bold, letterSpacing: 1, fontSize: font.sm },
  pricingLabel: { fontSize: font.lg, color: colors.textSecondary, fontWeight: weight.medium },
  pricingValue: { fontSize: 36, fontWeight: weight.bold, color: colors.text, letterSpacing: -1 },
  pricingSub: { fontSize: font.base, color: colors.textSecondary, lineHeight: 22, marginTop: spacing.sm },

  featureGrid: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },

  finalHead: { color: "#fff", fontSize: 32, fontWeight: weight.bold, textAlign: "center" },
  finalSub: { color: "rgba(255,255,255,0.9)", fontSize: font.lg, textAlign: "center" },
  finalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  finalBtnText: { color: colors.brand, fontWeight: weight.bold, fontSize: font.lg },
});
