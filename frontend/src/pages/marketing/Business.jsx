import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Building2, Code, FileText, Lock, ShoppingCart,
  TrendingDown, User, Utensils, Wrench, Home, Cross, Tag, Zap,
} from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { useResponsive } from "@/hooks/useResponsive";

const BENEFITS = [
  { icon: TrendingDown, title: "Volume discount pricing", body: "Booking fees reduced up to 40% based on monthly volume. Custom rate cards for enterprise." },
  { icon: Zap, title: "Priority driver matching", body: "Reserved capacity on peak days and dedicated fleets for time-critical routes." },
  { icon: FileText, title: "Monthly invoicing", body: "Consolidated VAT invoices, purchase-order references and self-serve CSV export." },
  { icon: User, title: "Named account manager", body: "A single point of contact for onboarding, escalations and quarterly business reviews." },
  { icon: Code, title: "Bookings API", body: "Push jobs from your OMS/WMS via REST API and webhooks. SDKs and sandbox available." },
  { icon: Lock, title: "Enterprise SLAs", body: "Custom uptime commitments, priority support, and financial-services grade security." },
];

const INDUSTRIES = [
  { icon: ShoppingCart, label: "Retail & E-commerce" },
  { icon: Utensils, label: "Food & Perishables" },
  { icon: Wrench, label: "Manufacturing" },
  { icon: Home, label: "Removals" },
  { icon: Cross, label: "Healthcare" },
  { icon: Tag, label: "Auctions" },
];

export default function Business() {
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="Business Accounts | Cargo One"
        description="Cargo One for Business — UK logistics on tap. Volume discounts, monthly invoicing, priority driver matching, API access and enterprise SLAs."
        path="/business"
        image={IMG.heroBusiness}
      />
      <Hero
        bgImage={IMG.heroBusiness}
        eyebrow="CARGO ONE FOR BUSINESS"
        title="Scale your logistics without hiring a fleet."
        subtitle="Retailers, movers, manufacturers and marketplaces — unlock a nationwide driver network with SLA-backed capacity, monthly invoicing and full-stack API access."
        compact
        primaryCta={{ label: "Talk to Sales", href: "/contact?topic=business" }}
      />

      <Section bg="#fff">
        <SectionHeading eyebrow="WHY BUSINESSES CHOOSE US" title="Everything you need to move at scale" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="min-w-[260px] space-y-2 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#FEE2E2]">
                <b.icon className="h-[22px] w-[22px] text-[#D62828]" />
              </div>
              <h3 className="text-[20px] font-bold text-[#111111]">{b.title}</h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280]">{b.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#0B0B0F">
        <div className={`flex items-center gap-12 ${isMobile ? "flex-col" : "flex-row"}`}>
          <div className="flex-1 space-y-3">
            <p className="text-[12px] font-bold tracking-[2px] text-[#FF6A00]">ENTERPRISE READY</p>
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.5px] text-white md:text-[34px]">
              SOC2-aligned. GDPR-compliant. Insured.
            </h2>
            <p className="text-[16px] leading-relaxed text-white/75 md:text-[18px]">
              Cargo One meets the requirements of finance, healthcare and enterprise procurement. We're registered with the ICO, PCI-DSS compliant via Stripe, and all drivers carry minimum £10M public liability insurance.
            </p>
            <Link
              to="/contact?topic=business"
              className="mt-4 inline-flex items-center rounded-full bg-white px-6 py-3 text-[16px] font-bold text-[#111]"
            >
              Request a demo
            </Link>
          </div>
          <div className="min-h-[260px] flex-1 overflow-hidden rounded-[20px]">
            <img src={IMG.cardTeam} alt="Cargo One team" className="h-full min-h-[260px] w-full object-cover" />
          </div>
        </div>
      </Section>

      <Section bg="#F4F4F4">
        <SectionHeading eyebrow="INDUSTRIES" title="Trusted across the UK economy" />
        <div className="flex flex-wrap justify-center gap-4">
          {INDUSTRIES.map((i) => (
            <div key={i.label} className="flex min-w-[160px] flex-1 basis-[200px] flex-col items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <i.icon className="h-6 w-6 text-[#D62828]" />
              <p className="text-center text-[14px] font-semibold text-[#111111]">{i.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#D62828">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[28px] font-bold text-white md:text-[32px]">Ready to move faster?</h2>
          <p className="text-[16px] text-white/90 md:text-[18px]">
            Speak to our team about a bespoke business account.
          </p>
          <Link
            to="/contact?topic=business"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[16px] font-bold text-[#D62828]"
          >
            Contact Sales
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </Section>
    </>
  );
}
