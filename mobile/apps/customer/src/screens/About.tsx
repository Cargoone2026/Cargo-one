/**
 * AboutScreen — mirrors the web "About Cargo One" settings entry.
 * Shows a short marketing paragraph, app version, and a link to the
 * marketing site.
 */
import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { MenuRow } from "../ui";

export function AboutScreen() {
  const version = Constants.expoConfig?.version || "0.1.0";
  return (
    <SafeAreaView style={styles.root} testID="about-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>About Cargo One</Text>
        <Text style={styles.text}>
          Cargo One is the UK marketplace for on-demand transport, vehicle
          recovery and large-freight jobs. We connect customers directly
          with vetted independent drivers — instant quotes, live tracking,
          photo proof of delivery and secure Stripe payments in one app.
        </Text>
        <View style={styles.card}>
          <MenuRow label={`App version ${version}`} onPress={() => null} testID="about-version" />
          <MenuRow label="Visit cargoone.co.uk" onPress={() => Linking.openURL("https://cargoone.co.uk")} testID="about-website" />
          <MenuRow label="Business account enquiries" onPress={() => Linking.openURL("https://cargoone.co.uk/business")} testID="about-business" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, color: "#374151", marginBottom: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
});
