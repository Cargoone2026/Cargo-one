/**
 * LoginScreen — Cargo One driver sign-in, matches customer Login
 * branding exactly (dark lockup, brand mark, Face ID button).
 */
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isPasskeySupported, loginWithPasskey } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { Input, Label, Page, PrimaryButton, SecondaryButton } from "../ui";
import { colors, radius, typography } from "../theme";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: P) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "password" | "passkey">(null);
  const [err, setErr] = useState<string | null>(null);

  async function onPasswordLogin() {
    setErr(null);
    setBusy("password");
    try {
      await login(email, password);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPasskeyLogin() {
    if (!email.trim()) {
      setErr("Enter your email first to sign in with a passkey.");
      return;
    }
    if (!(await isPasskeySupported())) {
      setErr("Passkeys aren't available on this device.");
      return;
    }
    setBusy("passkey");
    try {
      const res = await loginWithPasskey(email);
      if (res.user.role !== "driver") {
        throw new Error("This app is for drivers. Please use the customer app.");
      }
    } catch (e: any) {
      setErr(e?.message || "Passkey login failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page>
        <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>C1</Text>
            </View>
            <Text style={styles.brandTitle}>CARGO ONE</Text>
            <Text style={styles.brandRole}>Driver</Text>
          </View>

          <Text style={[typography.h1Large, { marginTop: 32 }]}>Welcome back</Text>
          <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 8 }]}>Sign in to Cargo One.</Text>

          <Label>Email</Label>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="login-email" />
          <Label>Password</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry testID="login-password" />

          {err && (
            <View style={styles.error} testID="login-error">
              <Text style={{ color: colors.errorInk, fontSize: 13 }}>{err}</Text>
            </View>
          )}

          <View style={{ marginTop: 24, gap: 12 }}>
            <PrimaryButton title="Log in" onPress={onPasswordLogin} loading={busy === "password"} testID="login-submit" />
            <SecondaryButton title="Sign in with Face ID" onPress={onPasskeyLogin} loading={busy === "passkey"} testID="login-passkey" />
          </View>

          <View style={{ marginTop: 24, flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable onPress={() => navigation.navigate("Register")}>
              <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 14 }}>Create account</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("PasswordReset")}>
              <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Forgot password?</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Page>
    </KeyboardAvoidingView>
  );
}

const styles = {
  brand: { alignItems: "center" as const, gap: 8, marginTop: 40 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  markText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" as const, letterSpacing: 1 },
  brandTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" as const, letterSpacing: 1.6, marginTop: 6 },
  brandRole: { color: colors.inkMuted, fontSize: 12, letterSpacing: 0.4 },
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
};
