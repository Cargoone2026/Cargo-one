/**
 * SupportScreen — help & contact hub. Matches web Settings > Support:
 * email support, "Report a Problem" mailto, FAQ deep-link to the
 * marketing site.
 */
import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MenuRow } from "../ui";

export function SupportScreen() {
  return (
    <SafeAreaView style={styles.root} testID="support-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.subtitle}>
          Our team responds to every message within one working day.
        </Text>
        <View style={styles.card}>
          <MenuRow label="Email support@cargoone.co.uk" onPress={() => Linking.openURL("mailto:support@cargoone.co.uk")} testID="support-email" />
          <MenuRow label="Report a problem" onPress={() => Linking.openURL("mailto:support@cargoone.co.uk?subject=CargoOne%20problem%20report")} testID="support-report" />
          <MenuRow label="Read the FAQs" onPress={() => Linking.openURL("https://cargoone.co.uk/faq")} testID="support-faq" />
          <MenuRow label="How CargoOne works" onPress={() => Linking.openURL("https://cargoone.co.uk/how-it-works")} testID="support-how" />
          <MenuRow label="Contact us" onPress={() => Linking.openURL("https://cargoone.co.uk/contact")} testID="support-contact" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
});
