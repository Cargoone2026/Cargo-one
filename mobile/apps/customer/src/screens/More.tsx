/**
 * MoreScreen — the "More" bottom-tab, matching the web BottomTabs
 * overflow (frontend/src/components/portal/BottomTabs.jsx). Lists
 * every navigation destination that doesn't warrant a primary tab
 * slot: Messages, Profile — which is the exact overflow set the web
 * mobile bar produces from CustomerLayout.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { MenuRow } from "../ui";

export function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.root} testID="more-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>More</Text>
        <View style={styles.card}>
          <MenuRow label="Messages" onPress={() => navigation.navigate("Messages")} testID="more-messages" />
          <MenuRow label="Profile" onPress={() => navigation.navigate("Profile")} testID="more-profile" />
          <MenuRow label="Settings" onPress={() => navigation.navigate("Settings")} testID="more-settings" />
          <MenuRow label="Help & Support" onPress={() => navigation.navigate("Support")} testID="more-support" />
          <MenuRow label="About Cargo One" onPress={() => navigation.navigate("About")} testID="more-about" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
});
