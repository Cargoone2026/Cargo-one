import React from "react";
import {
  AlertCircle, Camera, CreditCard, FileText, Headphones, HeartPulse,
  Lock, MessageSquare, Navigation, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";

const PILLARS = [
  { icon: ShieldCheck, title: "Driver verification", body: "Every driver's licence, insurance, V5, ID and address is manually reviewed before their first job." },
  { icon: Lock, title: "Secure payments", body: "All card payments are processed by Stripe (PCI-DSS Level 1). We never see or store card data." },
  { icon: CreditCard, title: "Booking-fee model", body: "Only a small deposit is charged upfront. The rest goes directly to the driver on delivery." },
  { icon: Navigation, title: "Live tracking", body: "Real-time GPS location, ETA, and route history — shareable with recipients and family." },
  { icon: Camera, title: "Photo proof of delivery", body: "Time-stamped, GPS-tagged photos and optional signature captured on every completed job." },
  { icon: MessageSquare, title: "Private in-app messaging", body: "Talk to your driver without ever sharing your phone number. Chat history is retained for disputes." },
];

const POLICIES = [
  { icon: FileText, title: "GDPR compliant", body: "Registered with the UK Information Commissioner's Office. Right to erase and data portability supported." },
  { icon: HeartPulse, title: "Insured drivers", body: "All drivers carry a minimum of £10M public liability insurance with hire-and-reward cover." },
  { icon: TriangleAlert, title: "Zero-tolerance policy", body: "Strict rules on undisclosed subcontracting, damage, and no-shows. Repeat offenders are banned." },
  { icon: Headphones, title: "24/7 support", body: "Real humans on chat and phone for both customers and drivers, day or night." },
];

export default function TrustSafety() {
  return (
    <>
      <SEO
        title="Trust & Safety | Cargo One"
        description="How Cargo One keeps deliveries safe — driver verification, Stripe secure payments, live GPS tracking, photo proof of delivery, and GDPR-compliant data handling."
        path="/trust-safety"
        image={IMG.heroTrust}
      />
      <Hero
        bgImage={IMG.heroTrust}
        eyebrow="TRUST & SAFETY"
        title="Peace of mind, built in."
        subtitle="Six layers of protection surrounding every Cargo One booking — from driver checks to encrypted payments to real-time tracking."
        compact
      />

      <Section bg="#fff">
        <SectionHeading eyebrow="OUR SIX PILLARS" title="Every safeguard on every booking" />
        <div className="flex flex-wrap gap-4">
          {PILLARS.map((p) => (
            <FeatureCard key={p.title} icon={p.icon} title={p.title} body={p.body} />
          ))}
        </div>
      </Section>

      <Section bg="#F4F4F4">
        <SectionHeading eyebrow="POLICIES & COMPLIANCE" title="Independently verified. Fully accountable." />
        <div className="flex flex-wrap gap-4">
          {POLICIES.map((p) => (
            <div key={p.title} className="flex min-w-[260px] flex-1 basis-[300px] gap-3 rounded-[20px] border border-[#E5E7EB] bg-white p-5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#FEE2E2]">
                <p.icon className="h-[22px] w-[22px] text-[#D62828]" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[16px] font-bold text-[#111111]">{p.title}</p>
                <p className="text-[14px] leading-snug text-[#6B7280]">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#fff">
        <SectionHeading eyebrow="REPORT AN ISSUE" title="Something went wrong? We're here." />
        <div className="flex gap-3 rounded-[20px] bg-[#FEE2E2] p-6">
          <AlertCircle className="h-[26px] w-[26px] flex-shrink-0 text-[#D62828]" />
          <div className="flex-1 space-y-1">
            <p className="text-[20px] font-bold text-[#111111]">Safety incidents &amp; disputes</p>
            <p className="text-[14px] leading-relaxed text-[#111111]">
              For urgent safety concerns, contact our 24/7 line:{" "}
              <span className="font-bold">+44 800 111 000</span>. For payment disputes or complaints, email{" "}
              <span className="font-bold">trust@cargoone.co.uk</span>. We aim to respond within 2 hours for safety matters and 24 hours for all other queries.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
