/**
 * CargoOne Driver — Login screen.
 *
 * Faithful mobile adaptation of the Driver web `/auth/login` page,
 * styled with the CargoOne mobile design system (Customer-parity).
 */
import React, { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View,
} from "react-native";
import {
  Page, PageHeader, Section, Input, Label, PrimaryButton,
  Caption, colors, space,
} from "../ui";
import { useAuth } from "../AuthContext";

type P = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: P) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page testID="login-screen">
      <PageHeader title="Welcome back" subtitle="Log in to keep earning." large />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Section gap={0} style={{ marginTop: space[2] }}>
          <Label>Email</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            placeholder="you@example.com"
            editable={!submitting}
            testID="login-email-input"
            returnKeyType="next"
          />

          <Label>Password</Label>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            placeholder="••••••••"
            editable={!submitting}
            testID="login-password-input"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          {error ? (
            <Text style={styles.error} testID="login-error">{error}</Text>
          ) : null}

          <View style={{ height: space[5] }} />

          <PrimaryButton
            title="Log in"
            onPress={onSubmit}
            loading={submitting}
            testID="login-submit-button"
          />

          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            style={{ marginTop: space[5], alignSelf: "center" }}
            testID="forgot-password-link"
          >
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Register")}
            style={{ marginTop: space[2], alignSelf: "center" }}
            testID="go-register-button"
          >
            <Caption>
              New driver?{" "}
              <Text style={{ fontWeight: "700", color: colors.brand }}>Create an account</Text>
            </Caption>
          </Pressable>
        </Section>
      </KeyboardAvoidingView>
    </Page>
  );
}

const styles = StyleSheet.create({
  error: {
    marginTop: space[2],
    marginHorizontal: 0,
    color: colors.error,
    fontSize: 14,
    fontWeight: "500",
  },
  link: { fontSize: 14, fontWeight: "700", color: colors.brand },
});
