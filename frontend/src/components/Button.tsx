import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

import { colors, font, radius, spacing, weight } from "@/src/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "dark";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  fullWidth?: boolean;
  small?: boolean;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  testID,
  fullWidth = true,
  small = false,
}: Props) {
  const isDisabled = disabled || loading;
  const containerStyles: ViewStyle[] = [
    styles.base,
    small ? styles.small : styles.regular,
    fullWidth ? { alignSelf: "stretch" } : { alignSelf: "flex-start" },
  ];
  let textColor = colors.textInverse;
  if (variant === "primary") {
    containerStyles.push({ backgroundColor: colors.brand });
  } else if (variant === "secondary") {
    containerStyles.push({ backgroundColor: colors.accent });
  } else if (variant === "outline") {
    containerStyles.push({
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.text,
    });
    textColor = colors.text;
  } else if (variant === "ghost") {
    containerStyles.push({ backgroundColor: colors.bgSecondary });
    textColor = colors.text;
  } else if (variant === "dark") {
    containerStyles.push({ backgroundColor: colors.bgDark });
  }
  if (isDisabled) containerStyles.push({ opacity: 0.5 });

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[containerStyles, style]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize: small ? font.base : font.lg }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  regular: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md + 2, minHeight: 52 },
  small: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 36 },
  text: { fontWeight: weight.semibold },
});
