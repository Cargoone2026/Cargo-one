import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useResponsive } from "@/src/components/marketing/breakpoints";
import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { SectionHeading } from "./index";

const VALUES = [
  { icon: "heart-outline", title: "Fairness first", body: "0% commission on driver bids. Transparent booking fees. Never a hidden charge." },
  { icon: "shield-checkmark-outline", title: "Trust by design", body: "Verification, live tracking and photo POD make every booking safer than a phone-book courier." },
  { icon: "leaf-outline", title: "Efficient by default", body: "Matching customers with local drivers reduces empty miles and carbon emissions." },
  { icon: "rocket-outline", title: "Speed matters", body: "Instant quotes. Same-day options. Support that answers in minutes, not days." },
];

const TIMELINE = [
  { year: "2023", title: "Cargo One founded in London" },
  { year: "2024", title: "1,000+ verified drivers on the platform" },
  { year: "2025", title: "Business Accounts + API launch" },
  { year: "2026", title: "Nationwide same-day coverage & app launch" },
];

export default function About() {
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="About Cargo One"
        description="Meet Cargo One — the fair, transparent UK logistics marketplace matching customers with vetted drivers. Our mission, values and story."
        path="/about"
        image={IMG.heroAbout}
      />
      <Hero
        bgImage={IMG.heroAbout}
        eyebrow="OUR STORY"
        title="Logistics done fair."
        subtitle="Cargo One was built by drivers and shippers frustrated by opaque platforms and hidden fees. We’re rebuilding delivery around trust, speed and honest pricing."
        compact
      />

      <Section bg="#fff">
        <View style={[styles.missionSplit, isMobile && { flexDirection: "column" }]}>
          <View style={{ flex: 1, gap: spacing.md }}>
            <Text style={styles.eyebrow}>OUR MISSION</Text>
            <Text style={styles.head}>Make sending anything, anywhere, effortless.</Text>
            <Text style={styles.body}>
              We believe delivery should be as simple as tapping a button, as trustworthy as a
              hand-off, and as fair as a market where both sides win. Cargo One is a two-sided
              marketplace where customers get instant quotes and vetted drivers, and drivers keep
              100% of what they quote.
            </Text>
            <Text style={styles.body}>
              We’re headquartered in London with team members in Manchester, Birmingham and Bristol.
              We’re building the logistics platform the UK deserves — modern, transparent and safe.
            </Text>
          </View>
          <View style={{ flex: 1, minHeight: 300, borderRadius: radius.lg, overflow: "hidden" }}>
            <Image source={{ uri: IMG.cardTeam }} style={{ width: "100%", height: "100%", minHeight: 300 }} resizeMode="cover" />
          </View>
        </View>
      </Section>

      <Section bg={colors.bgSecondary}>
        <SectionHeading eyebrow="OUR VALUES" title="What we believe" />
        <View style={styles.grid}>
          {VALUES.map((v) => (
            <View key={v.title} style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={v.icon as any} size={22} color={colors.brand} />
              </View>
              <Text style={styles.cardTitle}>{v.title}</Text>
              <Text style={styles.cardBody}>{v.body}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section bg="#fff">
        <SectionHeading eyebrow="MILESTONES" title="How we got here" />
        <View style={styles.timeline}>
          {TIMELINE.map((t) => (
            <View key={t.year} style={styles.tRow}>
              <View style={styles.tDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tYear}>{t.year}</Text>
                <Text style={styles.tTitle}>{t.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  missionSplit: { flexDirection: "row", gap: spacing.xxxl, alignItems: "center" },
  eyebrow: { color: colors.brand, fontWeight: weight.bold, letterSpacing: 2, fontSize: font.sm },
  head: { fontSize: 34, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5, lineHeight: 40 },
  body: { fontSize: font.lg, color: colors.textSecondary, lineHeight: 26 },

  grid: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },
  card: {
    flexBasis: 260,
    flexGrow: 1,
    minWidth: 240,
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

  timeline: { gap: spacing.lg, maxWidth: 720, alignSelf: "center", width: "100%" },
  tRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  tDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.brand, marginTop: 6 },
  tYear: { fontSize: font.sm, fontWeight: weight.bold, color: colors.brand, letterSpacing: 2 },
  tTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginTop: 2 },
});
