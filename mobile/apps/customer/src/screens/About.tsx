/**
 * AboutScreen — Cargo One about page.
 */
import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { Globe, Briefcase } from "lucide-react-native";
import { colors, radius, typography } from "../theme";
import { MenuRow, Page, PageHeader } from "../ui";

export function AboutScreen() {
  const version = (Constants as any).expoConfig?.version || "0.1.0";
  return (
    <Page testID="about-screen">
      <ScrollView>
        <PageHeader title="About Cargo One" />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          <Text style={[typography.body, { lineHeight: 22 }]}>
            Cargo One is the UK marketplace for on-demand transport, vehicle recovery and large-freight jobs. We connect
            customers directly with vetted independent drivers — instant quotes, live tracking, photo proof of delivery
            and secure Stripe payments in one app.
          </Text>
          <View style={styles.card}>
            <MenuRow label={`App version ${version}`} onPress={() => null} right={<Text style={typography.small}>{version}</Text>} testID="about-version" />
            <MenuRow
              label="Visit cargoone.co.uk"
              leftIcon={Globe}
              onPress={() => Linking.openURL("https://cargoone.co.uk")}
              testID="about-website"
            />
            <MenuRow
              label="Business enquiries"
              leftIcon={Briefcase}
              onPress={() => Linking.openURL("https://cargoone.co.uk/business")}
              testID="about-business"
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
