import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { AppStoreButtons } from "@/components/marketing/AppStoreButtons";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { RecentJobs } from "@/components/marketing/RecentJobs";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { DRIVER_CITIES, DRIVER_SIGNUP_HREF, DRIVER_WORK_FLOW, FIND_JOBS_FAQS, FIND_JOBS_SEO, findJobsJsonLd } from "@/data/seo";
import { Crumbs, Faqs } from "@/pages/marketing/LocalPlaces";

// Public driver "Find jobs" board: anonymised recent jobs + how it works + city links.
export default function FindJobs() {
  const s = FIND_JOBS_SEO;
  return (
    <div data-testid="find-jobs-page">
      <SEO title={s.title} description={s.description} path={s.path} image={IMG.heroDrivers} jsonLd={findJobsJsonLd()} />
      <Hero bgImage={IMG.heroDrivers} eyebrow="FIND WORK" title={s.h1} subtitle={s.intro} compact primaryCta={{ label: "Sign up free to quote", href: DRIVER_SIGNUP_HREF }} />
      <Crumbs items={[["Home", "/"], ["Drivers", "/drivers"], ["Find jobs"]]} />
      <JobsWithFilter />
      <WorkFlow />
      <CityLinks />
      <Faqs faqs={FIND_JOBS_FAQS} />
      <Cta />
    </div>
  );
}

function JobsWithFilter() {
  const [input, setInput] = useState("");
  const [town, setTown] = useState("");
  const form = (
    <form onSubmit={(e) => { e.preventDefault(); setTown(input.trim()); }} className="mb-8 flex max-w-[520px] items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2" data-testid="find-jobs-town-form">
      <Search className="h-4 w-4 text-[#6B7280]" />
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Filter by town, e.g. Birmingham" aria-label="Town" data-testid="find-jobs-town-input" className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]" />
      <button type="submit" data-testid="find-jobs-town-submit" className="rounded-full bg-[#111111] px-4 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-[#D62828]">Search</button>
    </form>
  );
  return <RecentJobs town={town || undefined} title={town ? `Latest jobs near ${town}` : "Latest jobs posted"} limit={12} header={form} />;
}

function WorkFlow() {
  return (
    <Section bg="#F4F4F4">
      <SectionHeading eyebrow="FOR DRIVERS" title="How it works for drivers" />
      <div className="grid gap-4 md:grid-cols-2" data-testid="find-jobs-workflow">
        {DRIVER_WORK_FLOW.map((w) => (
          <div key={w.title} className="rounded-[20px] border border-[#E5E7EB] bg-white p-6">
            <h3 className="text-[16px] font-bold text-[#111111]">{w.title}</h3>
            <p className="mt-1 text-[14px] leading-snug text-[#6B7280]">{w.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CityLinks() {
  return (
    <Section>
      <h2 className="text-[22px] font-bold text-[#111111]">Find jobs by city</h2>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" data-testid="find-jobs-cities">
        {DRIVER_CITIES.map((c) => (
          <li key={c.slug}>
            <Link to={`/drivers/jobs/${c.slug}`} data-testid={`find-jobs-city-${c.slug}`} className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#111111] hover:text-[#D62828] hover:underline">
              Courier jobs in {c.name} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Cta() {
  return (
    <Section bg="#F4F4F4">
      <div className="rounded-[20px] bg-[#111111] p-8 text-white" data-testid="find-jobs-cta">
        <h2 className="text-[24px] font-bold">Start quoting on jobs</h2>
        <p className="mt-1 text-[14px] text-white/70">Sign up free, upload your documents and send your price in the CargoOne Driver app.</p>
        <Link to={DRIVER_SIGNUP_HREF} data-testid="find-jobs-signup-btn" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#B01F1F]">
          Sign up free to quote <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="mt-5" data-testid="find-jobs-app-links"><AppStoreButtons /></div>
      </div>
    </Section>
  );
}
