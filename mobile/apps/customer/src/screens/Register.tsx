/**
 * RegisterScreen — Cargo One branded sign-up.
 */
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { Input, Label, Page, PrimaryButton } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: P) {
  const { register, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setErr(null);
    try {
      await register({ name, email, phone, password, role: "customer" });
    } catch (e: any) {
      setErr(e?.message || "Registration failed");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page>
        <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
          <Text style={typography.h1Large}>Create account</Text>
          <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 8 }]}>
            You'll be able to book transport and recovery services.
          </Text>
          <Label>Full name</Label>
          <Input value={name} onChangeText={setName} testID="register-name" />
          <Label>Email</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="register-email"
          />
          <Label>Phone</Label>
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="register-phone" />
          <Label>Password</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry testID="register-password" />
          {err && (
            <View style={styles.error} testID="register-error">
              <Text style={{ color: colors.errorInk, fontSize: 13 }}>{err}</Text>
            </View>
          )}
          <View style={{ marginTop: 20 }}>
            <PrimaryButton title="Create account" onPress={onSubmit} loading={loading} testID="register-submit" />
          </View>
          <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16, alignSelf: "center" }}>
            <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Already have an account? Sign in</Text>
          </Pressable>
        </ScrollView>
      </Page>
    </KeyboardAvoidingView>
  );
}

const styles = {
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
};
