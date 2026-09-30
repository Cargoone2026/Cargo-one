/**
 * CargoOne Driver — Login screen.
 *
 * Faithful mobile adaptation of the web /auth/login page
 * (frontend/src/pages/auth/Login.jsx). Copy, colours, spacing, focus
 * ring and CTA style all mirror web. Passkey / Forgot-password /
 * Register hooks are visible but stubbed in Phase 1 — they are wired
 * in a subsequent phase.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { colors, radius, spacing, typography } from "../theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Auth state flip drives the navigator switch — no manual navigate.
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function onPasskey() {
    Alert.alert("Coming soon", "Passkey sign-in will be available in the next Driver release.");
  }

  function onForgot() {
    Alert.alert(
      "Reset your password",
      "For now, please reset your password on cargoone.co.uk/auth/forgot-password.",
    );
  }

  function onRegister() {
    Alert.alert(
      "Create a driver account",
      "New driver registration will be available in the next Driver release. Please register on cargoone.co.uk/auth/register.",
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          testID="login-screen"
        >
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to keep earning.</Text>

          <View style={{ height: spacing.xl }} />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            editable={!submitting}
            testID="login-email-input"
            returnKeyType="next"
          />

          <View style={{ height: spacing.md }} />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, passwordFocused && styles.inputFocused]}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            editable={!submitting}
            testID="login-password-input"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !submitting && { backgroundColor: colors.brandHover },
              submitting && { opacity: 0.6 },
            ]}
            testID="login-submit-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <Text style={styles.primaryButtonText}>Log in</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={onPasskey}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && { backgroundColor: colors.inputBg },
            ]}
            testID="login-passkey-button"
          >
            <Text style={styles.secondaryButtonText}>Sign in with Passkey</Text>
          </Pressable>

          <Pressable onPress={onForgot} testID="forgot-password-link">
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <Pressable onPress={onRegister} testID="go-register-button">
            <Text style={styles.mutedRow}>
              New driver? <Text style={styles.linkInline}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.xs,
    ...typography.body,
    color: colors.textMuted,
  },
  label: {
    marginBottom: spacing.xs,
    ...typography.label,
    color: colors.text,
  },
  input: {
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.brand,
  },
  error: {
    marginTop: spacing.md,
    color: colors.danger,
    ...typography.bodySm,
    fontWeight: "500",
  },
  primaryButton: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.textOnDark,
  },
  dividerRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.dividerLight,
  },
  secondaryButton: {
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  link: {
    marginTop: spacing.lg,
    textAlign: "center",
    ...typography.bodySm,
    fontWeight: "600",
    color: colors.brand,
  },
  mutedRow: {
    marginTop: spacing.md,
    textAlign: "center",
    ...typography.bodySm,
    color: colors.textMuted,
  },
  linkInline: {
    fontWeight: "700",
    color: colors.brand,
  },
});
