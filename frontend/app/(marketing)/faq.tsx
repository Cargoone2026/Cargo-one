import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Hero } from "@/src/components/marketing/Hero";
import { IMG } from "@/src/components/marketing/images";
import { Section } from "@/src/components/marketing/Section";
import { SEO } from "@/src/components/marketing/SEO";
import { colors, font, radius, spacing, weight } from "@/src/theme";

import { SectionHeading } from "./index";

type QA = { q: string; a: string };
type Group = { heading: string; items: QA[] };

const GROUPS: Group[] = [
  {
    heading: "Getting Started",
    items: [
      {
        q: "Is posting a job free?",
        a: "Yes. Posting jobs on Cargo One is completely free — you only pay when you accept a driver’s quote. There’s no membership fee for customers.",
      },
      {
        q: "How quickly will I get quotes?",
        a: "For most standard categories, the first driver quotes arrive within minutes. Fixed-price jobs can be accepted instantly.",
      },
      {
        q: "Do I need to create an account?",
        a: "Yes — accounts help us verify identities, secure payments, and enable in-app messaging with your driver. Sign-up takes 30 seconds.",
      },
    ],
  },
  {
    heading: "Payments & Fees",
    items: [
      {
        q: "What’s the Cargo One Booking Fee?",
        a: "When you accept a driver’s quote, you pay a small booking fee to Cargo One via Stripe. This fee is based on job value bands, starting from £10. This is the ONLY money Cargo One charges you.",
      },
      {
        q: "How does the driver get paid?",
        a: "The driver’s quoted amount is paid directly to them on delivery — cash or bank transfer. Cargo One does not take any commission from the driver’s quote.",
      },
      {
        q: "What payment methods do you accept?",
        a: "For the booking fee, we accept all major cards (Visa, Mastercard, Amex) plus Apple Pay and Google Pay via Stripe. Driver payments on delivery are agreed between you and the driver.",
      },
      {
        q: "Is my payment secure?",
        a: "Yes. All card payments are processed by Stripe (PCI-DSS Level 1). Cargo One never sees, stores or handles your card details.",
      },
    ],
  },
  {
    heading: "Drivers & Verification",
    items: [
      {
        q: "Are drivers checked?",
        a: "Yes. Every Cargo One driver must upload their licence, insurance, vehicle V5, photo ID and proof of address. Documents are manually reviewed before their first job.",
      },
      {
        q: "What does the ‘Verified Driver’ badge mean?",
        a: "Verified Drivers have completed all identity checks, hold valid documents, are actively rated, and have completed at least one job.",
      },
      {
        q: "What if a driver cancels?",
        a: "If your driver cancels after you pay the booking fee, you’ll receive a full refund automatically and we’ll relist your job with priority matching.",
      },
    ],
  },
  {
    heading: "Deliveries & Tracking",
    items: [
      {
        q: "Can I track my delivery live?",
        a: "Yes — once the booking fee is paid, live GPS tracking unlocks. You’ll see your driver’s location, route and live ETA in the app.",
      },
      {
        q: "What is Proof of Delivery?",
        a: "On completion, the driver uploads time-stamped, GPS-tagged photos of the delivery and (optionally) captures a signature. You’ll get it in the app immediately.",
      },
      {
        q: "What happens if something is damaged?",
        a: "Report damage within 24 hours via the app or trust@cargoone.co.uk. Drivers carry minimum £10M liability insurance, and we’ll help mediate the claim.",
      },
    ],
  },
];

function Accordion({ item }: { item: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={styles.acc}>
      <View style={styles.accRow}>
        <Text style={styles.accQ}>{item.q}</Text>
        <Ionicons name={open ? "remove" : "add"} size={22} color={colors.brand} />
      </View>
      {open ? <Text style={styles.accA}>{item.a}</Text> : null}
    </Pressable>
  );
}

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Cargo One"
        description="Frequently asked questions about Cargo One — pricing, driver verification, secure payments, live tracking, and proof of delivery."
        path="/faq"
        image={IMG.heroFaq}
      />
      <Hero
        bgImage={IMG.heroFaq}
        eyebrow="FAQ"
        title="Answers to common questions"
        subtitle="Everything you need to know about Cargo One — for customers and drivers alike."
        compact
      />

      <Section bg="#fff">
        {GROUPS.map((g) => (
          <View key={g.heading} style={{ marginBottom: spacing.xxxl }}>
            <SectionHeading title={g.heading} />
            <View style={{ gap: spacing.md }}>
              {g.items.map((it) => (
                <Accordion key={it.q} item={it} />
              ))}
            </View>
          </View>
        ))}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  acc: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  accQ: { flex: 1, fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  accA: { fontSize: font.base, color: colors.textSecondary, lineHeight: 22, marginTop: spacing.sm },
});
