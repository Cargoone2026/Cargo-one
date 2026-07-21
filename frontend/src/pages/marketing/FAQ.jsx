import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";

const GROUPS = [
  {
    heading: "Getting Started",
    items: [
      { q: "Is posting a job free?", a: "Yes. Posting jobs on Cargo One is completely free — you only pay when you accept a driver's quote. There's no membership fee for customers." },
      { q: "How quickly will I get quotes?", a: "For most standard categories, the first driver quotes arrive within minutes. Fixed-price jobs can be accepted instantly." },
      { q: "Do I need to create an account?", a: "Yes — accounts help us verify identities, secure payments, and enable in-app messaging with your driver. Sign-up takes 30 seconds." },
    ],
  },
  {
    heading: "Payments & Fees",
    items: [
      { q: "What's the Cargo One Booking Fee?", a: "When you accept a driver's quote, you pay a small booking fee to Cargo One via Stripe. This fee is based on job value bands, starting from £10. This is the ONLY money Cargo One charges you." },
      { q: "How does the driver get paid?", a: "The driver's quoted amount is paid directly to them on delivery — cash or bank transfer. Cargo One does not take any commission from the driver's quote." },
      { q: "What payment methods do you accept?", a: "For the booking fee, we accept all major cards (Visa, Mastercard, Amex) plus Apple Pay and Google Pay via Stripe. Driver payments on delivery are agreed between you and the driver." },
      { q: "Is my payment secure?", a: "Yes. All card payments are processed by Stripe (PCI-DSS Level 1). Cargo One never sees, stores or handles your card details." },
    ],
  },
  {
    heading: "Drivers & Verification",
    items: [
      { q: "Are drivers checked?", a: "Yes. Every Cargo One driver must upload their licence, insurance, vehicle V5, photo ID and proof of address. Documents are manually reviewed before their first job." },
      { q: "What does the 'Verified Driver' badge mean?", a: "Verified Drivers have completed all identity checks, hold valid documents, are actively rated, and have completed at least one job." },
      { q: "What if a driver cancels?", a: "If your driver cancels after you pay the booking fee, you'll receive a full refund automatically and we'll relist your job with priority matching." },
    ],
  },
  {
    heading: "Deliveries & Tracking",
    items: [
      { q: "Can I track my delivery live?", a: "Yes — once the booking fee is paid, live GPS tracking unlocks. You'll see your driver's location, route and live ETA in the app." },
      { q: "What is Proof of Delivery?", a: "On completion, the driver uploads time-stamped, GPS-tagged photos of the delivery and (optionally) captures a signature. You'll get it in the app immediately." },
      { q: "What happens if something is damaged?", a: "Report damage within 24 hours via the app or trust@cargoone.co.uk. Drivers carry minimum £10M liability insurance, and we'll help mediate the claim." },
    ],
  },
];

function Accordion({ item, index, groupIndex }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      data-testid={`faq-item-${groupIndex}-${index}`}
      className="block w-full rounded-[20px] border border-[#E5E7EB] bg-white p-5 text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex-1 text-[16px] font-semibold text-[#111111]">{item.q}</span>
        {open ? (
          <Minus className="h-[22px] w-[22px] flex-shrink-0 text-[#D62828]" />
        ) : (
          <Plus className="h-[22px] w-[22px] flex-shrink-0 text-[#D62828]" />
        )}
      </div>
      {open ? (
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">{item.a}</p>
      ) : null}
    </button>
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
        {GROUPS.map((g, gi) => (
          <div key={g.heading} className="mb-14">
            <SectionHeading title={g.heading} />
            <div className="space-y-3">
              {g.items.map((it, i) => (
                <Accordion key={it.q} item={it} index={i} groupIndex={gi} />
              ))}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
