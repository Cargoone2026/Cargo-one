import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, radius, spacing, weight, STATUS_LABELS, STATUS_COLOR } from "@/src/theme";

export function StatusPill({ status, testID }: { status: string; testID?: string }) {
  const c = STATUS_COLOR[status] || { bg: colors.bgSecondary, fg: colors.text };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]} testID={testID}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.text, { color: c.fg }]}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    gap: spacing.xs,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: font.sm, fontWeight: weight.semibold, letterSpacing: 0.2 },
});
