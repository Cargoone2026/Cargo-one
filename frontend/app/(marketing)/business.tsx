import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useResponsive } from "@/src/components/marketing/breakpoints";
import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { SectionHeading } from "./index";

const BENEFITS = [
  { icon: "trending-down-outline", title: "Volume discount pricing", body: "Booking fees reduced up to 40% based on monthly volume. Custom rate cards for enterprise." },
  { icon: "flash-outline", title: "Priority driver matching", body: "Reserved capacity on peak days and dedicated fleets for time-critical routes." },
  { icon: "documents-outline", title: "Monthly invoicing", body: "Consolidated VAT invoices, purchase-order references and self-serve CSV export." },
  { icon: "person-outline", title: "Named account manager", body: "A single point of contact for onboarding, escalations and quarterly business reviews." },
  { icon: "code-slash-outline", title: "Bookings API", body: "Push jobs from your OMS/WMS via REST API and webhooks. SDKs and sandbox available." },
  { icon: "lock-closed-outline", title: "Enterprise SLAs", body: "Custom uptime commitments, priority support, and financial-services grade security." },
];

const INDUSTRIES = [
  { icon: "cart-outline", label: "Retail & E-commerce" },
  { icon: "restaurant-outline", label: "Food & Perishables" },
  { icon: "construct-outline", label: "Manufacturing" },
  { icon: "home-outline", label: "Removals" },
  { icon: "medical-outline", label: "Healthcare" },
  { icon: "pricetags-outline", label: "Auctions" },
];

export default function Business() {
  const router = useRouter();
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="Business Accounts | Cargo One"
        description="Cargo One for Business — UK logistics on tap. Volume discounts, monthly invoicing, priority driver matching, API access and enterprise SLAs."
        path="/business"
        image={IMG.heroBusiness}
      />
      <Hero
        bgImage={IMG.heroBusiness}
        eyebrow="CARGO ONE FOR BUSINESS"
        title="Scale your logistics without hiring a fleet."
        subtitle="Retailers, movers, manufacturers and marketplaces — unlock a nationwide driver network with SLA-backed capacity, monthly invoicing and full-stack API access."
        compact
        primaryCta={{ label: "Talk to Sales", href: "/contact?topic=business" }}
        secondaryCta={{ label: "See features", href: "#features" as any }}
      />

      <Section bg="#fff">
        <SectionHeading eyebrow="WHY BUSINESSES CHOOSE US" title="Everything you need to move at scale" />
        <View style={styles.grid}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={b.icon as any} size={22} color={colors.brand} />
              </View>
              <Text style={styles.cardTitle}>{b.title}</Text>
              <Text style={styles.cardBody}>{b.body}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section bg="#0B0B0F">
        <View style={[styles.splitRow, isMobile && { flexDirection: "column" }]}>
          <View style={{ flex: 1, gap: spacing.md }}>
            <Text style={styles.eyebrowDark}>ENTERPRISE READY</Text>
            <Text style={styles.headingDark}>SOC2-aligned. GDPR-compliant. Insured.</Text>
            <Text style={styles.bodyDark}>
              Cargo One meets the requirements of finance, healthcare and enterprise procurement.
              We’re registered with the ICO, PCI-DSS compliant via Stripe, and all drivers carry
              minimum £10M public liability insurance.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Pressable style={styles.ctaLight} onPress={() => router.push("/contact?topic=business")}>
                <Text style={styles.ctaLightText}>Request a demo</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1, minHeight: 260, borderRadius: radius.lg, overflow: "hidden" }}>
            <Image source={{ uri: IMG.cardTeam }} style={{ width: "100%", height: "100%", minHeight: 260 }} resizeMode="cover" />
          </View>
        </View>
      </Section>

      <Section bg={colors.bgSecondary}>
        <SectionHeading eyebrow="INDUSTRIES" title="Trusted across the UK economy" />
        <View style={styles.industriesGrid}>
          {INDUSTRIES.map((i) => (
            <View key={i.label} style={styles.industryCard}>
              <Ionicons name={i.icon as any} size={24} color={colors.brand} />
              <Text style={styles.industryLabel}>{i.label}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section bg={colors.brand}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text style={styles.ctaHead}>Ready to move faster?</Text>
          <Text style={styles.ctaSub}>Speak to our team about a bespoke business account.</Text>
          <Pressable style={styles.ctaWhiteBig} onPress={() => router.push("/contact?topic=business")}>
            <Text style={styles.ctaWhiteBigText}>Contact Sales</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.brand} />
          </Pressable>
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" as any, gap: spacing.lg },
  card: {
    flexBasis: 300,
    flexGrow: 1,
    minWidth: 260,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  cardTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  cardBody: { fontSize: font.base, color: colors.textSecondary, lineHeight: 22 },

  splitRow: { flexDirection: "row", gap: spacing.xxxl, alignItems: "center" },
  eyebrowDark: { color: "#FF6A00", fontWeight: weight.bold, letterSpacing: 2, fontSize: font.sm },
  headingDark: { color: "#fff", fontSize: 34, fontWeight: weight.bold, letterSpacing: -0.5, lineHeight: 40 },
  bodyDark: { color: "rgba(255,255,255,0.75)", fontSize: font.lg, lineHeight: 26 },
  ctaLight: {
    backgroundColor: "#fff",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  ctaLightText: { color: "#111", fontWeight: weight.bold, fontSize: font.lg },

  industriesGrid: { flexDirection: "row", flexWrap: "wrap" as any, gap: spacing.md, justifyContent: "center" },
  industryCard: {
    flexBasis: 200,
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: "#fff",
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  industryLabel: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text, textAlign: "center" },

  ctaHead: { color: "#fff", fontSize: 32, fontWeight: weight.bold, textAlign: "center" },
  ctaSub: { color: "rgba(255,255,255,0.9)", fontSize: font.lg, textAlign: "center" },
  ctaWhiteBig: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  ctaWhiteBigText: { color: colors.brand, fontWeight: weight.bold, fontSize: font.lg },
});
