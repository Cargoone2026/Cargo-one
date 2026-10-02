/**
 * SettingsScreen — mirrors Customer Settings.tsx layout verbatim.
 * Driver-specific: no Delete Account (backend doesn't expose a Driver
 * self-delete, and inventing one is forbidden by scope). No Passkeys
 * entry — passkey native module is intentionally excluded from
 * autolinking in this pass.
 */
import React from "react";
import { Alert, Linking, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { Card, Icon, MenuRow, Page, PageHeader, Section, colors, radius, space, typography } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Settings">;

const APP_VERSION = "1.0.0";

export default function SettingsScreen({ navigation }: P) {
  const { user, logout } = useAuth();

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Profile"));

  const openMail = (subject?: string) => {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    Linking.openURL(`mailto:support@cargoone.co.uk${q}`).catch(() => {
      Alert.alert("Email", "Please email support@cargoone.co.uk");
    });
  };

  const confirmLogout = () =>
    Alert.alert("Log out?", "You can sign in again anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  return (
    <Page testID="settings-screen">
      <PageHeader title="Settings" onBack={goBack} />
      <Section gap={space[4]}>
        {/* Signed-in identity */}
        <View style={styles.identity}>
          <Text style={typography.micro}>SIGNED IN AS</Text>
          <Text style={[typography.strong, { marginTop: 4 }]}>{user?.name || "—"}</Text>
          <Text style={[typography.caption, { marginTop: 2 }]}>{user?.email}</Text>
        </View>

        <Text style={typography.micro}>LEGAL</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="Terms & Conditions"
            testID="settings-terms"
            leftGlyph={<Glyph name="file-text" />}
            onPress={() => navigation.navigate("Legal", { slug: "terms" })}
          />
          <MenuRow
            label="Privacy Policy"
            testID="settings-privacy"
            leftGlyph={<Glyph name="shield" />}
            onPress={() => navigation.navigate("Legal", { slug: "privacy" })}
          />
          <MenuRow
            label="Cookie Policy"
            testID="settings-cookies"
            leftGlyph={<Glyph name="info" />}
            onPress={() => navigation.navigate("Legal", { slug: "cookies" })}
          />
        </Card>

        <Text style={typography.micro}>SUPPORT</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="Contact Support"
            testID="settings-support"
            leftGlyph={<Glyph name="mail" />}
            onPress={() => openMail("Driver support")}
          />
          <MenuRow
            label="Rate Cargo One"
            testID="settings-rate"
            leftGlyph={<Glyph name="star" />}
            onPress={() => openMail("Feedback from Driver app")}
          />
        </Card>

        <Text style={typography.micro}>ACCOUNT</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <View style={styles.versionRow} testID="settings-version">
            <Glyph name="code" />
            <Text style={styles.versionLabel}>App Version {APP_VERSION}</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionPillText}>iOS</Text>
            </View>
          </View>
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="Log out"
            testID="settings-logout"
            leftGlyph={<Glyph name="log-out" />}
            onPress={confirmLogout}
          />
        </Card>
      </Section>
    </Page>
  );
}

function Glyph({ name }: { name: React.ComponentProps<typeof Icon>["name"] }) {
  return (
    <View style={styles.rowGlyph}>
      <Icon name={name} size={18} color={colors.ink} />
    </View>
  );
}

const styles = {
  identity: {
    padding: space[4],
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  rowGlyph: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: colors.bgSecondary,
  },
  versionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingHorizontal: space[4],
    paddingVertical: 14,
  },
  versionLabel: { flex: 1, fontSize: 14, fontWeight: "600" as const, color: colors.ink },
  versionPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    backgroundColor: colors.bgSecondary,
  },
  versionPillText: {
    fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.5,
    textTransform: "uppercase" as const, color: colors.inkMuted,
  },
} as const;
