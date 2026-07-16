import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, radius, spacing, weight } from "@/src/theme";
import { storage } from "@/src/utils/storage";

import { useResponsive } from "./breakpoints";

const KEY = "cargoone.cookie_consent.v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const { isMobile } = useResponsive();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let alive = true;
    (async () => {
      const v = await storage.getItem(KEY, "");
      if (alive && !v) setVisible(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!visible || Platform.OS !== "web") return null;

  const decide = async (choice: "accepted" | "rejected") => {
    await storage.setItem(KEY, choice);
    setVisible(false);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
          <Text style={styles.title}>Cookies on Cargo One</Text>
        </View>
        <Text style={styles.body}>
          We use essential cookies to run the site and analytics cookies to understand how you use
          it, so we can improve the experience. Accept all, or reject non-essential ones.
        </Text>
        <View style={[styles.actions, isMobile && { flexDirection: "column", alignItems: "stretch" }]}>
          <Pressable style={styles.btnGhost} onPress={() => decide("rejected")}>
            <Text style={styles.btnGhostText}>Reject non-essential</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={() => decide("accepted")}>
            <Text style={styles.btnPrimaryText}>Accept all</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute" as any,
    ...(Platform.OS === "web" ? ({ position: "fixed" } as any) : {}),
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    zIndex: 200,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#0F1115",
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold },
  body: { color: "rgba(255,255,255,0.7)", fontSize: font.sm, lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "flex-end" },
  btnGhost: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  btnGhostText: { color: "#fff", fontWeight: weight.semibold, fontSize: font.sm },
  btnPrimary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: weight.bold, fontSize: font.sm },
});
