/**
 * EditProfileScreen — native equivalent of the inline edit-profile form
 * inside frontend/src/pages/portal/customer/Profile.jsx.
 *
 * Uses the SAME backend contract as web: PUT /auth/me with a whitelist
 * of {name, phone, address_line1, address_line2, town, county, postcode,
 * country}. Email stays read-only (server also rejects email changes).
 */
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomerAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "EditProfile">;

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

export function EditProfileScreen({ navigation }: P) {
  const { user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    address_line1: user?.address_line1 || "",
    address_line2: user?.address_line2 || "",
    town: user?.town || "",
    county: user?.county || "",
    postcode: user?.postcode || "",
    country: user?.country || "United Kingdom",
  });

  const setField = (key: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await CustomerAPI.updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        town: form.town.trim() || null,
        county: form.county.trim() || null,
        postcode: form.postcode.trim() || null,
        country: form.country || null,
      });
      await refresh();
      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      setErr(e?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Profile");

  return (
    <Page testID="edit-profile-screen" scroll={false}>
      <PageHeader title="Edit profile" onBack={goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Full name" value={form.name} onChangeText={setField("name")} testID="edit-name" />
          <Field
            label="Phone"
            value={form.phone}
            onChangeText={setField("phone")}
            placeholder="07700 900 123"
            keyboardType="phone-pad"
            testID="edit-phone"
          />

          <Text style={[typography.micro, { marginTop: 4 }]}>ADDRESS</Text>
          <Field label="Address line 1" value={form.address_line1} onChangeText={setField("address_line1")} placeholder="12 Fleet Street" testID="edit-address1" />
          <Field label="Address line 2" value={form.address_line2} onChangeText={setField("address_line2")} placeholder="Flat 3, Riverside Building" testID="edit-address2" />
          <Field label="Town / City" value={form.town} onChangeText={setField("town")} placeholder="London" testID="edit-town" />
          <Field label="County" value={form.county} onChangeText={setField("county")} placeholder="Greater London" testID="edit-county" />
          <Field label="Postcode" value={form.postcode} onChangeText={setField("postcode")} placeholder="EC4Y 1AA" autoCapitalize="characters" testID="edit-postcode" />

          {/* Country picker (chip list — matches native pattern used elsewhere) */}
          <View>
            <Text style={styles.label}>Country</Text>
            <View style={styles.chipWrap}>
              {COUNTRIES.map((c) => {
                const active = form.country === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setForm((f) => ({ ...f, country: c }))}
                    style={[styles.chip, active && styles.chipActive]}
                    testID={`edit-country-${c.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Text style={[styles.chipText, active && { color: "#FFFFFF" }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Read-only email */}
          <View>
            <Text style={styles.label}>Email</Text>
            <View style={styles.readonly} testID="edit-email-readonly">
              <Text style={{ flex: 1, color: colors.inkMuted, fontSize: 14 }}>{user?.email}</Text>
              <Text style={styles.lockPill}>LOCKED</Text>
            </View>
            <Text style={[typography.small, { marginTop: 4 }]}>
              Email changes require a verified email-change flow (coming soon).
            </Text>
          </View>

          {err ? (
            <Text style={{ color: "#DC2626", fontSize: 12 }} testID="edit-error">
              {err}
            </Text>
          ) : null}

          <PrimaryButton title="Save changes" onPress={save} loading={saving} testID="edit-save" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}

function Field({
  label,
  testID,
  ...props
}: {
  label: string;
  testID?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={colors.inkMuted}
        testID={testID}
      />
    </View>
  );
}

const styles = {
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: colors.ink,
    marginBottom: 6,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    fontSize: 14,
    color: colors.ink,
  },
  chipWrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: { fontSize: 13, fontWeight: "600" as const, color: colors.ink },
  readonly: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  lockPill: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
    color: colors.inkMuted,
  },
};
