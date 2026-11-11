import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { DirectorySearch } from "@/components/marketing/DirectorySearch";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { directoryByLetter } from "@/data/directory";
import { DIRECTORY_AREAS, DIRECTORY_CATEGORIES, DIRECTORY_COST_GUIDES, DIRECTORY_FAQS, DIRECTORY_GUIDANCE, DIRECTORY_SEO, directoryJsonLd } from "@/data/seo";
import { Crumbs, Faqs } from "@/pages/marketing/LocalPlaces";

const POST_JOB_HREF = "/auth/register?role=customer";

// UK transport directory: smart search, category cards, A-Z index, popular areas and FAQs.
export default function TransportDirectory() {
  const s = DIRECTORY_SEO;
  return (
    <div data-testid="transport-directory-page">
      <SEO title={s.title} description={s.description} path={s.path} image={IMG.heroSeoBoxes} jsonLd={directoryJsonLd()} />
      <Hero bgImage={IMG.heroSeoBoxes} eyebrow="TRANSPORT DIRECTORY" title={s.h1} subtitle={s.intro} compact primaryCta={{ label: "Post a job – get quotes from drivers", href: POST_JOB_HREF }} secondaryCta={{ label: "How CargoOne works", href: "/how-it-works" }} />
      <Crumbs items={[["Home", "/"], ["Transport Directory"]]} />
      <Section><DirectorySearch /></Section>
      <Categories />
      <AzIndex />
      <Areas />
      <Guidance />
      <Faqs faqs={DIRECTORY_FAQS} />
      <FinalCta />
    </div>
  );
}

const PostJobBtn = ({ testId }) => (
  <Link to={POST_JOB_HREF} data-testid={testId} className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[#B01F1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D62828] focus-visible:ring-offset-2">
    Post a job <ArrowRight className="h-4 w-4" />
  </Link>
);

function Categories() {
  return (
    <Section bg="#F4F4F4">
      <SectionHeading eyebrow="BROWSE BY TYPE" title="What are you moving?" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="directory-categories">
        {DIRECTORY_CATEGORIES.map((c) => (
          <div key={c.id} className="flex flex-col rounded-[20px] border border-[#E5E7EB] bg-white p-6" data-testid={`directory-category-${c.id}`}>
            <h2 className="text-[18px] font-bold text-[#111111]">{c.title}</h2>
            <p className="mt-1 text-[14px] leading-snug text-[#6B7280]">{c.body}</p>
            <ul className="mt-4 flex-1 space-y-1.5">
              {c.links.map(([label, href]) => (
                <li key={href}><Link to={href} className="text-[14px] font-semibold text-[#111111] hover:text-[#D62828] hover:underline">{label}</Link></li>
              ))}
            </ul>
            <div className="mt-5"><PostJobBtn testId={`directory-category-post-${c.id}`} /></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AzIndex() {
  const groups = directoryByLetter();
  return (
    <Section>
      <SectionHeading eyebrow="A-Z" title="Items and services from A to Z" />
      <nav aria-label="A-Z letters" className="mb-8 flex flex-wrap gap-2" data-testid="directory-az-letters">
        {groups.map(([l]) => <a key={l} href={`#az-${l}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[14px] font-bold text-[#111111] hover:border-[#D62828] hover:text-[#D62828]">{l}</a>)}
      </nav>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" data-testid="directory-az">
        {groups.map(([l, items]) => (
          <div key={l} id={`az-${l}`} className="scroll-mt-24">
            <h3 className="text-[24px] font-bold text-[#D62828]">{l}</h3>
            <ul className="mt-2 space-y-3">
              {items.map((e) => (
                <li key={`${e.label}-${e.path}`}>
                  <Link to={e.path} className="text-[15px] font-bold text-[#111111] hover:text-[#D62828] hover:underline">{e.label}</Link>
                  <p className="text-[13px] text-[#6B7280]">{e.line}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Areas() {
  return (
    <Section bg="#F4F4F4">
      <h2 className="text-[22px] font-bold text-[#111111]">Popular areas</h2>
      <ul className="mt-4 flex flex-wrap gap-2" data-testid="directory-areas">
        {DIRECTORY_AREAS.map(([label, href]) => (
          <li key={href}><Link to={href} className="inline-block rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#111111] hover:border-[#D62828] hover:text-[#D62828]">{label}</Link></li>
        ))}
      </ul>
    </Section>
  );
}

function Guidance() {
  return (
    <Section>
      <div className="rounded-[20px] border border-[#E5E7EB] p-6 md:p-8" data-testid="directory-guidance">
        <h2 className="text-[22px] font-bold text-[#111111]">Not sure which service?</h2>
        {DIRECTORY_GUIDANCE.map((t) => <p key={t} className="mt-3 flex items-start gap-2 text-[15px] text-[#374151]"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {t}</p>)}
        <p className="mt-4 text-[14px] text-[#6B7280]">
          Wondering about cost?{" "}
          {DIRECTORY_COST_GUIDES.map(([label, href], i) => <React.Fragment key={href}>{i ? " · " : ""}<Link to={href} className="font-semibold text-[#D62828] hover:underline">{label}</Link></React.Fragment>)}
        </p>
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section bg="#F4F4F4">
      <div className="rounded-[20px] bg-[#111111] p-8 text-white" data-testid="directory-final-cta">
        <h2 className="text-[24px] font-bold">Ready to move it?</h2>
        <p className="mt-1 text-[14px] text-white/70">Post your job, add the details and get quotes from local drivers. Book 24/7.</p>
        <div className="mt-4"><PostJobBtn testId="directory-final-post-job" /></div>
      </div>
      <p className="mt-4 text-[13px] text-[#6B7280]">
        Looking for work? <Link to="/find-jobs" className="font-semibold text-[#111111] hover:underline" data-testid="directory-find-jobs-link">Find courier, van &amp; recovery jobs</Link>
      </p>
    </Section>
  );
}
