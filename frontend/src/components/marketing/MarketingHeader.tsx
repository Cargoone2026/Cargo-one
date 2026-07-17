import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { GlobalSearchModal } from "@/src/components/GlobalSearchModal";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { CONTENT_MAX_WIDTH, useResponsive } from "./breakpoints";

const NAV = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Business", href: "/business" },
  { label: "Drivers", href: "/drivers" },
  { label: "Trust & Safety", href: "/trust-safety" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export function MarketingHeader() {
  const router = useRouter();
  const { user } = useAuth();
  const { isMobile, isTablet } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const showMenuIcon = isMobile || isTablet;

  const goToApp = () => {
    if (!user) return;
    if (user.role === "customer") router.push("/(customer)");
    else if (user.role === "driver") router.push("/(driver)");
    else if (user.role === "admin") router.push("/(admin)");
  };

  return (
    <View
      style={styles.wrap}
      // @ts-ignore - web-only prop
      accessibilityRole={Platform.OS === "web" ? "navigation" : undefined}
    >
      <View style={styles.inner}>
        <Link href="/" asChild>
          <Pressable style={styles.brandRow} testID="marketing-logo">
            <View style={styles.logoBadge}>
              <Ionicons name="cube" size={20} color="#fff" />
            </View>
            <Text style={styles.brand}>CARGO ONE</Text>
          </Pressable>
        </Link>

        {!showMenuIcon && (
          <View style={styles.navRow}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href as any} asChild>
                <Pressable style={styles.navItem}>
                  <Text style={styles.navText}>{item.label}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}

        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => setSearchOpen(true)}
            style={styles.iconBtn}
            testID="marketing-search-open"
            accessibilityLabel="Search Cargo One"
          >
            <Ionicons name="search" size={22} color={colors.text} />
          </Pressable>
          {!showMenuIcon && !user && (
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              style={styles.loginBtn}
              testID="marketing-login"
            >
              <Text style={styles.loginText}>Log in</Text>
            </Pressable>
          )}
          {user ? (
            <Pressable onPress={goToApp} style={styles.signupBtn} testID="marketing-go-to-app">
              <Text style={styles.signupText}>Go to App</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push("/(auth)/register?role=customer")}
              style={styles.signupBtn}
              testID="marketing-signup"
            >
              <Text style={styles.signupText}>Get a Quote</Text>
            </Pressable>
          )}
          {showMenuIcon && (
            <Pressable
              onPress={() => setMenuOpen((v) => !v)}
              style={styles.iconBtn}
              testID="marketing-menu-toggle"
            >
              <Ionicons name={menuOpen ? "close" : "menu"} size={26} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>

      {showMenuIcon && menuOpen && (
        <View style={styles.mobileMenu}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href as any} asChild>
              <Pressable style={styles.mobileMenuItem} onPress={() => setMenuOpen(false)}>
                <Text style={styles.mobileMenuText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </Link>
          ))}
          <Pressable
            style={styles.mobileMenuItem}
            onPress={() => {
              setMenuOpen(false);
              if (user) goToApp();
              else router.push("/(auth)/login");
            }}
          >
            <Text style={styles.mobileMenuText}>{user ? "Go to App" : "Log in"}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      <GlobalSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope="all"
        placeholder="Search categories, vehicles, pages…"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(Platform.OS === "web"
      ? ({ position: "sticky", top: 0, zIndex: 100, backdropFilter: "saturate(180%) blur(10px)" } as any)
      : {}),
  },
  inner: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    marginHorizontal: "auto",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: font.lg, fontWeight: weight.bold, letterSpacing: 1.5, color: colors.text },
  navRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1, justifyContent: "center" },
  navItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  navText: { color: colors.textSecondary, fontSize: font.base, fontWeight: weight.medium },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  loginBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  loginText: { color: colors.text, fontWeight: weight.semibold, fontSize: font.base },
  signupBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  signupText: { color: "#fff", fontWeight: weight.bold, fontSize: font.base },
  iconBtn: { padding: spacing.sm },
  mobileMenu: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
  mobileMenuItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mobileMenuText: { color: colors.text, fontSize: font.lg, fontWeight: weight.medium },
});
