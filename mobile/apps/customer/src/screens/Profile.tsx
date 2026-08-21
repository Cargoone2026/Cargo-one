/**
 * ProfileScreen — 1:1 port of frontend/src/pages/portal/customer/Profile.jsx.
 * Avatar header with name+email, then MenuRow groups for Account / Support /
 * Legal / Danger. Uses the shared Cargo One design system.
 */
import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { User as UserIcon, Key, Settings, HelpCircle, Info, FileText, Cookie, Shield, LogOut, Trash2 } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { MenuRow, Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";

type P = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: P) {
  const { user, logout } = useAuth();
  const { openDrawer, showMenu } = useShellMenu();

  const doLogout = () =>
    Alert.alert("Log out", "Sign out of Cargo One on this device?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  return (
    <Page testID="profile-screen">
      <ScrollView>
        <PageHeader large title="Profile" showMenu={showMenu} onMenuPress={openDrawer} />

        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 20 }}>
          {/* Identity card */}
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h2]} testID="profile-name">{user?.name || "Cargo One customer"}</Text>
              <Text style={[typography.caption, { marginTop: 2 }]} testID="profile-email">
                {user?.email}
              </Text>
            </View>
          </View>

          <Section title="Account">
            <MenuRow
              label="Passkeys (Face ID / Touch ID)"
              leftIcon={Key}
              onPress={() => navigation.navigate("Passkeys")}
              testID="profile-passkeys"
            />
            <MenuRow
              label="Settings"
              leftIcon={Settings}
              onPress={() => navigation.navigate("Settings")}
              testID="profile-settings"
            />
          </Section>

          <Section title="Support">
            <MenuRow
              label="Help & Support"
              leftIcon={HelpCircle}
              onPress={() => navigation.navigate("Support")}
              testID="profile-support"
            />
            <MenuRow
              label="About Cargo One"
              leftIcon={Info}
              onPress={() => navigation.navigate("About")}
              testID="profile-about"
            />
          </Section>

          <Section title="Legal">
            <MenuRow
              label="Terms & Conditions"
              leftIcon={FileText}
              onPress={() => navigation.navigate("Legal", { slug: "terms" })}
              testID="profile-terms"
            />
            <MenuRow
              label="Privacy Policy"
              leftIcon={Shield}
              onPress={() => navigation.navigate("Legal", { slug: "privacy" })}
              testID="profile-privacy"
            />
            <MenuRow
              label="Cookie Policy"
              leftIcon={Cookie}
              onPress={() => navigation.navigate("Legal", { slug: "cookies" })}
              testID="profile-cookies"
            />
          </Section>

          <Section>
            <MenuRow
              label="Delete account"
              leftIcon={Trash2}
              onPress={() => navigation.navigate("DeleteAccount")}
              testID="profile-delete"
              danger
            />
            <MenuRow label="Log out" leftIcon={LogOut} onPress={doLogout} testID="profile-logout" />
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 16,
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  avatarInitial: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" as const },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden" as const,
  },
};
