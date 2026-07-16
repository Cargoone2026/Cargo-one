import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useResponsive } from "@/src/components/marketing/breakpoints";
import { FeatureCard } from "@/src/components/marketing/FeatureCard";
import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { SectionHeading } from "./index";

const REQUIREMENTS = [
  "Valid UK driving licence (car, van, LGV or HGV)",
  "Vehicle insurance with hire-and-reward cover",
  "V5C vehicle registration document",
  "Photo ID (passport or driving licence)",
  "Proof of address (utility bill or bank statement)",
  "18+ years of age",
];

const STEPS = [
  { n: "01", title: "Sign up in the app", body: "Download the driver app, create your account and choose Cargo One driver." },
  { n: "02", title: "Upload your documents", body: "Licence, insurance, vehicle V5, ID and address — all reviewed within 24 hours." },
  { n: "03", title: "Start accepting jobs", body: "Set your radius, browse nearby jobs, submit bids or accept fixed-price runs." },
  { n: "04", title: "Get paid on delivery", body: "Customers pay you your bid amount directly on delivery — no platform commission." },
];

export default function Drivers() {
  const router = useRouter();
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="Become a Driver | Cargo One"
        description="Join Cargo One as a driver and earn on your own terms. No commission on driver bids, verified customers, and instant on-delivery payments across the UK."
        path="/drivers"
        image={IMG.heroDrivers}
      />
      <Hero
        bgImage={IMG.heroDrivers}
        eyebrow="BECOME A CARGO ONE DRIVER"
        title="Drive when you want. Earn what you’re worth."
        subtitle="Join the UK’s fastest-growing logistics marketplace. Set your own prices, keep 100% of your quoted amount, and get paid directly on delivery."
        compact
        primaryCta={{ label: "Sign up as a Driver", href: "/(auth)/register?role=driver" }}
        secondaryCta={{ label: "See requirements", href: "#requirements" as any }}
      />

      <Section bg="#fff">
        <SectionHeading eyebrow="WHY DRIVE WITH US" title="A fairer deal for drivers" />
        <View style={styles.grid}>
          <FeatureCard icon="cash-outline" title="0% commission on your bid" body="You quote, you keep every pound. Customers pay a separate booking fee to Cargo One." />
          <FeatureCard icon="card-outline" title="Paid on delivery" body="Get paid directly by the customer the moment the job is complete — no weekly wait." />
          <FeatureCard icon="map-outline" title="Jobs near you" body="Filter jobs by distance, category and vehicle type. Get notifications for high-value bookings in your area." />
          <FeatureCard icon="shield-checkmark-outline" title="Verified customers" body="Real-name verified customers who’ve locked in a booking fee — no time-wasters." />
          <FeatureCard icon="star-outline" title="Build your reputation" body="Verified Driver badge, ratings and reviews — attract more jobs and higher bids." />
          <FeatureCard icon="headset-outline" title="24/7 driver support" body="Real humans, day or night. Emergency line for on-road issues and payment disputes." />
        </View>
      </Section>

      <Section bg={colors.bgSecondary}>
        <SectionHeading eyebrow="GETTING STARTED" title="Four steps to your first delivery" />
        <View style={[styles.stepsRow, isMobile && { flexDirection: "column" }]}>
          {STEPS.map((s) => (
            <View key={s.n} style={styles.stepCard}>
              <Text style={styles.stepNum}>{s.n}</Text>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section bg="#fff" style={{ paddingTop: spacing.xxxl }}>
        <View style={[styles.reqRow, isMobile && { flexDirection: "column" }]}>
          <View style={{ flex: 1, gap: spacing.md }}>
            <Text style={styles.eyebrowSmall}>REQUIREMENTS</Text>
            <Text style={styles.reqHead}>What you’ll need to get approved</Text>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {REQUIREMENTS.map((r) => (
                <View key={r} style={styles.reqRowItem}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                  <Text style={styles.reqText}>{r}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <Pressable
                onPress={() => router.push("/(auth)/register?role=driver")}
                style={styles.ctaPrimary}
              >
                <Text style={styles.ctaPrimaryText}>Start Application</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1, minHeight: 320, borderRadius: radius.lg, overflow: "hidden" }}>
            <Image source={{ uri: IMG.cardApp }} style={{ width: "100%", height: "100%", minHeight: 320 }} resizeMode="cover" />
          </View>
        </View>
      </Section>

      <Section bg="#0B0B0F">
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text style={styles.finalHead}>Ready to hit the road?</Text>
          <Text style={styles.finalSub}>Sign up in minutes. Get approved within 24 hours.</Text>
          <Pressable
            style={styles.finalBtn}
            onPress={() => router.push("/(auth)/register?role=driver")}
          >
            <Text style={styles.finalBtnText}>Become a Driver</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },
  stepsRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },
  stepCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  stepNum: { fontSize: 48, fontWeight: weight.bold, color: colors.brandLight, letterSpacing: -1, lineHeight: 48 },
  stepTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  stepBody: { fontSize: font.base, color: colors.textSecondary, lineHeight: 20 },

  reqRow: { flexDirection: "row", gap: spacing.xxxl, alignItems: "center" },
  eyebrowSmall: { color: colors.brand, fontWeight: weight.bold, letterSpacing: 2, fontSize: font.sm },
  reqHead: { fontSize: 32, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  reqRowItem: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  reqText: { fontSize: font.lg, color: colors.text },
  ctaPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  ctaPrimaryText: { color: "#fff", fontWeight: weight.bold, fontSize: font.lg },

  finalHead: { color: "#fff", fontSize: 32, fontWeight: weight.bold, textAlign: "center" },
  finalSub: { color: "rgba(255,255,255,0.75)", fontSize: font.lg, textAlign: "center" },
  finalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  finalBtnText: { color: "#fff", fontWeight: weight.bold, fontSize: font.lg },
});
