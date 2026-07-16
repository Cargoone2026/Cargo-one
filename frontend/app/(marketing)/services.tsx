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

const SERVICES = [
  {
    icon: "cube-outline",
    title: "Parcels & Packages",
    body: "Small parcels, next-day priorities, fragile items — same-day and scheduled options from £5 nationwide.",
    tag: "From £5",
    image: IMG.cardParcel,
  },
  {
    icon: "albums-outline",
    title: "Pallets & Freight",
    body: "Full or part pallets, tail-lift loading, chilled or ambient. Ideal for B2B fulfilment and warehouse transfers.",
    tag: "1–26 pallets",
    image: IMG.cardPallet,
  },
  {
    icon: "home-outline",
    title: "House Moves",
    body: "Single-room to whole-house removals with 2-man crews, packing service and fully-insured drivers.",
    tag: "Studio to 5-bed",
    image: IMG.cardHouse,
  },
  {
    icon: "car-sport-outline",
    title: "Cars & Vehicles",
    body: "Recovery, dealer transfers, private sales — covered transporters, flatbeds and driven collections.",
    tag: "UK & Europe",
    image: IMG.cardVehicle,
  },
  {
    icon: "bicycle-outline",
    title: "Motorcycles",
    body: "Secure trailer transport for bikes, mopeds and scooters. Chocks, straps, and full insurance included.",
    tag: "Any bike",
    image: IMG.cardMoto,
  },
  {
    icon: "boat-outline",
    title: "Freight & Heavy",
    body: "7.5T HGV, flatbed and low-loader options for machinery, plant, marine and abnormal loads.",
    tag: "Up to 26T",
    image: IMG.cardFreight,
  },
  {
    icon: "business-outline",
    title: "Office & Commercial",
    body: "Office relocations, retail store fit-outs and exhibition logistics with weekend and out-of-hours crews.",
    tag: "Commercial",
    image: IMG.cardTeam,
  },
  {
    icon: "document-outline",
    title: "Documents & Sensitive",
    body: "Same-hour document couriers on bikes, secure signed handover, chain-of-custody logs.",
    tag: "Same-hour",
    image: IMG.cardApp,
  },
];

export default function Services() {
  const router = useRouter();
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="Delivery Services | Cargo One"
        description="Everything Cargo One moves — parcels, pallets, house moves, vehicles, motorcycles, freight, and commercial logistics. Book a vetted UK driver in minutes."
        path="/services"
        image={IMG.heroServices}
      />
      <Hero
        bgImage={IMG.heroServices}
        eyebrow="OUR SERVICES"
        title="One platform. Every load size."
        subtitle="From urgent same-day parcels to full house removals and heavy freight — all with vetted UK drivers, live tracking and photo proof of delivery."
        compact
        primaryCta={{ label: "Get an Instant Quote", href: "/(auth)/register?role=customer" }}
      />

      <Section bg="#fff">
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <View key={s.title} style={styles.card}>
              <View style={styles.imageWrap}>
                <Image source={{ uri: s.image }} style={styles.image} />
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{s.tag}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeadRow}>
                  <View style={styles.cardIcon}>
                    <Ionicons name={s.icon as any} size={20} color={colors.brand} />
                  </View>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                </View>
                <Text style={styles.cardText}>{s.body}</Text>
                <Pressable
                  onPress={() => router.push("/(auth)/register?role=customer")}
                  style={styles.cardCta}
                >
                  <Text style={styles.cardCtaText}>Get a quote</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.brand} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section bg={colors.bgSecondary}>
        <SectionHeading
          eyebrow="COVERAGE"
          title="UK-wide network. Same-day possible."
          subtitle="Cargo One drivers cover every UK postcode with same-day, next-day and scheduled options. Cross-border European deliveries available on request."
        />
        <View style={[styles.coverageRow, isMobile && { flexDirection: "column" }]}>
          {[
            { label: "UK postcodes covered", value: "98%" },
            { label: "Average pickup ETA", value: "< 90 min" },
            { label: "Cross-border routes", value: "27 countries" },
            { label: "Vehicle classes", value: "12 types" },
          ].map((s) => (
            <View key={s.label} style={styles.coverageCard}>
              <Text style={styles.coverageValue}>{s.value}</Text>
              <Text style={styles.coverageLabel}>{s.label}</Text>
            </View>
          ))}
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
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imageWrap: { width: "100%", height: 180, position: "relative" as any },
  image: { width: "100%", height: "100%" as any },
  tag: {
    position: "absolute" as any,
    top: spacing.md,
    left: spacing.md,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  tagText: { color: colors.brand, fontWeight: weight.bold, fontSize: font.sm },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  cardHeadRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text, flex: 1 },
  cardText: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
  cardCta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  cardCtaText: { color: colors.brand, fontWeight: weight.bold, fontSize: font.base },

  coverageRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },
  coverageCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  coverageValue: { fontSize: 40, fontWeight: weight.bold, color: colors.brand, letterSpacing: -1 },
  coverageLabel: { fontSize: font.base, color: colors.textSecondary, marginTop: 4 },
});
