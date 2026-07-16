import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { AppStoreButtons } from "@/src/components/marketing/AppStoreButtons";
import { useResponsive } from "@/src/components/marketing/breakpoints";
import { FeatureCard } from "@/src/components/marketing/FeatureCard";
import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

const STATS = [
  { label: "Verified drivers", value: "5,000+" },
  { label: "Deliveries completed", value: "120k" },
  { label: "Avg. driver rating", value: "4.9★" },
  { label: "UK coverage", value: "98%" },
];

const CATEGORIES = [
  { icon: "cube-outline", label: "Parcels", image: IMG.cardParcel },
  { icon: "albums-outline", label: "Pallets", image: IMG.cardPallet },
  { icon: "home-outline", label: "House Moves", image: IMG.cardHouse },
  { icon: "car-sport-outline", label: "Vehicles", image: IMG.cardVehicle },
  { icon: "boat-outline", label: "Freight", image: IMG.cardFreight },
  { icon: "bicycle-outline", label: "Motorcycles", image: IMG.cardMoto },
];

export default function Home() {
  const router = useRouter();
  const { isMobile } = useResponsive();

  return (
    <>
      <SEO
        title="Cargo One — Ship Anything. Anywhere. Instant Quotes."
        description="The UK’s trusted logistics marketplace. Get instant quotes from vetted drivers for parcels, pallets, house moves, freight and vehicles. Live tracking, secure payments, proof of delivery."
        image={IMG.heroHome}
      />

      <Hero
        bgImage={IMG.heroHome}
        eyebrow="CARGO ONE — UK LOGISTICS MARKETPLACE"
        title={"Ship Anything.\nAnywhere.\nInstant Quotes."}
        subtitle="Post a job in 60 seconds. Compare bids from verified UK drivers, pay a small booking fee, and track your delivery live from pickup to doorstep."
        primaryCta={{ label: "Get an Instant Quote", href: "/(auth)/register?role=customer" }}
        secondaryCta={{ label: "How It Works", href: "/how-it-works" }}
      />

      {/* Trusted badges strip */}
      <View style={styles.trustStrip}>
        <View style={styles.trustInner}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
            <Text style={styles.trustText}>Vetted &amp; insured drivers</Text>
          </View>
          <View style={styles.trustItem}>
            <Ionicons name="card" size={20} color={colors.brand} />
            <Text style={styles.trustText}>Secure payments via Stripe</Text>
          </View>
          <View style={styles.trustItem}>
            <Ionicons name="location" size={20} color={colors.brand} />
            <Text style={styles.trustText}>Live GPS tracking</Text>
          </View>
          <View style={styles.trustItem}>
            <Ionicons name="star" size={20} color={colors.brand} />
            <Text style={styles.trustText}>4.9★ average rating</Text>
          </View>
        </View>
      </View>

      {/* How it works */}
      <Section bg="#fff">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title="Three steps to your delivery"
          subtitle="From tiny parcels to full house removals — Cargo One matches you with the right driver in minutes."
        />
        <View style={[styles.stepsGrid, isMobile && { flexDirection: "column" }]}>
          {[
            {
              n: "01",
              icon: "create-outline",
              title: "Post your job for free",
              body: "Tell us what you’re moving, where and when. Set a fixed price or accept bids from drivers.",
            },
            {
              n: "02",
              icon: "people-outline",
              title: "Compare vetted drivers",
              body: "See ratings, vehicle types and reviews. Pay a small booking fee to lock in your driver.",
            },
            {
              n: "03",
              icon: "navigate-outline",
              title: "Track it live to the door",
              body: "Get GPS tracking, in-app chat and photo proof of delivery when it arrives.",
            },
          ].map((s) => (
            <View key={s.n} style={styles.stepCard}>
              <Text style={styles.stepNum}>{s.n}</Text>
              <View style={styles.stepIcon}>
                <Ionicons name={s.icon as any} size={26} color={colors.brand} />
              </View>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          ))}
        </View>
        <View style={{ alignItems: "center", marginTop: spacing.xl }}>
          <Pressable
            onPress={() => router.push("/(auth)/register?role=customer")}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaButtonText}>Post a Job — It’s Free</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </Section>

      {/* Categories */}
      <Section bg={colors.bgSecondary}>
        <SectionHeading
          eyebrow="WHAT WE MOVE"
          title="Any load. Any distance."
          subtitle="From single parcels to full removals — Cargo One handles UK & European deliveries."
        />
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.label}
              style={styles.catCard}
              onPress={() => router.push("/services")}
            >
              <Image source={{ uri: c.image }} style={styles.catImage} />
              <View style={styles.catOverlay} />
              <View style={styles.catInner}>
                <Ionicons name={c.icon as any} size={22} color="#fff" />
                <Text style={styles.catLabel}>{c.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Section>

      {/* Feature grid */}
      <Section bg="#fff">
        <SectionHeading
          eyebrow="WHY CARGO ONE"
          title="Built for professionals & everyday senders"
          subtitle="Every feature designed to make sending, receiving and moving simpler and safer."
        />
        <View style={styles.featureGrid}>
          <FeatureCard
            icon="flash"
            title="Instant AI quotes"
            body="Enter your route — we calculate distance, vehicle type and price in under 3 seconds."
          />
          <FeatureCard
            icon="shield-checkmark"
            title="Verified drivers only"
            body="Licence, insurance, ID and address checked before any driver can accept a job."
          />
          <FeatureCard
            icon="pin"
            title="Live GPS tracking"
            body="Watch your driver in real-time, share the ETA with recipients, and get status alerts."
          />
          <FeatureCard
            icon="camera"
            title="Photo proof of delivery"
            body="Time-stamped, GPS-tagged photos + optional signature on every delivery."
          />
          <FeatureCard
            icon="lock-closed"
            title="Secure Stripe payments"
            body="Only a small booking fee up front. Pay drivers directly on delivery."
          />
          <FeatureCard
            icon="chatbubbles"
            title="In-app messaging"
            body="Chat with your driver from booking to doorstep — no personal number exchange required."
          />
        </View>
      </Section>

      {/* Business Accounts strip */}
      <Section bg="#0B0B0F">
        <View style={[styles.businessSplit, isMobile && { flexDirection: "column" }]}>
          <View style={{ flex: 1, gap: spacing.md }}>
            <Text style={styles.eyebrowDark}>CARGO ONE FOR BUSINESS</Text>
            <Text style={styles.headingDark}>Scale your logistics without hiring a fleet.</Text>
            <Text style={styles.bodyDark}>
              Multi-user accounts, priority driver matching, monthly invoicing, and dedicated
              account management — designed for retailers, movers, auction houses and manufacturers.
            </Text>
            <View style={styles.businessList}>
              {[
                "Volume discounts on booking fees",
                "Reserved fleet for peak days",
                "Custom SLAs & priority support",
                "CSV export & API access",
              ].map((t) => (
                <View key={t} style={styles.businessListItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#FF6A00" />
                  <Text style={styles.businessListText}>{t}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.ctaButtonWhite} onPress={() => router.push("/business")}>
              <Text style={styles.ctaButtonWhiteText}>Explore Business Accounts</Text>
              <Ionicons name="arrow-forward" size={18} color="#111" />
            </Pressable>
          </View>
          <View style={{ flex: 1, minHeight: 300, borderRadius: radius.lg, overflow: "hidden" }}>
            <Image
              source={{ uri: IMG.heroBusiness }}
              style={{ width: "100%", height: "100%", minHeight: 300 }}
              resizeMode="cover"
            />
          </View>
        </View>
      </Section>

      {/* Stats */}
      <Section bg="#fff">
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* Testimonials */}
      <Section bg={colors.bgSecondary}>
        <SectionHeading
          eyebrow="TRUSTED BY BRITISH SHIPPERS"
          title="What customers &amp; drivers say"
        />
        <View style={[styles.testimonialGrid, isMobile && { flexDirection: "column" }]}>
          {[
            {
              q: "\u201cUsed Cargo One to move my parents\u2019 house from Manchester to Cornwall. Driver was verified, price was fair, and I tracked him the whole way. Fantastic service.\u201d",
              n: "Priya S.",
              r: "Customer",
            },
            {
              q: "\u201cInstant quotes save me hours. The photo proof of delivery gave our warehouse ops team complete peace of mind.\u201d",
              n: "James T.",
              r: "Business account",
            },
            {
              q: "\u201cAs a driver I love the transparent bidding \u2014 no hidden commissions, customer pays my price direct on delivery. Best platform I\u2019ve used.\u201d",
              n: "Kwame O.",
              r: "Driver, 4.98\u2605",
            },
          ].map((t, i) => (
            <View key={i} style={styles.testimonialCard}>
              <Text style={styles.testimonialStars}>★★★★★</Text>
              <Text style={styles.testimonialQuote}>{t.q}</Text>
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.testimonialName}>{t.n}</Text>
                <Text style={styles.testimonialRole}>{t.r}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      {/* Final CTA */}
      <Section bg={colors.brand}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text style={[styles.headingWhite, { textAlign: "center" }]}>Ready to send something?</Text>
          <Text style={[styles.bodyWhite, { textAlign: "center", maxWidth: 640 }]}>
            Post your job in 60 seconds and get instant quotes from verified UK drivers.
          </Text>
          <View style={[styles.ctaGroup, isMobile && { flexDirection: "column", width: "100%" }]}>
            <Pressable
              onPress={() => router.push("/(auth)/register?role=customer")}
              style={styles.ctaWhite}
            >
              <Text style={styles.ctaWhiteText}>Get a Quote</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/drivers")}
              style={styles.ctaOutlineWhite}
            >
              <Text style={styles.ctaOutlineWhiteText}>Become a Driver</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: spacing.lg }}>
            <AppStoreButtons />
          </View>
        </View>
      </Section>
    </>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  onDark = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onDark?: boolean;
}) {
  const fg = onDark ? "#fff" : colors.text;
  const sub = onDark ? "rgba(255,255,255,0.7)" : colors.textSecondary;
  return (
    <View style={{ alignItems: "center", marginBottom: spacing.xl, gap: spacing.sm }}>
      {eyebrow ? (
        <Text style={[styles.eyebrowSmall, { color: colors.brand }]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.sectionTitle, { color: fg, textAlign: "center" }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSub, { color: sub, textAlign: "center" }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trustStrip: {
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  trustInner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap" as any,
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  trustItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trustText: { color: colors.textSecondary, fontWeight: weight.medium, fontSize: font.base },

  eyebrowSmall: { fontSize: font.sm, fontWeight: weight.bold, letterSpacing: 2 },
  sectionTitle: { fontSize: 36, fontWeight: weight.bold, letterSpacing: -0.5, maxWidth: 760 },
  sectionSub: { fontSize: font.lg, lineHeight: 26, maxWidth: 620 },

  stepsGrid: {
    flexDirection: "row",
    gap: spacing.xl,
    flexWrap: "wrap" as any,
    justifyContent: "center",
  },
  stepCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  stepNum: {
    fontSize: 54,
    fontWeight: weight.bold,
    color: colors.brandLight,
    lineHeight: 54,
    letterSpacing: -2,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -spacing.md,
  },
  stepTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text, marginTop: spacing.sm },
  stepBody: { fontSize: font.base, color: colors.textSecondary, lineHeight: 22 },

  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  ctaButtonText: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold },

  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap" as any,
    gap: spacing.md,
  },
  catCard: {
    flexBasis: 220,
    flexGrow: 1,
    minHeight: 140,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  catImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" as any },
  catOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  catInner: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  catLabel: { color: "#fff", fontSize: font.xl, fontWeight: weight.bold },

  featureGrid: {
    flexDirection: "row",
    gap: spacing.lg,
    flexWrap: "wrap" as any,
  },

  businessSplit: { flexDirection: "row", gap: spacing.xxxl, alignItems: "center" },
  eyebrowDark: { color: "#FF6A00", fontSize: font.sm, fontWeight: weight.bold, letterSpacing: 2 },
  headingDark: { color: "#fff", fontSize: 34, fontWeight: weight.bold, letterSpacing: -0.5, lineHeight: 40 },
  bodyDark: { color: "rgba(255,255,255,0.75)", fontSize: font.lg, lineHeight: 26 },
  businessList: { gap: spacing.sm, marginTop: spacing.sm },
  businessListItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  businessListText: { color: "#fff", fontSize: font.lg },
  ctaButtonWhite: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  ctaButtonWhiteText: { color: "#111", fontSize: font.lg, fontWeight: weight.bold },

  statsRow: { flexDirection: "row", flexWrap: "wrap" as any, gap: spacing.lg, justifyContent: "center" },
  statCard: {
    flexGrow: 1,
    flexBasis: 160,
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  statValue: { fontSize: 44, fontWeight: weight.bold, color: colors.brand, letterSpacing: -1 },
  statLabel: { fontSize: font.base, color: colors.textSecondary, fontWeight: weight.medium, marginTop: 4 },

  testimonialGrid: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any },
  testimonialCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testimonialStars: { color: "#F59E0B", fontSize: 20, letterSpacing: 2 },
  testimonialQuote: {
    color: colors.text,
    fontSize: font.lg,
    lineHeight: 26,
    marginTop: spacing.md,
    fontStyle: "italic",
  },
  testimonialName: { color: colors.text, fontWeight: weight.bold, fontSize: font.base },
  testimonialRole: { color: colors.textSecondary, fontSize: font.sm },

  headingWhite: { color: "#fff", fontSize: 36, fontWeight: weight.bold, letterSpacing: -0.5 },
  bodyWhite: { color: "rgba(255,255,255,0.9)", fontSize: font.lg, lineHeight: 26 },
  ctaGroup: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, alignItems: "center" },
  ctaWhite: {
    backgroundColor: "#fff",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  ctaWhiteText: { color: colors.brand, fontWeight: weight.bold, fontSize: font.lg },
  ctaOutlineWhite: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
  },
  ctaOutlineWhiteText: { color: "#fff", fontWeight: weight.bold, fontSize: font.lg },
});
