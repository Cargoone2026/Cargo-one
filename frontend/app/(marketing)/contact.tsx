import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/src/api/client";
import { useResponsive } from "@/src/components/marketing/breakpoints";
import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { SectionHeading } from "./index";

const TOPICS: { id: string; label: string }[] = [
  { id: "support", label: "Customer Support" },
  { id: "drivers", label: "Driver Support" },
  { id: "business", label: "Business & Enterprise" },
  { id: "press", label: "Press & Media" },
  { id: "other", label: "Other" },
];

function alertMsg(title: string, msg: string) {
  if (Platform.OS === "web") {
    (globalThis as any).alert?.(`${title}\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

export default function Contact() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const { isMobile } = useResponsive();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: (params.topic as string) || "support",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!form.name || !form.email.includes("@") || form.message.length < 10) {
      alertMsg("Please check the form", "Provide your name, a valid email, and a short message (10+ characters).");
      return;
    }
    setSubmitting(true);
    try {
      await api("/contact", { method: "POST", body: form, auth: false });
      setSubmitted(true);
      setForm({ name: "", email: "", phone: "", topic: form.topic, message: "" });
    } catch (e: any) {
      alertMsg("Send failed", e?.message || "Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title="Contact Us | Cargo One"
        description="Get in touch with Cargo One — customer support, driver support, business enquiries and press. 24/7 assistance for urgent safety concerns."
        path="/contact"
        image={IMG.heroContact}
      />
      <Hero
        bgImage={IMG.heroContact}
        eyebrow="CONTACT"
        title="We’re here to help"
        subtitle="Have a question, need support, or want to talk business? We answer every message within 24 hours."
        compact
      />

      <Section bg="#fff">
        <View style={[styles.split, isMobile && { flexDirection: "column" }]}>
          {/* Contact info */}
          <View style={{ flex: 1, gap: spacing.lg }}>
            <View>
              <Text style={styles.eyebrow}>REACH US</Text>
              <Text style={styles.head}>Choose your channel</Text>
            </View>
            <View style={styles.channelList}>
              {[
                { icon: "mail", title: "Email", body: "hello@cargoone.co.uk", tag: "Reply within 24h" },
                { icon: "call", title: "Phone", body: "+44 800 111 000", tag: "24/7 support line" },
                { icon: "location", title: "Head office", body: "Cargo One Ltd, 1 Fleet Street, London EC4A 1AA", tag: "By appointment" },
                { icon: "headset", title: "Emergency line", body: "For safety incidents in progress", tag: "+44 800 111 999" },
              ].map((c) => (
                <View key={c.title} style={styles.channelCard}>
                  <View style={styles.channelIcon}>
                    <Ionicons name={c.icon as any} size={22} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.channelTitle}>{c.title}</Text>
                    <Text style={styles.channelBody}>{c.body}</Text>
                    <Text style={styles.channelTag}>{c.tag}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Form */}
          <View style={{ flex: 1, gap: spacing.md }}>
            <View>
              <Text style={styles.eyebrow}>SEND US A MESSAGE</Text>
              <Text style={styles.head}>We’ll get back to you</Text>
            </View>

            {submitted ? (
              <View style={styles.thanks}>
                <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                <Text style={styles.thanksTitle}>Message sent</Text>
                <Text style={styles.thanksBody}>
                  Thanks! One of our team will reply to you within 24 hours.
                </Text>
              </View>
            ) : (
              <View style={styles.formCard}>
                <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" as any }}>
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <Text style={styles.label}>Full name</Text>
                    <TextInput
                      value={form.name}
                      onChangeText={(v) => setForm({ ...form, name: v })}
                      placeholder="Alex Morgan"
                      placeholderTextColor={colors.textTertiary}
                      style={styles.input}
                      testID="contact-name"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      value={form.email}
                      onChangeText={(v) => setForm({ ...form, email: v })}
                      placeholder="alex@example.com"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                      testID="contact-email"
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" as any }}>
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <Text style={styles.label}>Phone (optional)</Text>
                    <TextInput
                      value={form.phone}
                      onChangeText={(v) => setForm({ ...form, phone: v })}
                      placeholder="+44 7"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="phone-pad"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <Text style={styles.label}>Topic</Text>
                    <View style={styles.topicRow}>
                      {TOPICS.map((t) => (
                        <Pressable
                          key={t.id}
                          onPress={() => setForm({ ...form, topic: t.id })}
                          style={[styles.topicChip, form.topic === t.id && styles.topicChipActive]}
                        >
                          <Text
                            style={[
                              styles.topicChipText,
                              form.topic === t.id && styles.topicChipTextActive,
                            ]}
                          >
                            {t.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
                <View>
                  <Text style={styles.label}>Message</Text>
                  <TextInput
                    value={form.message}
                    onChangeText={(v) => setForm({ ...form, message: v })}
                    placeholder="Tell us how we can help …"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, styles.textArea]}
                    multiline
                    numberOfLines={5}
                    testID="contact-message"
                  />
                </View>
                <Pressable
                  onPress={submit}
                  disabled={submitting}
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  testID="contact-submit"
                >
                  <Text style={styles.submitText}>{submitting ? "Sending…" : "Send Message"}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </Pressable>
                <Text style={styles.privacyNote}>
                  By submitting you agree to our{" "}
                  <Text style={{ color: colors.brand, fontWeight: weight.semibold }}>Privacy Policy</Text>.
                  We’ll never share your details with third parties.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Section>

      <Section bg={colors.bgSecondary}>
        <SectionHeading eyebrow="OFFICES" title="Where we’re based" />
        <View style={styles.officeRow}>
          {[
            { city: "London", body: "1 Fleet Street, London EC4A 1AA" },
            { city: "Manchester", body: "Peter House, Oxford St, Manchester M1 5AN" },
            { city: "Birmingham", body: "6 Brindley Place, Birmingham B1 2JB" },
          ].map((o) => (
            <View key={o.city} style={styles.officeCard}>
              <Ionicons name="business" size={24} color={colors.brand} />
              <Text style={styles.officeCity}>{o.city}</Text>
              <Text style={styles.officeBody}>{o.body}</Text>
            </View>
          ))}
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: "row", gap: spacing.xxxl, alignItems: "flex-start" },
  eyebrow: { color: colors.brand, fontWeight: weight.bold, letterSpacing: 2, fontSize: font.sm },
  head: { fontSize: 28, fontWeight: weight.bold, color: colors.text, marginTop: spacing.xs },

  channelList: { gap: spacing.md },
  channelCard: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: spacing.md,
  },
  channelIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  channelTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  channelBody: { fontSize: font.base, color: colors.text, marginTop: 2 },
  channelTag: { fontSize: font.sm, color: colors.textSecondary, marginTop: 4 },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  label: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: font.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  textArea: { height: 120, paddingTop: spacing.md, textAlignVertical: "top" },
  topicRow: { flexDirection: "row", flexWrap: "wrap" as any, gap: spacing.xs },
  topicChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  topicChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  topicChipText: { color: colors.text, fontWeight: weight.medium, fontSize: font.sm },
  topicChipTextActive: { color: "#fff" },
  submitBtn: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  submitText: { color: "#fff", fontWeight: weight.bold, fontSize: font.lg },
  privacyNote: { fontSize: font.sm, color: colors.textSecondary, marginTop: spacing.xs },

  thanks: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  thanksTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  thanksBody: { fontSize: font.base, color: colors.text, textAlign: "center", maxWidth: 400 },

  officeRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" as any, justifyContent: "center" },
  officeCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
  },
  officeCity: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  officeBody: { fontSize: font.base, color: colors.textSecondary, textAlign: "center" },
});
