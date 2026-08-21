/**
 * LegalScreen — Terms / Privacy / Cookies content matching the web
 * copy at pages/Settings.jsx's CONTENT dictionary.
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { colors, typography } from "../theme";
import { Page, PageHeader } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Legal">;

const DOCS: Record<string, { title: string; body: string }> = {
  terms: {
    title: "Terms & Conditions",
    body:
      "Welcome to Cargo One. By using our platform you agree to the following terms.\n\n" +
      "1. THE PLATFORM\nCargo One connects customers who need transport, recovery or large freight jobs with independent drivers. Cargo One is not a carrier and is not a party to any transport contract; the contract is between the customer and the driver.\n\n" +
      "2. ELIGIBILITY\nYou must be 18+ and legally able to enter contracts. You are responsible for the accuracy of the information you supply and for compliance with all applicable laws (customs, weight limits, driver hours, etc.).\n\n" +
      "3. DRIVER VETTING\nDrivers must submit valid documents (licence, insurance, vehicle registration, ID, proof of address, profile photo) and be approved by Cargo One's admin team.\n\n" +
      "4. BOOKINGS & CANCELLATIONS\nOnce a booking is accepted a cancellation fee may apply if you cancel late. Fees are shown in-app before confirming.\n\n" +
      "5. PAYMENTS\nPayments are handled by Stripe. Cargo One takes a service fee from each booking and remits the balance to the driver.\n\n" +
      "6. LIABILITY\nCargo One provides the platform \"as is\" and does not guarantee availability or specific delivery outcomes. Drivers are independent contractors responsible for their own insurance and legal compliance.\n\n" +
      "7. TERMINATION\nCargo One may suspend or delete accounts for breach of these terms.\n\n" +
      "Contact: support@cargoone.co.uk",
  },
  privacy: {
    title: "Privacy Policy",
    body:
      "Cargo One respects your privacy. This policy explains what we collect and how we use it.\n\n" +
      "1. WHAT WE COLLECT\n- Account: name, email, phone, address.\n- Bookings: pickup / drop-off, vehicle, freight details, price, timestamps.\n- Device: IP, user agent, coarse and (with permission) fine location while a job is active.\n- Payment: handled by Stripe — we never store card numbers.\n\n" +
      "2. HOW WE USE IT\n- To match customers with drivers and provide live tracking\n- To process payments and refunds\n- To communicate about bookings and account activity\n- To enforce our Terms and prevent fraud\n\n" +
      "3. SHARING\n- With drivers you book — only the info needed to complete the job.\n- With Stripe (payments), Google/Mapbox (maps), and law-enforcement where legally required.\n- Never sold to third parties for advertising.\n\n" +
      "4. YOUR RIGHTS\nYou can request a copy of your data, correction, or deletion. Contact support@cargoone.co.uk.\n\n" +
      "5. RETENTION\n- Booking history is kept for 7 years for tax/legal purposes.\n- Personal data is deleted within 30 days of account deletion, subject to legal holds.",
  },
  cookies: {
    title: "Cookie Policy",
    body:
      "The mobile app does not use browser cookies. It uses only the essential local storage described in our Privacy Policy — bearer token, session preferences, and offline-cached bookings — for the app to function. There are no advertising or analytics trackers in the native customer app.",
  },
};

export function LegalScreen({ route }: P) {
  const slug = route?.params?.slug || "terms";
  const doc = DOCS[slug] || DOCS.terms;
  return (
    <Page testID={`legal-${slug}-screen`}>
      <ScrollView>
        <PageHeader title={doc.title} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={[typography.body, { lineHeight: 22, color: colors.ink }]}>{doc.body}</Text>
        </View>
      </ScrollView>
    </Page>
  );
}
