import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";

export const CARGO = {
  red: "#D62828",
  redDark: "#B01F1F",
  ink: "#111111",
  muted: "#6B7280",
  hairline: "#E5E7EB",
  offwhite: "#F4F4F4",
  green: "#16A34A",
  bg: "#FFFFFF",
};

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, backgroundColor: CARGO.bg, padding: 20 }, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: any }) {
  return <Text style={[styles.body, muted && { color: CARGO.muted }, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={CARGO.muted} style={styles.input} {...props} />;
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  testID,
  variant = "primary",
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  const base = isPrimary ? { backgroundColor: CARGO.red } : { borderColor: CARGO.ink, borderWidth: 2, backgroundColor: CARGO.bg };
  const color = isPrimary ? "#fff" : CARGO.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [styles.btn, base, (disabled || loading) && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.btnText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: "700", color: CARGO.ink, letterSpacing: -0.3 },
  body: { fontSize: 14, color: CARGO.ink, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: CARGO.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: CARGO.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: CARGO.ink,
    backgroundColor: CARGO.bg,
  },
  btn: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderColor: CARGO.hairline,
    borderRadius: 16,
    padding: 16,
    backgroundColor: CARGO.bg,
  },
});
