/**
 * ChangePasswordScreen — native equivalent of the web
 * ChangePasswordModal opened from Profile.jsx. Uses the SAME backend
 * contract: POST /auth/me/change-password with { current_password,
 * new_password } and receives a new bearer token which we store via
 * AuthContext.refresh (the api layer sends it as a cookie/bearer).
 */
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomerAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "ChangePassword">;

export function ChangePasswordScreen({ navigation }: P) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmVal, setConfirmVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Profile");

  const submit = async () => {
    setErr(null);
    if (!current || !next) {
      setErr("Both current and new password are required.");
      return;
    }
    if (next.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirmVal) {
      setErr("New password and confirmation don't match.");
      return;
    }
    if (next === current) {
      setErr("New password must differ from current password.");
      return;
    }
    setBusy(true);
    try {
      await CustomerAPI.changePassword(current, next);
      Alert.alert("Password updated", "Your password has been changed.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      setErr(e?.message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page testID="change-password-screen" scroll={false}>
      <PageHeader title="Change password" onBack={goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={typography.body}>
            To keep your account secure we need your current password before setting a new one.
          </Text>

          <Field label="Current password" value={current} onChangeText={setCurrent} secure testID="change-current" />
          <Field label="New password" value={next} onChangeText={setNext} secure testID="change-new" />
          <Field label="Confirm new password" value={confirmVal} onChangeText={setConfirmVal} secure testID="change-confirm" />

          {err ? (
            <Text style={{ color: "#DC2626", fontSize: 12 }} testID="change-error">
              {err}
            </Text>
          ) : null}

          <PrimaryButton title="Update password" onPress={submit} loading={busy} testID="change-submit" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}

function Field({
  label,
  secure,
  testID,
  ...props
}: {
  label: string;
  secure?: boolean;
  testID?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        placeholderTextColor={colors.inkMuted}
        testID={testID}
      />
    </View>
  );
}

const styles = {
  label: { fontSize: 13, fontWeight: "600" as const, color: colors.ink, marginBottom: 6 },
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
};
