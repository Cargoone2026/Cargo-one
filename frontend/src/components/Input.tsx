import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { colors, font, radius, spacing, weight } from "@/src/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  containerStyle?: any;
  testID?: string;
};

export function Input({ label, error, containerStyle, testID, ...rest }: Props) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, error ? { borderColor: colors.error } : undefined]}
        testID={testID}
        {...rest}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: font.sm,
    color: colors.textSecondary,
    fontWeight: weight.medium,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.lg,
    color: colors.text,
  },
  err: { color: colors.error, fontSize: font.sm, marginTop: spacing.xs },
});
