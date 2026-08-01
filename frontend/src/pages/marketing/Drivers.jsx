import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Banknote, CheckCircle2, CreditCard, Headphones, Map,
  ShieldCheck, Star,
} from "lucide-react";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { useResponsive } from "@/hooks/useResponsive";

const REQUIREMENTS = [
  "Valid UK driving licence (car, van, LGV or HGV)",
  "Vehicle insurance with hire-and-reward cover",
  "V5C vehicle registration document",
  "Photo ID (passport or driving licence)",
  "Proof of address (utility bill or bank statement)",
  "18+ years of age",
];

const STEPS = [
  { n: "01", title: "Sign up in the app", body: "Download the driver app, create your account and choose Cargo One driver." },
  { n: "02", title: "Upload your documents", body: "Licence, insurance, vehicle V5, ID and address — all reviewed within 24 hours." },
  { n: "03", title: "Start accepting jobs", body: "Set your radius, browse nearby jobs, submit bids or accept fixed-price runs." },
  { n: "04", title: "Get paid on delivery", body: "Customers pay you your bid amount directly on delivery — no platform commission." },
];

export default function Drivers() {
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="Become a Driver | Cargo One"
        description="Join Cargo One as a driver and earn on your own terms. No commission on driver bids, verified customers, and instant on-delivery payments across the UK."
        path="/drivers"
        image={IMG.heroDrivers}
      />
      <Hero
        bgImage={IMG.heroDrivers}
        eyebrow="BECOME A CARGO ONE DRIVER"
        title="Drive when you want. Earn what you're worth."
        subtitle="Join the UK's fastest-growing logistics marketplace. Set your own prices, keep 100% of your quoted amount, and get paid directly on delivery."
        compact
        primaryCta={{ label: "Sign up as a Driver", href: "/auth/register?role=driver" }}
      />

      <Section bg="#fff" id="why-drive">
        <SectionHeading eyebrow="WHY DRIVE WITH US" title="A fairer deal for drivers" />
        <div className="flex flex-wrap gap-4">
          <FeatureCard icon={Banknote} title="0% commission on your bid" body="You quote, you keep every pound. Customers pay a separate booking fee to Cargo One." />
          <FeatureCard icon={CreditCard} title="Paid on delivery" body="Get paid directly by the customer the moment the job is complete — no weekly wait." />
          <FeatureCard icon={Map} title="Jobs near you" body="Filter jobs by distance, category and vehicle type. Get notifications for high-value bookings in your area." />
          <FeatureCard icon={ShieldCheck} title="Verified customers" body="Real-name verified customers who've locked in a booking fee — no time-wasters." />
          <FeatureCard icon={Star} title="Build your reputation" body="Verified Driver badge, ratings and reviews — attract more jobs and higher bids." />
          <FeatureCard icon={Headphones} title="24/7 driver support" body="Real humans, day or night. Emergency line for on-road issues and payment disputes." />
        </div>
      </Section>

      <Section bg="#F4F4F4" id="getting-started">
        <SectionHeading eyebrow="GETTING STARTED" title="Four steps to your first delivery" />
        <div className={`flex flex-wrap gap-4 ${isMobile ? "flex-col" : "flex-row"}`}>
          {STEPS.map((s) => (
            <div key={s.n} className="min-w-[220px] flex-1 space-y-2 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <p className="text-[48px] font-bold leading-none tracking-[-1px] text-[#FEE2E2]">{s.n}</p>
              <h3 className="text-[16px] font-bold text-[#111111]">{s.title}</h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280]">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#fff" id="requirements">
        <div className={`flex items-center gap-12 ${isMobile ? "flex-col" : "flex-row"}`}>
          <div className="flex-1 space-y-3">
            <p className="text-[12px] font-bold tracking-[2px] text-[#D62828]">REQUIREMENTS</p>
            <h2 className="text-[28px] font-bold tracking-[-0.5px] text-[#111111] md:text-[32px]">
              What you'll need to get approved
            </h2>
            <ul className="mt-3 space-y-2">
              {REQUIREMENTS.map((r) => (
                <li key={r} className="flex items-center gap-3">
                  <CheckCircle2 className="h-[22px] w-[22px] flex-shrink-0 text-[#D62828]" />
                  <span className="text-[16px] text-[#111111]">{r}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/auth/register?role=driver"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[16px] font-bold text-white"
            >
              Start Application
              <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
          </div>
          <div className="min-h-[320px] flex-1 overflow-hidden rounded-[20px]">
            <img src={IMG.cardApp} alt="Cargo One driver app" className="h-full min-h-[320px] w-full object-cover" />
          </div>
        </div>
      </Section>

      <Section bg="#0B0B0F" id="earnings">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[28px] font-bold text-white md:text-[32px]">Ready to hit the road?</h2>
          <p className="text-[16px] text-white/75 md:text-[18px]">
            Sign up in minutes. Get approved within 24 hours.
          </p>
          <Link
            to="/auth/register?role=driver"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[16px] font-bold text-white"
          >
            Become a Driver
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </Section>
    </>
  );
}
