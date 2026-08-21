/**
 * SupportScreen — mirrors the web Settings > Support section.
 */
import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { Mail, AlertTriangle, HelpCircle, BookOpen, MessageSquare } from "lucide-react-native";
import { colors, radius, typography } from "../theme";
import { MenuRow, Page, PageHeader } from "../ui";

export function SupportScreen() {
  return (
    <Page testID="support-screen">
      <ScrollView>
        <PageHeader title="Help & Support" subtitle="Our team responds within one working day." />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <View style={styles.card}>
            <MenuRow
              label="Email support@cargoone.co.uk"
              leftIcon={Mail}
              onPress={() => Linking.openURL("mailto:support@cargoone.co.uk")}
              testID="support-email"
            />
            <MenuRow
              label="Report a problem"
              leftIcon={AlertTriangle}
              onPress={() => Linking.openURL("mailto:support@cargoone.co.uk?subject=Cargo%20One%20problem%20report")}
              testID="support-report"
            />
            <MenuRow
              label="Read the FAQs"
              leftIcon={HelpCircle}
              onPress={() => Linking.openURL("https://cargoone.co.uk/faq")}
              testID="support-faq"
            />
            <MenuRow
              label="How Cargo One works"
              leftIcon={BookOpen}
              onPress={() => Linking.openURL("https://cargoone.co.uk/how-it-works")}
              testID="support-how"
            />
            <MenuRow
              label="Contact us"
              leftIcon={MessageSquare}
              onPress={() => Linking.openURL("https://cargoone.co.uk/contact")}
              testID="support-contact"
            />
          </View>
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  card: { backgroundColor: colors.bg, borderRadius: radius.base, borderWidth: 1, borderColor: colors.border, overflow: "hidden" as const },
};
