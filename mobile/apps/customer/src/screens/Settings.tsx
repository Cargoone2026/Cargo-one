/**
 * SettingsScreen — mirrors frontend/src/pages/Settings.jsx.
 *
 * Sections match the web verbatim: Legal (Terms / Privacy / Cookies),
 * Support (Contact Support / Rate Cargo One), Account (About / Passkeys /
 * App Version / Delete Account), plus the pre-existing "Signed in as"
 * identity card and Log out control that were already on this native
 * screen. The header carries a Back button so Profile → Settings → Back
 * returns to Profile.
 */
import React from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Code,
  Cookie,
  FileText,
  Info,
  Key,
  LogOut,
  Mail,
  Shield,
  Star,
  Trash2,
} from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { MenuRow, Page, PageHeader } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Settings">;

const APP_VERSION = "1.0.0";

export function SettingsScreen({ navigation }: P) {
  const { user, logout } = useAuth();

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Profile");

  const openMail = (subject?: string) => {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    Linking.openURL(`mailto:support@cargoone.com${q}`).catch(() => {
      Alert.alert("Email", "Please email support@cargoone.com");
    });
  };

  const confirmLogout = () =>
    Alert.alert("Log out?", "You can sign in again anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  return (
    <Page testID="settings-screen" scroll={false}>
      <PageHeader title="Settings" onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {/* Signed-in identity — pre-existing */}
          <View style={styles.identity}>
            <Text style={typography.micro}>Signed in as</Text>
            <Text style={[typography.strong, { marginTop: 4 }]}>{user?.name || "—"}</Text>
            <Text style={[typography.caption, { marginTop: 2 }]}>{user?.email}</Text>
          </View>

          {/* Legal */}
          <Section title="Legal">
            <MenuRow
              label="Terms & Conditions"
              leftIcon={FileText}
              onPress={() => navigation.navigate("Legal", { slug: "terms" })}
              testID="settings-terms"
            />
            <MenuRow
              label="Privacy Policy"
              leftIcon={Shield}
              onPress={() => navigation.navigate("Legal", { slug: "privacy" })}
              testID="settings-privacy"
            />
            <MenuRow
              label="Cookie Policy"
              leftIcon={Cookie}
              onPress={() => navigation.navigate("Legal", { slug: "cookies" })}
              testID="settings-cookies"
            />
          </Section>

          {/* Support */}
          <Section title="Support">
            <MenuRow
              label="Contact Support"
              leftIcon={Mail}
              onPress={() => navigation.navigate("Support")}
              testID="settings-support"
            />
            <MenuRow
              label="Rate Cargo One"
              leftIcon={Star}
              onPress={() => openMail("Feedback")}
              testID="settings-rate"
            />
          </Section>

          {/* Account */}
          <Section title="Account">
            <MenuRow
              label="About Cargo One"
              leftIcon={Info}
              onPress={() => navigation.navigate("About")}
              testID="settings-about"
            />
            {user ? (
              <MenuRow
                label="Passkeys (Face ID / Touch ID)"
                subtitle="Sign in without your password"
                leftIcon={Key}
                onPress={() => navigation.navigate("Passkeys")}
                testID="settings-passkeys"
              />
            ) : null}
            <View style={styles.versionRow} testID="settings-version">
              <View style={styles.versionIcon}>
                <Code size={18} color={colors.ink} />
              </View>
              <Text style={styles.versionLabel}>App Version {APP_VERSION}</Text>
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>iOS</Text>
              </View>
            </View>
            {user ? (
              <MenuRow
                label="Delete Account"
                leftIcon={Trash2}
                onPress={() => navigation.navigate("DeleteAccount")}
                testID="settings-delete"
                danger
              />
            ) : null}
          </Section>

          {/* Log out — pre-existing */}
          <Section>
            <MenuRow
              label="Log out"
              leftIcon={LogOut}
              onPress={confirmLogout}
              testID="settings-logout"
            />
          </Section>
        </View>
      </ScrollView>
    </Page>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? <Text style={typography.micro}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
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
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden" as const,
  },
  versionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  versionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bgSecondary,
  },
  versionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.ink,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.bgSecondary,
  },
  versionPillText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    color: colors.inkMuted,
  },
};
