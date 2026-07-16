import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type SlugMap = Record<string, { title: string; body: string }>;

const CONTENT: SlugMap = {
  terms: {
    title: "Terms & Conditions",
    body: `Welcome to Cargo One. By using our platform you agree to the following terms.

1. THE SERVICE
Cargo One is a marketplace that connects customers with independent transport providers ("drivers"). Cargo One is not a party to the transport contract between customer and driver.

2. BOOKING FEE
Cargo One charges a Booking Fee (calculated from the driver's charge, tiered by configurable bands) which is collected via Stripe at the time of booking confirmation. The remainder is paid by the customer directly to the driver on delivery.

3. ELIGIBILITY
Drivers must submit valid documents (licence, insurance, vehicle registration, ID, proof of address, profile photo) and be approved by Cargo One's admin team.

4. USER CONDUCT
Users agree not to abuse the platform, contact drivers/customers outside the app before deposit is paid, or falsify information.

5. PAYMENTS
Booking Fees are non-refundable once a driver has been assigned unless the driver cancels or fails to arrive. Disputes are handled case-by-case by Cargo One.

6. LIABILITY
Cargo One provides the platform "as is" and does not guarantee availability or specific delivery outcomes. Drivers are independent contractors responsible for their own insurance and legal compliance.

7. TERMINATION
Cargo One may suspend or delete accounts for breach of these terms.

8. CONTACT
Questions? support@cargoone.com`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `Cargo One respects your privacy. This policy explains what we collect and how we use it.

WHAT WE COLLECT
- Account details (name, email, phone)
- Documents (driving licence, insurance, ID) for driver verification
- Location data (with your permission) for live tracking
- Booking history, messages, ratings and reviews
- Photos you upload (POD, reviews)

HOW WE USE IT
- To match customers and drivers
- To process Booking Fees via Stripe
- To provide live tracking and communication
- To enforce our Terms and prevent fraud

SHARING
- With Stripe (payments), Google (maps), and law-enforcement where legally required.
- Never sold to advertisers.

YOUR RIGHTS
- Access, correct, or delete your data at any time from Settings > Delete Account.
- Contact support@cargoone.com for GDPR / UK-DPA requests.

RETENTION
- Booking records are retained for 7 years for accounting/tax compliance.
- Personal data is deleted within 30 days of account deletion, subject to legal holds.`,
  },
  cookies: {
    title: "Cookie Policy",
    body: `The Cargo One mobile app does not use cookies. Our future website will use only strictly-necessary cookies for authentication and session state. No advertising or third-party analytics cookies will be set without your consent.`,
  },
  about: {
    title: "About Cargo One",
    body: `Cargo One — Ship Anything. Anywhere. Instant Quotes.

Cargo One is a premium logistics marketplace connecting customers with verified transport providers across the UK. We handle furniture, pallets, cars, motorcycles, house moves, parcels, freight, documents, boats and machinery.

Our model:
- Free to post a job
- Drivers bid or accept a fixed price
- Cargo One collects a transparent Booking Fee
- The rest is paid directly to your driver on delivery`,
  },
};

export default function SettingsPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const c = slug ? CONTENT[slug] : undefined;

  async function deleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently removes your Cargo One profile. Your booking records are retained for accounting.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api("/auth/me/delete", { method: "POST" });
              await logout();
              router.replace("/(auth)/welcome");
            } catch { setDeleting(false); }
          },
        },
      ],
    );
  }

  if (slug === "delete-account") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title="Delete account" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.warn}>
            <Ionicons name="warning" size={22} color={colors.error} />
            <Text style={styles.warnText}>
              Deleting your account cannot be undone. Your bookings will remain visible to your counterparty for their records.
            </Text>
          </View>
          <Text style={styles.body}>
            When you delete your account, we permanently remove your profile, chat history, uploaded documents and ratings. Booking records are anonymised and kept for 7 years for tax compliance.
          </Text>
          <Button
            title="Delete my account"
            variant="outline"
            onPress={deleteAccount}
            loading={deleting}
            testID="confirm-delete-account"
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (slug === "support") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title="Contact Support" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.body}>
            Our team responds within 24h on weekdays.
          </Text>
          <Row icon="mail" label="support@cargoone.com" onPress={() => Linking.openURL("mailto:support@cargoone.com")} testID="support-email" />
          <Row icon="chatbubbles" label="Report a Problem" onPress={() => Linking.openURL("mailto:support@cargoone.com?subject=Report a Problem")} testID="support-report" />
          <Row icon="help-circle" label="FAQs" onPress={() => Linking.openURL("https://cargoone.com/faq")} testID="support-faq" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (slug === "rate") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title="Rate Cargo One" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.rateCard}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={32} color={colors.accent} />
              ))}
            </View>
            <Text style={styles.rateTitle}>Enjoying Cargo One?</Text>
            <Text style={styles.rateBody}>
              Your rating helps us reach more customers and drivers.
            </Text>
            <Button
              title="Rate on the App Store"
              onPress={() => Linking.openURL("https://apps.apple.com")}
              testID="rate-app-store"
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!c) {
    // Settings home
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title="Settings" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Section title="Legal">
            <Row icon="document-text" label="Terms & Conditions" onPress={() => router.push("/settings/terms")} testID="settings-terms" />
            <Row icon="lock-closed" label="Privacy Policy" onPress={() => router.push("/settings/privacy")} testID="settings-privacy" />
            <Row icon="cafe" label="Cookie Policy" onPress={() => router.push("/settings/cookies")} testID="settings-cookies" />
          </Section>
          <Section title="Support">
            <Row icon="mail" label="Contact Support" onPress={() => router.push("/settings/support")} testID="settings-support" />
            <Row icon="star" label="Rate the App" onPress={() => router.push("/settings/rate")} testID="settings-rate" />
          </Section>
          <Section title="Account">
            <Row icon="information-circle" label="About Cargo One" onPress={() => router.push("/settings/about")} testID="settings-about" />
            <Row
              icon="code-slash"
              label={`App Version ${Constants.expoConfig?.version || "1.0.0"}`}
              rightAdornment={<Text style={styles.versionTag}>{Constants.expoConfig?.runtimeVersion || "dev"}</Text>}
            />
            {user && (
              <Row
                icon="trash"
                label="Delete Account"
                danger
                onPress={() => router.push("/settings/delete-account")}
                testID="settings-delete"
              />
            )}
          </Section>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Header title={c.title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.body}>{c.body}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} testID="settings-back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ icon, label, onPress, testID, danger, rightAdornment }: any) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID} disabled={!onPress}>
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.errorBg }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.text} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      {rightAdornment ?? (onPress && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  sectionTitle: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.semibold,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.sm,
  },
  sectionBody: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: font.base, color: colors.text, fontWeight: weight.medium },
  versionTag: {
    fontSize: font.sm, color: colors.textSecondary,
    backgroundColor: colors.bgSecondary, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.sm,
  },
  body: { fontSize: font.base, color: colors.text, lineHeight: 24 },
  warn: {
    flexDirection: "row", gap: spacing.sm, padding: spacing.lg,
    backgroundColor: colors.errorBg, borderRadius: radius.md, alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  warnText: { flex: 1, color: colors.text, fontSize: font.base, lineHeight: 20 },
  rateCard: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  starsRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  rateTitle: { fontSize: font.xxl, fontWeight: weight.bold, color: colors.text, textAlign: "center" },
  rateBody: { fontSize: font.base, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
});
