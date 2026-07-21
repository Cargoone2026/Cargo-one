import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  ClipboardEdit,
  Coins,
  CreditCard,
  Lock,
  MessageSquare,
  Navigation,
  ShieldCheck,
  User,
  CheckCheck,
} from "lucide-react";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { useResponsive } from "@/hooks/useResponsive";

const STEPS = [
  { icon: ClipboardEdit, title: "Post your delivery", body: "Choose your category, add pickup & drop-off, dates, dimensions and any photos. Set a fixed price or accept bids." },
  { icon: Coins, title: "Get instant quotes", body: "Our engine calculates distance, vehicle type and price in seconds. Compare bids side-by-side." },
  { icon: User, title: "Pick your driver", body: "Every driver is fully vetted — licence, insurance, ID and address checked. See ratings and reviews." },
  { icon: CreditCard, title: "Pay a small booking fee", body: "Only the booking fee is charged now via Stripe. The driver's bid is paid directly on delivery." },
  { icon: Navigation, title: "Track live in-app", body: "Watch your driver in real time. Chat in the app. See ETA and status updates end-to-end." },
  { icon: CheckCheck, title: "Confirm & review", body: "Photo POD + signature captured on delivery. Confirm receipt and leave a review." },
];

export default function HowItWorks() {
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="How It Works | Cargo One"
        description="Six simple steps to book a delivery on Cargo One. Post a job, compare quotes from vetted UK drivers, pay a small booking fee via Stripe, and track live to your doorstep."
        path="/how-it-works"
        image={IMG.heroHow}
      />
      <Hero
        bgImage={IMG.heroHow}
        eyebrow="HOW IT WORKS"
        title="Six steps. Zero surprises."
        subtitle="From posting to proof-of-delivery, here's exactly how a Cargo One booking works."
        compact
        primaryCta={{ label: "Post a Job — Free", href: "/auth/register?role=customer" }}
      />

      <Section bg="#fff">
        <div className="space-y-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`flex gap-6 rounded-[20px] border border-[#E5E7EB] bg-white p-6 ${isMobile ? "flex-col items-start" : "items-center"}`}
            >
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[20px] bg-[#D62828]">
                <span className="text-[24px] font-bold text-white">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <s.icon className="h-[22px] w-[22px] text-[#D62828]" />
                  <h3 className="text-[20px] font-bold text-[#111111]">{s.title}</h3>
                </div>
                <p className="text-[14px] leading-relaxed text-[#6B7280]">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#F4F4F4">
        <SectionHeading
          eyebrow="PRICING"
          title="Transparent, upfront pricing"
          subtitle="You pay a small Cargo One booking fee via Stripe. The driver's exact bid is paid directly to them on delivery — no hidden commissions."
        />
        <div className={`flex gap-4 ${isMobile ? "flex-col" : "flex-row"}`}>
          <div className="min-w-[260px] flex-1 space-y-1 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
            <div className="self-start rounded-full bg-[#D62828] px-3 py-1 text-[12px] font-bold tracking-[1px] text-white" style={{ width: "fit-content" }}>
              YOU PAY NOW
            </div>
            <p className="mt-2 text-[16px] font-medium text-[#6B7280]">Cargo One Booking Fee</p>
            <p className="text-[36px] font-bold tracking-[-1px] text-[#111111]">From £10</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">
              Charged securely via Stripe. Calculated based on job value bands.
            </p>
          </div>
          <div className="min-w-[260px] flex-1 space-y-1 rounded-[20px] border border-[#111] bg-[#0B0B0F] p-6">
            <div className="self-start rounded-full bg-[#FF6A00] px-3 py-1 text-[12px] font-bold tracking-[1px] text-white" style={{ width: "fit-content" }}>
              ON DELIVERY
            </div>
            <p className="mt-2 text-[16px] font-medium text-white">Driver Bid</p>
            <p className="text-[36px] font-bold tracking-[-1px] text-white">Direct to Driver</p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/70">
              The exact amount the driver quoted. Paid cash or card on delivery.
            </p>
          </div>
        </div>
      </Section>

      <Section bg="#fff">
        <SectionHeading eyebrow="BUILT IN SAFEGUARDS" title="Every booking is protected" />
        <div className="flex flex-wrap gap-4">
          <FeatureCard icon={Lock} title="Encrypted payments" body="Stripe handles all card processing. We never see or store your card details." />
          <FeatureCard icon={ShieldCheck} title="Verified identities" body="Every driver's licence, insurance, ID and address is confirmed by our team." />
          <FeatureCard icon={Camera} title="Photo POD" body="Every delivery ends with time-stamped photos and an optional signature." />
          <FeatureCard icon={MessageSquare} title="Private in-app chat" body="Talk to your driver without ever exchanging phone numbers." />
        </div>
      </Section>

      <Section bg="#D62828">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[28px] font-bold text-white md:text-[32px]">Ready to try it?</h2>
          <p className="text-[16px] text-white/90 md:text-[18px]">
            Post your first delivery and see the difference in 60 seconds.
          </p>
          <Link
            to="/auth/register?role=customer"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[16px] font-bold text-[#D62828]"
          >
            Get Started
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </Section>
    </>
  );
}
