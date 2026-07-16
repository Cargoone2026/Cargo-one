import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, radius, spacing, weight } from "@/src/theme";

import { CONTENT_MAX_WIDTH, useResponsive } from "./breakpoints";

type Props = {
  bgImage?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  compact?: boolean;
  align?: "left" | "center";
};

export function Hero({
  bgImage,
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  compact = false,
  align = "left",
}: Props) {
  const router = useRouter();
  const { isMobile } = useResponsive();
  const overlayColors: [string, string, string] = compact
    ? ["rgba(0,0,0,0.55)", "rgba(0,0,0,0.65)", "rgba(0,0,0,0.75)"]
    : ["rgba(0,0,0,0.35)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.85)"];

  const inner = (
    <View
      style={{
        width: "100%",
        maxWidth: CONTENT_MAX_WIDTH,
        marginHorizontal: "auto",
        paddingHorizontal: isMobile ? spacing.lg : spacing.xxl,
        paddingVertical: compact ? spacing.xxxl : spacing.xxxl + spacing.xl,
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {eyebrow ? (
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowText}>{eyebrow}</Text>
        </View>
      ) : null}
      <Text
        style={[
          styles.title,
          {
            fontSize: compact ? (isMobile ? 32 : 44) : isMobile ? 40 : 60,
            lineHeight: compact ? (isMobile ? 36 : 50) : isMobile ? 44 : 66,
            textAlign: align,
            maxWidth: 860,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { textAlign: align, maxWidth: 640, fontSize: isMobile ? font.lg : font.xl },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}

      {(primaryCta || secondaryCta) && (
        <View style={[styles.ctaRow, align === "center" && { justifyContent: "center" }]}>
          {primaryCta && (
            <Pressable
              onPress={() => router.push(primaryCta.href as any)}
              style={styles.primary}
              testID="hero-primary"
            >
              <Text style={styles.primaryText}>{primaryCta.label}</Text>
            </Pressable>
          )}
          {secondaryCta && (
            <Pressable
              onPress={() => router.push(secondaryCta.href as any)}
              style={styles.secondary}
              testID="hero-secondary"
            >
              <Text style={styles.secondaryText}>{secondaryCta.label}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  if (!bgImage) {
    return (
      <View style={[styles.wrap, { backgroundColor: "#0B0B0F" }]}>{inner}</View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ImageBackground
        source={{ uri: bgImage }}
        style={StyleSheet.absoluteFill as any}
        // @ts-ignore web-only
        {...(Platform.OS === "web" ? { imageStyle: { objectFit: "cover" } as any } : {})}
        resizeMode="cover"
      />
      <LinearGradient colors={overlayColors} style={StyleSheet.absoluteFill} />
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", backgroundColor: "#111", overflow: "hidden" },
  eyebrowPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(214,40,40,0.9)",
    marginBottom: spacing.md,
  },
  eyebrowText: { color: "#fff", fontWeight: weight.bold, letterSpacing: 1, fontSize: font.sm },
  title: {
    color: "#fff",
    fontWeight: weight.bold,
    letterSpacing: -1,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: spacing.lg,
    lineHeight: 28,
  },
  ctaRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl + spacing.sm,
    flexWrap: "wrap" as any,
  },
  primary: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: 52,
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: weight.bold, fontSize: font.lg },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: 52,
    justifyContent: "center",
  },
  secondaryText: { color: "#fff", fontWeight: weight.semibold, fontSize: font.lg },
});
