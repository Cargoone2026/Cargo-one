/**
 * SettingsScreen — mirrors frontend/src/pages/Settings.jsx. Shows the
 * signed-in identity, then a small set of MenuRow groups.
 */
import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Key, LogOut } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { MenuRow, Page, PageHeader } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: P) {
  const { user, logout } = useAuth();
  return (
    <Page testID="settings-screen">
      <ScrollView>
        <PageHeader title="Settings" />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          <View style={styles.identity}>
            <Text style={typography.micro}>Signed in as</Text>
            <Text style={[typography.strong, { marginTop: 4 }]}>{user?.name || "—"}</Text>
            <Text style={[typography.caption, { marginTop: 2 }]}>{user?.email}</Text>
          </View>
          <View style={styles.card}>
            <MenuRow
              label="Passkeys (Face ID / Touch ID)"
              subtitle="Sign in without your password"
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
  card: { backgroundColor: colors.bg, borderRadius: radius.base, borderWidth: 1, borderColor: colors.border, overflow: "hidden" as const },
};
