/**
 * LegalScreen — shows static legal copy for Terms / Privacy / Cookies.
 * Mirrors Customer's Legal screen pattern: PageHeader with Back,
 * scroll of markdown-style text sections.
 *
 * No backend endpoint required — content is bundled.
 */
import React from "react";
import { Linking, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { Card, Page, PageHeader, Section, colors, space, typography } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Legal">;

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms & Conditions",
    body: [
      "By using the Cargo One Driver app you agree to the full Terms & Conditions published on cargoone.co.uk/terms.",
      "You are responsible for operating a roadworthy vehicle, holding valid insurance, and complying with all applicable transport regulations.",
      "Cargo One acts as a marketplace between customers and independent drivers; the platform booking fee is non-refundable except where stated in the cancellation policy.",
      "Tap the link below to read the most up-to-date version.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      "Cargo One stores only the data required to operate the platform: your account details, documents you choose to upload, job and booking history, and app usage metadata.",
      "Your location is used only while Live Mode is enabled, strictly to match you to nearby ASAP jobs and keep customers informed during active deliveries.",
      "We never sell your personal data. Full details are available at cargoone.co.uk/privacy.",
    ],
  },
  cookies: {
    title: "Cookie Policy",
    body: [
      "The mobile app does not use web cookies. Session tokens are stored securely on-device via the operating system's keychain / keystore.",
      "The web portal uses essential cookies to keep you signed in. See cargoone.co.uk/cookies for the full web policy.",
    ],
  },
};

export default function LegalScreen({ route, navigation }: P) {
  const slug = (route.params?.slug || "terms") as keyof typeof DOCS;
  const doc = DOCS[slug] || DOCS.terms;
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.goBack());
  const link = `https://cargoone.co.uk/${slug}`;

  return (
    <Page testID={`legal-${slug}`}>
      <PageHeader title={doc.title} onBack={goBack} />
      <Section gap={space[3]}>
        <Card>
          {doc.body.map((p, i) => (
            <Text key={i} style={[typography.body, { lineHeight: 22, marginBottom: i < doc.body.length - 1 ? space[3] : 0 }]}>
              {p}
            </Text>
          ))}
        </Card>
        <Text
          onPress={() => Linking.openURL(link).catch(() => {})}
          style={{ color: colors.brand, fontWeight: "600", textAlign: "center", padding: space[2] }}
          testID="legal-open-web"
        >
          Read the full policy at {link}
        </Text>
      </Section>
    </Page>
  );
}
