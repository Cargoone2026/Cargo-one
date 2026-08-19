import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isPasskeySupported, loginWithPasskey } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { Body, H1, Input, Label, PrimaryButton, Screen, Row } from "../ui";
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
      if (res.user.role !== "customer") {
        throw new Error("This app is for customers. Please use the driver app.");
      }
      // Trigger auth refresh — bearer token already saved by core.
      await login(email, password || "").catch(() => {}); // password may be empty; ignored
      Alert.alert("Signed in", "Welcome back to CargoOne.");
    } catch (e: any) {
      setErr(e?.message || "Passkey login failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <H1>Welcome back</H1>
          <Body muted style={{ marginTop: 6, marginBottom: 24 }}>
            Sign in to CargoOne.
          </Body>

          <Label>Email</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="login-email"
          />

          <Label>Password</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry testID="login-password" />

          {err && (
            <Body style={{ color: "#DC2626", marginTop: 8 }} testID="login-error">
              {err}
            </Body>
          )}

          <Row style={{ marginTop: 20, flexDirection: "column", gap: 12 }}>
            <PrimaryButton title="Log in" onPress={onPasswordLogin} loading={busy === "password"} testID="login-submit" />
            <PrimaryButton
              title="Sign in with Face ID / Passkey"
              variant="secondary"
              onPress={onPasskeyLogin}
              loading={busy === "passkey"}
              testID="login-passkey"
            />
          </Row>

          <Row style={{ marginTop: 24, justifyContent: "space-between" }}>
            <Body onPress={() => navigation.navigate("Register")} style={{ color: "#D62828", fontWeight: "700" }}>
              Create account
            </Body>
            <Body onPress={() => navigation.navigate("PasswordReset")} style={{ color: "#6B7280" }}>
              Forgot password?
            </Body>
          </Row>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
