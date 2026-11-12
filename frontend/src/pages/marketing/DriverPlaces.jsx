import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronRight, FileCheck2, MapPin, Route, Wallet, Zap } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { AppStoreButtons } from "@/components/marketing/AppStoreButtons";
import {
  DRIVER_DOCUMENTS, DRIVER_PAY_LINE, DRIVER_PAY_STEPS, DRIVER_SIGNUP_HREF, DRIVER_TYPES, DRIVER_WORK_FLOW,
  PLACE_DRIVER_CITY_BY_SLUG, cityFaqs, driverCitySeo, driverJsonLd, placeDriverRelated,
} from "@/data/seo";
import { pathParts } from "@/pages/marketing/LocalPlaces";
import { RecentJobs } from "@/components/marketing/RecentJobs";

// Same layout as DriverCityLanding (DriverLanding.jsx), driven by PLACE_DRIVER_CITIES.
export function PlaceDriverJobs() {
  const parts = pathParts(useLocation().pathname);
  const c = PLACE_DRIVER_CITY_BY_SLUG[parts[2]];
  if (!c) return <Navigate to="/drivers" replace />;
  const seo = driverCitySeo(c);
  const faqs = cityFaqs(c);
  return (
    <div data-testid={`driver-city-${c.slug}-page`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} image={IMG.heroDrivers} jsonLd={driverJsonLd(seo, faqs, [])} />
      <Hero bgImage={IMG.heroDrivers} eyebrow="DRIVE WITH CARGO ONE" title={seo.h1} subtitle={seo.intro} compact primaryCta={{ label: "Sign up to drive", href: DRIVER_SIGNUP_HREF }} />
      <nav aria-label="Breadcrumb" className="mx-auto max-w-[1200px] px-4 pt-4 md:px-10" data-testid="driver-breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-[13px] text-[#6B7280]">
          <li><Link to="/" className="hover:text-[#111111]">Home</Link></li>
          <ChevronRight className="h-3.5 w-3.5" />
          <li><Link to="/drivers" className="hover:text-[#111111]">Drivers</Link></li>
          <ChevronRight className="h-3.5 w-3.5" />
          <li className="font-semibold text-[#111111]" aria-current="page">{seo.h1}</li>
        </ol>
      </nav>
      <Section bg="#F4F4F4">
        <SectionHeading eyebrow={c.region.replace(/^the /, "").toUpperCase()} title={`Driving in ${c.name}`} />
        <div className="grid gap-8 md:grid-cols-2" data-testid="driver-city-local">
          <Chips title="Busy areas" items={c.areas} icon={MapPin} testId="driver-city-areas" />
          <Chips title="Routes you'll use" items={c.routes} icon={Route} testId="driver-city-routes" />
        </div>
        <Link to={`/couriers/${c.slug}`} data-testid="driver-city-couriers-link" className="mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-[#D62828] hover:underline">
          Need something moved in {c.name}? See couriers in {c.name} <ArrowRight className="h-4 w-4" />
        </Link>
      </Section>
      <WorkFlow />
      <RequirementsAndPay />
      <RecentJobs town={c.name} title={`Recent jobs near ${c.name}`} />
      <DriverFaqs faqs={faqs} />
      <Related cities={placeDriverRelated(c)} />
    </div>
  );
}

function WorkFlow() {
  return (
    <Section>
      <SectionHeading eyebrow="HOW THE WORK FLOWS" title="Four ways to find work" />
      <div className="grid gap-4 md:grid-cols-2" data-testid="driver-work-flow">
        {DRIVER_WORK_FLOW.map((w, i) => (
          <div key={w.title} className={`rounded-[20px] p-6 ${i < 2 ? "bg-[#111111] text-white" : "border border-[#E5E7EB] bg-white"}`}>
            <div className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${i < 2 ? "text-[#D62828]" : "text-[#6B7280]"}`} />
              <h3 className="text-[18px] font-bold">{w.title}</h3>
              {i < 2 ? <span className="rounded-full bg-[#D62828] px-2 py-0.5 text-[11px] font-bold tracking-[1px]">24/7</span> : null}
            </div>
            <p className={`mt-2 text-[14px] leading-relaxed ${i < 2 ? "text-white/80" : "text-[#6B7280]"}`}>{w.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RequirementsAndPay() {
  return (
    <Section bg="#F4F4F4">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="rounded-[20px] bg-white p-6" data-testid="driver-requirements">
          <h2 className="flex items-center gap-2 text-[20px] font-bold text-[#111111]"><FileCheck2 className="h-5 w-5 text-[#D62828]" /> What you need</h2>
          <ul className="mt-3 space-y-2">
            {DRIVER_DOCUMENTS.map((d) => (
              <li key={d} className="flex items-start gap-2 text-[15px] text-[#374151]"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {d}</li>
            ))}
          </ul>
          <p className="mt-4 text-[14px] text-[#6B7280]">
            Cargo One reviews each document. Your account is activated once they're all approved, and we may ask you to update a document at any time.
          </p>
        </div>
        <div className="rounded-[20px] bg-white p-6" data-testid="driver-payment">
          <h2 className="flex items-center gap-2 text-[20px] font-bold text-[#111111]"><Wallet className="h-5 w-5 text-[#D62828]" /> How payment works</h2>
          <ol className="mt-3 space-y-2">
            {DRIVER_PAY_STEPS.slice(0, 3).map((p, i) => (
              <li key={p} className="flex items-start gap-3 text-[15px] text-[#374151]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[12px] font-bold text-white">{i + 1}</span> {p}
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-[12px] bg-[#FDECEC] px-4 py-3 text-[14px] font-semibold text-[#B01F1F]" data-testid="driver-no-commission">{DRIVER_PAY_LINE}</p>
        </div>
      </div>
    </Section>
  );
}

function DriverFaqs({ faqs }) {
  return (
    <Section>
      <SectionHeading eyebrow="FAQS" title="Driver questions" />
      <div className="mx-auto max-w-[800px] space-y-3" data-testid="driver-faqs">
        {faqs.map((f) => (
          <details key={f.q} className="rounded-[16px] border border-[#E5E7EB] bg-white p-4">
            <summary className="cursor-pointer list-none text-[15px] font-bold text-[#111111]">{f.q}</summary>
            <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Related({ cities }) {
  return (
    <Section bg="#F4F4F4">
      <div className="grid gap-8 md:grid-cols-3">
        <LinkList title="Driver work by type" testId="driver-related-types" items={DRIVER_TYPES.map((t) => [t.h1, `/drivers/${t.slug}`])} />
        <LinkList title="Driver jobs by city" testId="driver-related-cities" items={cities.map((c) => [`Courier jobs in ${c.name}`, `/drivers/jobs/${c.slug}`])} />
        <div className="rounded-[20px] bg-[#111111] p-6 text-white">
          <h2 className="text-[20px] font-bold">Ready to drive?</h2>
          <p className="mt-1 text-[14px] text-white/70">Register, upload your documents and go online once you're approved.</p>
          <Link to={DRIVER_SIGNUP_HREF} data-testid="driver-signup-btn-bottom" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#B01F1F]">
            Sign up to drive <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-5" data-testid="driver-app-links"><AppStoreButtons app="driver" /></div>
        </div>
      </div>
    </Section>
  );
}

function Chips({ title, items, icon: Icon, testId }) {
  return (
    <div data-testid={testId}>
      <h2 className="text-[20px] font-bold text-[#111111]">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((v) => (
          <li key={v} className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#111111]">
            <Icon className="h-3.5 w-3.5 text-[#6B7280]" /> {v}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkList({ title, items, testId }) {
  return (
    <div data-testid={testId}>
      <h2 className="text-[20px] font-bold text-[#111111]">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map(([name, to]) => (
          <li key={to}>
            <Link to={to} className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#D62828] hover:underline">{name} <ArrowRight className="h-4 w-4" /></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
