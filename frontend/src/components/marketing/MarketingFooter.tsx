import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { CONTENT_MAX_WIDTH, useResponsive } from "./breakpoints";

const COLUMNS = [
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Trust & Safety", href: "/trust-safety" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Parcels & Packages", href: "/services" },
      { label: "Pallets & Freight", href: "/services" },
      { label: "House Moves", href: "/services" },
      { label: "Vehicles", href: "/services" },
      { label: "Business Accounts", href: "/business" },
    ],
  },
  {
    heading: "Drivers",
    links: [
      { label: "Become a Driver", href: "/drivers" },
      { label: "Driver Requirements", href: "/drivers" },
      { label: "Earnings", href: "/drivers" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/settings/privacy" },
      { label: "Terms of Service", href: "/settings/terms" },
      { label: "Cookie Policy", href: "/settings/cookies" },
      { label: "FAQ", href: "/faq" },
    ],
  },
];

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    (globalThis as any).alert?.(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function MarketingFooter() {
  const { isMobile } = useResponsive();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.includes("@")) {
      showAlert("Invalid email", "Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/newsletter/subscribe", { method: "POST", body: { email }, auth: false });
      showAlert("Subscribed", "Thanks — you're on the list!");
      setEmail("");
    } catch (e: any) {
      showAlert("Signup failed", e?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <View style={[styles.grid, isMobile && { flexDirection: "column" }]}>
          <View style={[styles.brandCol, isMobile && { marginBottom: spacing.xl }]}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="cube" size={20} color="#fff" />
              </View>
              <Text style={styles.brand}>CARGO ONE</Text>
            </View>
            <Text style={styles.tagline}>Ship Anything. Anywhere. Instant Quotes.</Text>

            <View style={styles.newsletter}>
              <Text style={styles.newsHead}>Stay in the loop</Text>
              <Text style={styles.newsSub}>Product updates, launch news, and driver stories.</Text>
              <View style={styles.emailRow}>
                <TextInput
                  placeholder="your@email.com"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  testID="newsletter-email"
                />
                <Pressable
                  onPress={submit}
                  disabled={submitting}
                  style={[styles.subBtn, submitting && { opacity: 0.6 }]}
                  testID="newsletter-submit"
                >
                  <Text style={styles.subBtnText}>{submitting ? "..." : "Subscribe"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.socialRow}>
              {[
                { icon: "logo-facebook", href: "https://facebook.com" },
                { icon: "logo-twitter", href: "https://twitter.com" },
                { icon: "logo-instagram", href: "https://instagram.com" },
                { icon: "logo-linkedin", href: "https://linkedin.com" },
              ].map((s) => (
                <Pressable
                  key={s.icon}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      (globalThis as any).open?.(s.href, "_blank");
                    }
                  }}
                  style={styles.socialIcon}
                  accessibilityLabel={s.icon}
                >
                  <Ionicons name={s.icon as any} size={18} color="#fff" />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.linksGrid, isMobile && { flexDirection: "column" }]}>
            {COLUMNS.map((col) => (
              <View key={col.heading} style={styles.col}>
                <Text style={styles.colHead}>{col.heading}</Text>
                {col.links.map((l) => (
                  <Link key={l.label} href={l.href as any} asChild>
                    <Pressable style={styles.linkRow}>
                      <Text style={styles.linkText}>{l.label}</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.copy}>© {new Date().getFullYear()} Cargo One Ltd. Registered in England &amp; Wales.</Text>
          <View style={styles.legalLinks}>
            <Link href="/settings/terms" asChild>
              <Pressable>
                <Text style={styles.copyLink}>Terms</Text>
              </Pressable>
            </Link>
            <Text style={styles.copyDot}>•</Text>
            <Link href="/settings/privacy" asChild>
              <Pressable>
                <Text style={styles.copyLink}>Privacy</Text>
              </Pressable>
            </Link>
            <Text style={styles.copyDot}>•</Text>
            <Link href="/settings/cookies" asChild>
              <Pressable>
                <Text style={styles.copyLink}>Cookies</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#0B0B0F", width: "100%" },
  inner: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    marginHorizontal: "auto",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxxl,
  },
  grid: { flexDirection: "row", gap: spacing.xxxl },
  brandCol: { flex: 1.2, gap: spacing.lg, minWidth: 260 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold, letterSpacing: 1.5 },
  tagline: { color: "rgba(255,255,255,0.65)", fontSize: font.base, maxWidth: 320 },
  newsletter: { marginTop: spacing.sm, gap: spacing.sm },
  newsHead: { color: "#fff", fontSize: font.lg, fontWeight: weight.semibold },
  newsSub: { color: "rgba(255,255,255,0.55)", fontSize: font.sm },
  emailRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs, maxWidth: 380 },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    fontSize: font.base,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  subBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
  },
  subBtnText: { color: "#fff", fontWeight: weight.bold, fontSize: font.base },
  socialRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  linksGrid: { flex: 2, flexDirection: "row", gap: spacing.xl, flexWrap: "wrap" as any },
  col: { minWidth: 140, gap: spacing.xs },
  colHead: { color: "#fff", fontSize: font.base, fontWeight: weight.bold, marginBottom: spacing.sm, letterSpacing: 0.5 },
  linkRow: { paddingVertical: spacing.xs },
  linkText: { color: "rgba(255,255,255,0.65)", fontSize: font.base },
  bottomRow: {
    marginTop: spacing.xxxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap" as any,
    gap: spacing.md,
  },
  copy: { color: "rgba(255,255,255,0.45)", fontSize: font.sm },
  legalLinks: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  copyLink: { color: "rgba(255,255,255,0.65)", fontSize: font.sm },
  copyDot: { color: "rgba(255,255,255,0.3)", fontSize: font.sm },
});
