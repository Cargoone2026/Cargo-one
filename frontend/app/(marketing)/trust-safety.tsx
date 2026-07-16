import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { FeatureCard } from "@/src/components/marketing/FeatureCard";
import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { SectionHeading } from "./index";

const PILLARS = [
  { icon: "shield-checkmark-outline", title: "Driver verification", body: "Every driver’s licence, insurance, V5, ID and address is manually reviewed before their first job." },
  { icon: "lock-closed-outline", title: "Secure payments", body: "All card payments are processed by Stripe (PCI-DSS Level 1). We never see or store card data." },
  { icon: "card-outline", title: "Booking-fee model", body: "Only a small deposit is charged upfront. The rest goes directly to the driver on delivery." },
  { icon: "navigate-outline", title: "Live tracking", body: "Real-time GPS location, ETA, and route history — shareable with recipients and family." },
  { icon: "camera-outline", title: "Photo proof of delivery", body: "Time-stamped, GPS-tagged photos and optional signature captured on every completed job." },
  { icon: "chatbubbles-outline", title: "Private in-app messaging", body: "Talk to your driver without ever sharing your phone number. Chat history is retained for disputes." },
];

const POLICIES = [
  { icon: "documents", title: "GDPR compliant", body: "Registered with the UK Information Commissioner’s Office. Right to erase and data portability supported." },
  { icon: "medical", title: "Insured drivers", body: "All drivers carry a minimum of £10M public liability insurance with hire-and-reward cover." },
  { icon: "warning", title: "Zero-tolerance policy", body: "Strict rules on undisclosed subcontracting, damage, and no-shows. Repeat offenders are banned." },
  { icon: "headset", title: "24/7 support", body: "Real humans on chat and phone for both customers and drivers, day or night." },
];

export default function TrustSafety() {
  return (
    <>
      <SEO
        title="Trust & Safety | Cargo One"
        description="How Cargo One keeps deliveries safe — driver verification, Stripe secure payments, live GPS tracking, photo proof of delivery, and GDPR-compliant data handling."
        path="/trust-safety"
        image={IMG.heroTrust}
      />
      <Hero
        bgImage={IMG.heroTrust}
        eyebrow="TRUST & SAFETY"
        title="Peace of mind, built in."
        subtitle="Six layers of protection surrounding every Cargo One booking — from driver checks to encrypted payments to real-time tracking."
        compact
      />

      <Section bg="#fff">
        <SectionHeading eyebrow="OUR SIX PILLARS" title="Every safeguard on every booking" />
        <View style={styles.grid}>
          {PILLARS.map((p) => (
            <FeatureCard key={p.title} icon={p.icon as any} title={p.title} body={p.body} />
          ))}
        </View>
      </Section>

      <Section bg={colors.bgSecondary}>
        <SectionHeading eyebrow="POLICIES & COMPLIANCE" title="Independently verified. Fully accountable." />
        <View style={styles.policyGrid}>
          {POLICIES.map((p) => (
            <View key={p.title} style={styles.policyCard}>
              <View style={styles.policyIcon}>
                <Ionicons name={p.icon as any} size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={styles.policyTitle}>{p.title}</Text>
                <Text style={styles.policyBody}>{p.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section bg="#fff">
        <SectionHeading eyebrow="REPORT AN ISSUE" title="Something went wrong? We’re here." />
        <View style={styles.reportBox}>
          <Ionicons name="alert-circle" size={26} color={colors.brand} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.reportTitle}>Safety incidents &amp; disputes</Text>
            <Text style={styles.reportBody}>
              For urgent safety concerns, contact our 24/7 line: <Text style={{ fontWeight: weight.bold }}>+44 800 111 000</Text>.
              For payment disputes or complaints, email <Text style={{ fontWeight: weight.bold }}>trust@cargoone.co.uk</Text>.
              We aim to respond within 2 hours for safety matters and 24 hours for all other queries.
            </Text>
          </View>
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },
  policyGrid: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },
  policyCard: {
    flexBasis: 300,
    flexGrow: 1,
    minWidth: 260,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  policyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  policyTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  policyBody: { fontSize: font.base, color: colors.textSecondary, lineHeight: 20 },

  reportBox: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  reportTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  reportBody: { fontSize: font.base, color: colors.text, lineHeight: 22 },
});
