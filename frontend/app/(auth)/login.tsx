import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, spacing, weight } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => router.back()}
            style={styles.back}
            testID="back-button"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Log in to continue your shipments.</Text>

          <View style={{ height: spacing.xl }} />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="login-email-input"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            testID="login-password-input"
          />

          {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}

          <Button
            title="Log in"
            onPress={onSubmit}
            loading={loading}
            testID="login-submit-button"
            style={{ marginTop: spacing.md }}
          />

          <Pressable
            onPress={() => router.replace("/(auth)/register?role=customer")}
            style={styles.reg}
            testID="go-register-button"
          >
            <Text style={styles.regText}>
              New here? <Text style={styles.regLink}>Create an account</Text>
            </Text>
          </Pressable>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo Admin Account</Text>
            <Text style={styles.demoText}>admin@cargoone.com / admin123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    width: "100%",
    maxWidth: 460,
    marginHorizontal: "auto",
    ...(Platform.OS === "web" ? { minHeight: "100vh" as any, justifyContent: "center" } : {}),
  },
  back: { alignSelf: "flex-start", marginBottom: spacing.lg, padding: spacing.xs },
  title: { fontSize: 32, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: font.lg, color: colors.textSecondary, marginTop: spacing.xs },
  err: { color: colors.error, marginBottom: spacing.md, fontSize: font.base },
  reg: { alignItems: "center", marginTop: spacing.xl, paddingVertical: spacing.sm },
  regText: { color: colors.textSecondary },
  regLink: { color: colors.brand, fontWeight: weight.semibold },
  demoBox: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
  },
  demoTitle: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.semibold, letterSpacing: 0.6, textTransform: "uppercase" },
  demoText: { fontSize: font.base, color: colors.text, marginTop: spacing.xs, fontWeight: weight.medium },
});
