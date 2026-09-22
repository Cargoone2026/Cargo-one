/**
 * SettingsScreen — driver account: edit profile + change password + logout.
 *
 * R71.16.12 (Driver final pass) — extends the previous Passkeys/Logout-only
 * settings with:
 *   • Profile editor (name + phone) → PUT /auth/me
 *   • Password change → POST /auth/me/change-password
 * Both call DriverAPI wrappers. Errors are surfaced inline; success
 * refreshes the auth context so the header identity block updates.
 */
import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Key, Lock, LogOut, Save, UserCircle2 } from "lucide-react-native";
import { DriverAPI } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { Input, Label, MenuRow, Page, PageHeader, PrimaryButton } from "../ui";
import { useShellMenu } from "../components/AppShell";

export function SettingsScreen({ navigation }: any) {
  const { user, logout, refresh } = useAuth();
  const { openDrawer, showMenu } = useShellMenu();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  const saveProfile = async () => {
    if (savingProfile) return;
    setProfileErr(null);
    setProfileOk(false);
    setSavingProfile(true);
    try {
      const patch: Record<string, unknown> = {};
      if (name && name !== user?.name) patch.name = name.trim();
      if (phone !== (user as any)?.phone) patch.phone = phone.trim();
      if (Object.keys(patch).length === 0) {
        setProfileErr("Nothing to save.");
        return;
      }
      await DriverAPI.updateProfile(patch);
      await refresh();
      setProfileOk(true);
    } catch (e: any) {
      setProfileErr(e?.message || "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (changingPw) return;
    setPwErr(null);
    setPwOk(false);
    if (!currentPassword) return setPwErr("Enter your current password.");
    if (!newPassword || newPassword.length < 8) return setPwErr("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setPwErr("New passwords do not match.");
    if (newPassword === currentPassword) return setPwErr("New password must differ from current.");
    setChangingPw(true);
    try {
      await DriverAPI.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwOk(true);
    } catch (e: any) {
      setPwErr(e?.message || "Could not change password.");
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <Page testID="driver-settings">
      <ScrollView keyboardShouldPersistTaps="handled">
        <PageHeader large title="Settings" showMenu={showMenu} onMenuPress={openDrawer} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          <View style={styles.identity}>
            <Text style={typography.micro}>Signed in as</Text>
            <Text style={[typography.strong, { marginTop: 4 }]}>{user?.name}</Text>
            <Text style={[typography.caption, { marginTop: 2 }]}>{user?.email}</Text>
          </View>

          {/* Profile editor */}
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <UserCircle2 size={16} color={colors.brand} />
              <Text style={typography.cardTitle}>Profile</Text>
            </View>
            <Label>Name</Label>
            <Input value={name} onChangeText={setName} testID="settings-name" />
            <Label>Phone</Label>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="07700 900123 or +44 ..."
              keyboardType="phone-pad"
              testID="settings-phone"
            />
            {profileErr ? (
              <Text style={{ marginTop: 8, fontSize: 13, color: colors.error }} testID="settings-profile-error">
                {profileErr}
              </Text>
            ) : null}
            {profileOk ? (
              <Text style={{ marginTop: 8, fontSize: 13, color: colors.success }} testID="settings-profile-ok">
                Profile updated.
              </Text>
            ) : null}
            <PrimaryButton
              title="Save profile"
              onPress={saveProfile}
              loading={savingProfile}
              testID="settings-save-profile"
              style={{ marginTop: 12 }}
            />
          </View>

          {/* Password */}
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Lock size={16} color={colors.brand} />
              <Text style={typography.cardTitle}>Change password</Text>
            </View>
            <Label>Current password</Label>
            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoComplete="current-password"
              testID="settings-current-password"
            />
            <Label>New password</Label>
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              testID="settings-new-password"
            />
            <Label>Confirm new password</Label>
            <Input
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              testID="settings-confirm-password"
            />
            {pwErr ? (
              <Text style={{ marginTop: 8, fontSize: 13, color: colors.error }} testID="settings-password-error">
                {pwErr}
              </Text>
            ) : null}
            {pwOk ? (
              <Text style={{ marginTop: 8, fontSize: 13, color: colors.success }} testID="settings-password-ok">
                Password changed.
              </Text>
            ) : null}
            <PrimaryButton
              title="Change password"
              onPress={changePassword}
              loading={changingPw}
              testID="settings-change-password"
              style={{ marginTop: 12 }}
            />
          </View>

          {/* Menu */}
          <View style={styles.card}>
            <MenuRow
              label="Passkeys (Face ID / Touch ID)"
              subtitle="Manage your saved passkeys."
              leftIcon={Key}
              onPress={() => navigation.navigate("Passkeys")}
              testID="settings-passkeys"
            />
            <MenuRow
              label="Log out"
              leftIcon={LogOut}
              onPress={() =>
                Alert.alert("Log out?", "You can sign in again anytime.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Log out", style: "destructive", onPress: () => logout() },
                ])
              }
              testID="settings-logout"
            />
          </View>
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  identity: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  section: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 4,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden" as const,
  },
};
