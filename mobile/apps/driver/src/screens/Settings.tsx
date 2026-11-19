/**
 * SettingsScreen — mirrors Customer Settings.tsx layout verbatim.
 * Driver-specific: no Delete Account (backend doesn't expose a Driver
 * self-delete, and inventing one is forbidden by scope). No Passkeys
 * entry — passkey native module is intentionally excluded from
 * autolinking in this pass.
 */
import React from "react";
import { Alert, Linking, Platform, Share, Text, View } from "react-native";
import Constants from "expo-constants";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { Card, Icon, MenuRow, Page, PageHeader, Section, colors, radius, space, typography } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Settings">;

const cfg: any = Constants.expoConfig;
const APP_VERSION = cfg?.version || "1.0.0";
const APP_BUILD = Platform.OS === "android" ? cfg?.android?.versionCode : cfg?.ios?.buildNumber;
const PLATFORM_LABEL = Platform.OS === "android" ? "Android" : "iOS";
const SHARE_MESSAGE =
  "I'm using CargoOne Driver to find courier, removals and vehicle recovery jobs across the UK. Bid and Fixed Price jobs are free for drivers. Download it here: https://cargoone.co.uk/drivers";
const WHATSAPP_URL = "https://wa.me/447983299049?text=Hi%20CargoOne%2C%20I%20need%20help%20with%20the%20Driver%20app";
const STORE_URLS =
  Platform.OS === "android"
    ? ["market://details?id=co.uk.cargoone.driver", "https://play.google.com/store/apps/details?id=co.uk.cargoone.driver"]
    : ["https://apps.apple.com/gb/app/cargoone-driver-courier-jobs/id6822450098?action=write-review"];

async function openFirst(urls: string[], fallback: () => void) {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try next
    }
  }
  fallback();
}

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
            label="WhatsApp support"
            testID="settings-whatsapp"
            leftGlyph={<Glyph name="message-circle" />}
            onPress={() => openFirst([WHATSAPP_URL], () => openMail("Driver support"))}
          />
          <MenuRow
            label="Rate Cargo One"
            testID="settings-rate"
            leftGlyph={<Glyph name="star" />}
            onPress={() => openFirst(STORE_URLS, () => openMail("Feedback from Driver app"))}
          />
          <MenuRow
            label="Send feedback"
            testID="settings-feedback"
            leftGlyph={<Glyph name="message-square" />}
            onPress={() => openMail("Feedback from Driver app")}
          />
          <MenuRow
            label="Share CargoOne Driver"
            testID="settings-share"
            leftGlyph={<Glyph name="share-2" />}
            onPress={() => Share.share({ message: SHARE_MESSAGE }).catch(() => {})}
          />
        </Card>

        <Text style={typography.micro}>ACCOUNT</Text>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <View style={styles.versionRow} testID="settings-version">
            <Glyph name="code" />
            <Text style={styles.versionLabel}>App Version {APP_VERSION}{APP_BUILD ? ` (${APP_BUILD})` : ""}</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionPillText}>{PLATFORM_LABEL}</Text>
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

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <MenuRow
            label="Delete account"
            testID="settings-delete-account"
            leftGlyph={<Glyph name="trash-2" color={colors.errorInk} />}
            onPress={() => navigation.navigate("DeleteAccount")}
            danger
          />
        </Card>
      </Section>
    </Page>
  );
}

function Glyph({ name, color = colors.ink }: { name: React.ComponentProps<typeof Icon>["name"]; color?: string }) {
  return (
    <View style={styles.rowGlyph}>
      <Icon name={name} size={18} color={color} />
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
