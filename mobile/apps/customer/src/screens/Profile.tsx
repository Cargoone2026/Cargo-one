/**
 * ProfileScreen — mirrors the web /customer/profile page's info surface.
 * Displays the current user's account details and provides links to
 * every Settings sub-screen and the logout action. Purely a navigation
 * hub — deep-edit forms remain on web for now (native inline editing
 * added in the next parity pass).
 */
import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { MenuRow } from "../ui";

const RED = "#D62828";

type P = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: P) {
  const { user, logout } = useAuth();

  async function onLogout() {
    Alert.alert("Log out", "Sign out of CargoOne on this device?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);
  }

  return (
    <SafeAreaView style={styles.root} testID="profile-screen">
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.name} testID="profile-name">{user?.name || "CargoOne customer"}</Text>
          <Text style={styles.email} testID="profile-email">{user?.email}</Text>
        </View>

        <Section title="Account">
          <MenuRow label="Passkeys (Face ID / Touch ID)" onPress={() => navigation.navigate("Passkeys")} testID="profile-passkeys" />
          <MenuRow label="Settings" onPress={() => navigation.navigate("Settings")} testID="profile-settings" />
        </Section>

        <Section title="Support">
          <MenuRow label="Help & Support" onPress={() => navigation.navigate("Support")} testID="profile-support" />
          <MenuRow label="About Cargo One" onPress={() => navigation.navigate("About")} testID="profile-about" />
        </Section>

        <Section title="Legal">
          <MenuRow label="Terms & Conditions" onPress={() => navigation.navigate("Legal", { slug: "terms" })} testID="profile-terms" />
          <MenuRow label="Privacy Policy" onPress={() => navigation.navigate("Legal", { slug: "privacy" })} testID="profile-privacy" />
          <MenuRow label="Cookie Policy" onPress={() => navigation.navigate("Legal", { slug: "cookies" })} testID="profile-cookies" />
        </Section>

        <Section title="">
          <MenuRow label="Delete account" onPress={() => navigation.navigate("DeleteAccount")} testID="profile-delete" danger />
          <MenuRow label="Log out" onPress={onLogout} testID="profile-logout" />
        </Section>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { alignItems: "center", paddingVertical: 32, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: RED, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#FFFFFF", fontSize: 30, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  email: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
});
