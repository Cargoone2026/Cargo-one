import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, radius, shadow, spacing, weight } from "@/src/theme";

type Props = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
  accent?: boolean;
};

export function FeatureCard({ icon, title, body, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.accentCard]}>
      <View style={[styles.iconWrap, accent && styles.accentIcon]}>
        <Ionicons name={icon} size={24} color={accent ? "#fff" : colors.brand} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
    minWidth: 240,
    flexBasis: 260,
    flexGrow: 1,
  },
  accentCard: { backgroundColor: "#0B0B0F", borderColor: "#111" },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  accentIcon: { backgroundColor: colors.brand },
  title: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  body: { fontSize: font.base, color: colors.textSecondary, lineHeight: 22 },
});
