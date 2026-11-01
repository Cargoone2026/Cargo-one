import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, ExternalLink, MapPin, Route } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import {
  LOCAL_CITY_BY_SLUG, LONDON_AREAS_FAQS, LONDON_AREAS_PATH, LONDON_AREAS_SEO, LONDON_BOROUGHS, LONDON_BOROUGH_BY_SLUG,
  LONDON_BOROUGH_SERVICES, boroughFaqs, boroughJsonLd, boroughSeo, londonAreasJsonLd,
} from "@/data/seo";
import { Access, Asap247, Chips, Crumbs, Faqs, LinkList, QuoteButton, pathParts } from "@/pages/marketing/LocalPlaces";

// London borough pages (SEO Phase 3 · Batch 4), same layout as the city hubs.
const QUOTE_HREF = "/auth/register?role=customer";
const LONDON = LOCAL_CITY_BY_SLUG.london;
const CRUMBS = [["Home", "/"], ["Couriers", "/couriers"], ["London", "/couriers/london"]];

export function BoroughHub() {
  const b = LONDON_BOROUGH_BY_SLUG[pathParts(useLocation().pathname)[2]];
  if (!b) return <Navigate to={LONDON_AREAS_PATH} replace />;
  const seo = boroughSeo(b);
  const faqs = boroughFaqs(b);
  return (
    <div data-testid={`borough-hub-${b.slug}-page`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} image={IMG.heroSeoBoxes} jsonLd={boroughJsonLd(b, faqs)} />
      <Hero bgImage={IMG.heroSeoBoxes} eyebrow={`LONDON · ${b.name.toUpperCase()}`} title={seo.h1} subtitle={seo.intro} compact primaryCta={{ label: "Get an instant quote", href: QUOTE_HREF }} />
      <Crumbs items={[...CRUMBS, ["London areas", LONDON_AREAS_PATH], [b.name]]} />
      <BoroughServices b={b} />
      <section className="mx-auto max-w-[1200px] px-4 md:px-10"><Asap247 city={b} /></section>
      <Section bg="#F4F4F4">
        <div className="grid gap-8 md:grid-cols-2">
          <div data-testid="borough-areas">
            <h2 className="text-[20px] font-bold text-[#111111]">Areas in {b.name}</h2>
            <Chips items={b.districts} icon={MapPin} testId="borough-area-chips" />
            <h2 className="mt-6 text-[20px] font-bold text-[#111111]">Main roads</h2>
            <Chips items={b.roads} icon={Route} testId="borough-road-chips" />
          </div>
          <div>
            <Access city={{ ...b, cleanAir: LONDON.cleanAir }} notes={[b.parking, `Popular shopping areas include ${b.retail.join(", ")}.`]} />
            {b.tfl ? (
              <a href={b.tfl.url} target="_blank" rel="noopener noreferrer" data-testid="borough-tfl-link" className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-[#D62828] underline">
                {b.tfl.label} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </Section>
      <Faqs faqs={faqs} />
      <Section bg="#F4F4F4">
        <div className="grid gap-8 md:grid-cols-2">
          <LinkList title="Other London areas" testId="borough-others" cols items={LONDON_BOROUGHS.filter((o) => o.slug !== b.slug).map((o) => [`Couriers in ${o.name}`, `/couriers/london/${o.slug}`])} />
          <div>
            <LinkList title="More in London" testId="borough-london-links" items={[["Couriers in London", "/couriers/london"], ["All London areas", LONDON_AREAS_PATH]]} />
            <div className="mt-6 rounded-[20px] bg-[#111111] p-6 text-white">
              <h2 className="text-[20px] font-bold">Ready to book in {b.name}?</h2>
              <p className="mt-1 text-[14px] text-white/70">See your price in a few seconds, then book a verified driver.</p>
              <div className="mt-4"><QuoteButton testId="borough-quote-btn-bottom" /></div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function BoroughServices({ b }) {
  return (
    <Section>
      <SectionHeading eyebrow="SERVICES" title={`Popular services in ${b.name}`} />
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="borough-services">
        {LONDON_BOROUGH_SERVICES.map((s) => (
          <li key={s.slug}>
            <Link to={`/services/${s.slug}/london`} data-testid={`borough-service-${s.slug}`} className="flex items-center justify-between rounded-[16px] border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] font-semibold text-[#111111] transition-colors hover:border-[#D62828]">
              {s.name} in London <ArrowRight className="h-4 w-4 text-[#D62828]" />
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/couriers/london" data-testid="borough-london-hub-link" className="mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-[#D62828] hover:underline">
        All services in London <ArrowRight className="h-4 w-4" />
      </Link>
    </Section>
  );
}

export function LondonAreas() {
  const seo = LONDON_AREAS_SEO;
  return (
    <div data-testid="london-areas-page">
      <SEO title={seo.title} description={seo.description} path={seo.path} image={IMG.heroSeoBoxes} jsonLd={londonAreasJsonLd()} />
      <Hero bgImage={IMG.heroSeoBoxes} eyebrow="LONDON" title={seo.h1} subtitle={seo.intro} compact primaryCta={{ label: "Get an instant quote", href: QUOTE_HREF }} />
      <Crumbs items={[...CRUMBS, ["London areas"]]} />
      <Section>
        <SectionHeading eyebrow="BOROUGHS" title="Choose your area" />
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3" data-testid="london-areas-list">
          {LONDON_BOROUGHS.map((b) => (
            <li key={b.slug}>
              <Link to={`/couriers/london/${b.slug}`} data-testid={`london-area-${b.slug}`} className="block rounded-[16px] border border-[#E5E7EB] bg-white px-4 py-3 transition-colors hover:border-[#D62828]">
                <span className="flex items-center justify-between text-[15px] font-semibold text-[#111111]">Couriers in {b.name} <ArrowRight className="h-4 w-4 text-[#D62828]" /></span>
                <span className="mt-1 block text-[13px] text-[#6B7280]">{b.districts.slice(0, 3).join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/couriers/london" data-testid="london-areas-hub-link" className="mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-[#D62828] hover:underline">
          Couriers in London <ArrowRight className="h-4 w-4" />
        </Link>
      </Section>
      <Faqs faqs={LONDON_AREAS_FAQS} />
    </div>
  );
}
