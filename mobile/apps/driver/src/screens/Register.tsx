/**
 * CargoOne Driver — Register screen. Mirrors the web /auth/register driver flow.
 */
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { isValidPhone } from "../validators";
import { Caption, Input, Label, Page, PageHeader, PrimaryButton, Section, colors, space } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Register">;

const PHONE_MSG = "Please enter a valid phone number (e.g. 07700 900 123 or +44 7700 900123).";

export default function RegisterScreen({ navigation }: P) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email and password are required.");
      return;
    }
    if (!phone.trim()) {
      setError("Drivers must add a phone number — customers need to be able to reach you after booking.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError(PHONE_MSG);
      return;
    }
    setSubmitting(true);
    try {
      // On success the user is set and the app switches to the authenticated
      // stack, where Home shows the pending-approval state (as web /driver).
      await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
    } catch (e: any) {
      setError(e?.message || "Failed to register");
      setSubmitting(false);
    }
  }

  return (
    <Page testID="register-screen">
      <PageHeader
        title="Create driver account"
        subtitle="Join Cargo One and start earning."
        onBack={() => navigation.goBack()}
        large
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Section gap={0} style={{ marginTop: space[2] }}>
          <Label>Full name</Label>
          <Input value={name} onChangeText={setName} autoComplete="name" textContentType="name" editable={!submitting} testID="register-name" />
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
            testID="register-email"
          />
          <Label>Phone (required)</Label>
          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="07700 900 123"
            editable={!submitting}
            testID="register-phone"
          />
          <Caption style={{ marginTop: 4 }}>Required for drivers so customers can reach you after booking.</Caption>
          <Label>Password</Label>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!submitting}
            testID="register-password"
          />

          <View style={styles.info} testID="register-approval-note">
            <Text style={styles.infoText}>
              Driver accounts require admin approval and document upload after registration.
            </Text>
          </View>

          {error ? <Text style={styles.error} testID="register-error">{error}</Text> : null}

          <View style={{ height: space[4] }} />
          <PrimaryButton title="Create driver account" onPress={onSubmit} loading={submitting} testID="register-submit" />

          <Caption style={{ marginTop: space[4], textAlign: "center" }}>
            By creating an account you agree to our{" "}
            <Text style={styles.inlineLink} onPress={() => navigation.navigate("Legal", { slug: "terms" })} testID="register-terms-link">
              Terms & Conditions
            </Text>{" "}
            and{" "}
            <Text style={styles.inlineLink} onPress={() => navigation.navigate("Legal", { slug: "privacy" })} testID="register-privacy-link">
              Privacy Policy
            </Text>
            .
          </Caption>

          <Pressable onPress={() => navigation.goBack()} style={{ marginTop: space[4], alignSelf: "center" }} testID="go-login-button">
            <Caption>
              Have an account? <Text style={{ fontWeight: "700", color: colors.brand }}>Log in</Text>
            </Caption>
          </Pressable>
        </Section>
      </KeyboardAvoidingView>
    </Page>
  );
}

const styles = StyleSheet.create({
  info: { marginTop: space[4], padding: space[3], borderRadius: 12, backgroundColor: "#FFF7ED" },
  infoText: { fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  error: { marginTop: space[3], color: colors.error, fontSize: 14, fontWeight: "500" },
  inlineLink: { fontWeight: "700", color: colors.brand },
});
