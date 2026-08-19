import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../AuthContext";
import { Body, H1, Input, Label, PrimaryButton, Screen } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: P) {
  const { register, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleKey, setVehicleKey] = useState("small_van");
  const [reg, setReg] = useState("");
  const [make, setMake] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setErr(null);
    try {
      await register({
        name,
        email,
        phone,
        password,
        role: "driver",
        vehicle: { key: vehicleKey, make, reg },
      });
    } catch (e: any) {
      setErr(e?.message || "Registration failed");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <H1>Become a driver</H1>
          <Body muted style={{ marginTop: 6, marginBottom: 20 }}>
            Applications are reviewed by our team before you can accept jobs.
          </Body>
          <Label>Full name</Label>
          <Input value={name} onChangeText={setName} testID="register-name" />
          <Label>Email</Label>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="register-email" />
          <Label>Phone</Label>
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="register-phone" />
          <Label>Password</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry testID="register-password" />
          <Label>Vehicle key (small_van, luton, hgv…)</Label>
          <Input value={vehicleKey} onChangeText={setVehicleKey} autoCapitalize="none" testID="register-vehicle" />
          <Label>Vehicle make</Label>
          <Input value={make} onChangeText={setMake} testID="register-make" />
          <Label>Reg plate</Label>
          <Input value={reg} onChangeText={setReg} autoCapitalize="characters" testID="register-reg" />
          {err && <Body style={{ color: "#DC2626", marginTop: 8 }}>{err}</Body>}
          <PrimaryButton title="Apply" onPress={onSubmit} loading={loading} testID="register-submit" />
          <Body onPress={() => navigation.goBack()} style={{ marginTop: 16, textAlign: "center", color: "#6B7280" }}>
            Already have an account? Sign in
          </Body>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
