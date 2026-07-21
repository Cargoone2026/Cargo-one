import React from "react";
import { Heart, Leaf, Rocket, ShieldCheck } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { useResponsive } from "@/hooks/useResponsive";

const VALUES = [
  { icon: Heart, title: "Fairness first", body: "0% commission on driver bids. Transparent booking fees. Never a hidden charge." },
  { icon: ShieldCheck, title: "Trust by design", body: "Verification, live tracking and photo POD make every booking safer than a phone-book courier." },
  { icon: Leaf, title: "Efficient by default", body: "Matching customers with local drivers reduces empty miles and carbon emissions." },
  { icon: Rocket, title: "Speed matters", body: "Instant quotes. Same-day options. Support that answers in minutes, not days." },
];

const TIMELINE = [
  { year: "2023", title: "Cargo One founded in London" },
  { year: "2024", title: "1,000+ verified drivers on the platform" },
  { year: "2025", title: "Business Accounts + API launch" },
  { year: "2026", title: "Nationwide same-day coverage & app launch" },
];

export default function About() {
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="About Cargo One"
        description="Meet Cargo One — the fair, transparent UK logistics marketplace matching customers with vetted drivers. Our mission, values and story."
        path="/about"
        image={IMG.heroAbout}
      />
      <Hero
        bgImage={IMG.heroAbout}
        eyebrow="OUR STORY"
        title="Logistics done fair."
        subtitle="Cargo One was built by drivers and shippers frustrated by opaque platforms and hidden fees. We're rebuilding delivery around trust, speed and honest pricing."
        compact
      />

      <Section bg="#fff">
        <div className={`flex items-center gap-12 ${isMobile ? "flex-col" : "flex-row"}`}>
          <div className="flex-1 space-y-3">
            <p className="text-[12px] font-bold tracking-[2px] text-[#D62828]">OUR MISSION</p>
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.5px] text-[#111111] md:text-[34px]">
              Make sending anything, anywhere, effortless.
            </h2>
            <p className="text-[16px] leading-relaxed text-[#6B7280] md:text-[18px]">
              We believe delivery should be as simple as tapping a button, as trustworthy as a hand-off, and as fair as a market where both sides win. Cargo One is a two-sided marketplace where customers get instant quotes and vetted drivers, and drivers keep 100% of what they quote.
            </p>
            <p className="text-[16px] leading-relaxed text-[#6B7280] md:text-[18px]">
              We're headquartered in London with team members in Manchester, Birmingham and Bristol. We're building the logistics platform the UK deserves — modern, transparent and safe.
            </p>
          </div>
          <div className="min-h-[300px] flex-1 overflow-hidden rounded-[20px]">
            <img src={IMG.cardTeam} alt="Cargo One team" className="h-full min-h-[300px] w-full object-cover" />
          </div>
        </div>
      </Section>

      <Section bg="#F4F4F4">
        <SectionHeading eyebrow="OUR VALUES" title="What we believe" />
        <div className="flex flex-wrap gap-4">
          {VALUES.map((v) => (
            <div key={v.title} className="min-w-[240px] flex-1 basis-[260px] space-y-2 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#FEE2E2]">
                <v.icon className="h-[22px] w-[22px] text-[#D62828]" />
              </div>
              <h3 className="text-[20px] font-bold text-[#111111]">{v.title}</h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280]">{v.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#fff">
        <SectionHeading eyebrow="MILESTONES" title="How we got here" />
        <div className="mx-auto max-w-[720px] space-y-4">
          {TIMELINE.map((t) => (
            <div key={t.year} className="flex items-start gap-3">
              <div className="mt-1.5 h-3.5 w-3.5 flex-shrink-0 rounded-full bg-[#D62828]" />
              <div>
                <p className="text-[12px] font-bold tracking-[2px] text-[#D62828]">{t.year}</p>
                <p className="mt-0.5 text-[16px] font-semibold text-[#111111]">{t.title}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
