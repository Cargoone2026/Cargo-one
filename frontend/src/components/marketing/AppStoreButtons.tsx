import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { font, radius, spacing, weight } from "@/src/theme";

type Props = { onWhite?: boolean };

export function AppStoreButtons({ onWhite = false }: Props) {
  const openStore = (which: "app" | "play") => {
    if (Platform.OS === "web") {
      const url =
        which === "app"
          ? "https://apps.apple.com/app/cargo-one"
          : "https://play.google.com/store/apps/details?id=com.cargoone.app";
      (globalThis as any).open?.(url, "_blank");
    }
  };
  const bg = onWhite ? "#111" : "#fff";
  const fg = onWhite ? "#fff" : "#111";
  const border = onWhite ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.15)";

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => openStore("app")}
        style={[styles.btn, { backgroundColor: bg, borderColor: border }]}
      >
        <Ionicons name="logo-apple" size={26} color={fg} />
        <View>
          <Text style={[styles.small, { color: fg }]}>Download on the</Text>
          <Text style={[styles.big, { color: fg }]}>App Store</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => openStore("play")}
        style={[styles.btn, { backgroundColor: bg, borderColor: border }]}
      >
        <Ionicons name="logo-google-playstore" size={24} color={fg} />
        <View>
          <Text style={[styles.small, { color: fg }]}>Get it on</Text>
          <Text style={[styles.big, { color: fg }]}>Google Play</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" as any },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 160,
  },
  small: { fontSize: 10, fontWeight: weight.medium, letterSpacing: 0.5 },
  big: { fontSize: font.lg, fontWeight: weight.bold, marginTop: -2 },
});
