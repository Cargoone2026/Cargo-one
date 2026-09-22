/**
 * RegisterScreen — Cargo One Driver sign-up.
 *
 * Mirrors the web Driver register form (frontend/src/pages/auth/Register.jsx
 * with role=driver):
 *   • Required: name, email, phone (must pass isValidPhone), password.
 *   • Optional address block: line1, line2, town, county, postcode,
 *     country. If UK postcode is supplied it must pass isValidUKPostcode.
 *   • Post-register, backend sets user.status="pending" for drivers →
 *     the AwaitingApproval screen picks them up until an admin approves.
 *   • Does NOT collect vehicle info — that lives on the Fleet screen
 *     after approval, matching web behaviour.
 */
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { Input, Label, Page, PrimaryButton } from "../ui";
import { isValidPhone, isValidUKPostcode } from "../lib/validators";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Register">;

const COUNTRIES = [
  "United Kingdom",
  "Ireland",
  "France",
  "Germany",
  "Netherlands",
  "Belgium",
  "Spain",
  "Italy",
  "Poland",
  "Other",
];

export function RegisterScreen({ navigation }: P) {
  const { register, loading } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    address_line1: "",
    address_line2: "",
    town: "",
    county: "",
    postcode: "",
    country: "United Kingdom",
  });
  const [err, setErr] = useState<string | null>(null);

  const upd = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit() {
    setErr(null);
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setErr("Name, email and password are required.");
      return;
    }
    // Web rule: drivers MUST supply a phone number.
    if (!form.phone.trim()) {
      setErr("Drivers must add a phone number — customers need to be able to reach you after booking.");
      return;
    }
    if (!isValidPhone(form.phone)) {
      setErr("Please enter a valid phone number (e.g. 07700 900 123 or +44 7700 900123).");
      return;
    }
    if (form.postcode && form.country === "United Kingdom" && !isValidUKPostcode(form.postcode)) {
      setErr("Please enter a valid UK postcode (e.g. EC4Y 1AA).");
      return;
    }
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        role: "driver",
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        town: form.town.trim() || null,
        county: form.county.trim() || null,
        postcode: form.postcode.trim() || null,
        country: form.country || null,
      });
      // AuthContext hydrates the new user; App.tsx routes drivers with
      // status!="active" straight to AwaitingApproval automatically.
    } catch (e: any) {
      setErr(e?.message || "Registration failed");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page testID="driver-register">
        <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
          <Text style={typography.h1Large}>Become a driver</Text>
          <Text style={[typography.bodyMuted, { marginTop: 4, marginBottom: 16 }]}>
            Applications are reviewed by our team before you can accept jobs.
          </Text>

          <Label>Full name</Label>
          <Input value={form.name} onChangeText={upd("name")} testID="register-name-input" />

          <Label>Email</Label>
          <Input
            value={form.email}
            onChangeText={upd("email")}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="register-email-input"
          />

          <Label>Phone (required)</Label>
          <Input
            value={form.phone}
            onChangeText={upd("phone")}
            keyboardType="phone-pad"
            placeholder="07700 900 123"
            testID="register-phone-input"
          />
          <Text style={styles.hint}>
            Required for drivers so customers can reach you after booking.
          </Text>

          <Label>Password</Label>
          <Input
            value={form.password}
            onChangeText={upd("password")}
            secureTextEntry
            placeholder="At least 8 characters"
            testID="register-password-input"
          />

          <View style={styles.fieldset}>
            <Text style={styles.fieldsetLegend}>ADDRESS (OPTIONAL)</Text>

            <Label>Address line 1</Label>
            <Input
              value={form.address_line1}
              onChangeText={upd("address_line1")}
              placeholder="12 Fleet Street"
              testID="register-address1-input"
            />

            <Label>Address line 2</Label>
            <Input
              value={form.address_line2}
              onChangeText={upd("address_line2")}
              placeholder="Flat 3, Riverside Building"
              testID="register-address2-input"
            />

            <Label>Town / City</Label>
            <Input
              value={form.town}
              onChangeText={upd("town")}
              placeholder="London"
              testID="register-town-input"
            />

            <Label>County</Label>
            <Input
              value={form.county}
              onChangeText={upd("county")}
              placeholder="Greater London"
              testID="register-county-input"
            />

            <Label>Postcode</Label>
            <Input
              value={form.postcode}
              onChangeText={upd("postcode")}
              autoCapitalize="characters"
              placeholder="EC4Y 1AA"
              testID="register-postcode-input"
            />

            <Label>Country</Label>
            <View style={styles.countryRow} testID="register-country-input">
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => upd("country")(c)}
                  style={[
                    styles.countryChip,
                    form.country === c && styles.countryChipActive,
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: form.country === c ? "#FFFFFF" : colors.ink,
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Driver accounts require admin approval and document upload after registration.
            </Text>
          </View>

          {err && (
            <View style={styles.error} testID="register-error">
              <Text style={{ color: colors.errorInk, fontSize: 13 }}>{err}</Text>
            </View>
          )}

          <View style={{ marginTop: 20 }}>
            <PrimaryButton
              title="Create driver account"
              onPress={onSubmit}
              loading={loading}
              testID="register-submit-button"
            />
          </View>

          <Pressable
            onPress={() => navigation.goBack()}
            style={{ marginTop: 16, alignSelf: "center" }}
            testID="go-login-button"
          >
            <Text style={{ color: colors.inkMuted, fontSize: 14 }}>
              Already have an account? <Text style={{ color: colors.brand, fontWeight: "700" }}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </Page>
    </KeyboardAvoidingView>
  );
}

const styles = {
  hint: { fontSize: 11, color: colors.inkMuted, marginTop: 4, marginBottom: 8 },
  fieldset: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FAFAFA",
  },
  fieldsetLegend: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.6,
    color: colors.inkMuted,
    marginBottom: 8,
  },
  countryRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    marginTop: 4,
  },
  countryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  notice: {
    marginTop: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#FFF7ED",
  },
  noticeText: { fontSize: 13, color: colors.inkMuted, lineHeight: 18 },
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
};
