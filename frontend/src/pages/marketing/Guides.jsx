import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, BadgeCheck, BookOpen } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { CATEGORY_IMAGES, IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { GUIDES, GUIDES_INDEX_FAQS, GUIDES_INDEX_SEO, GUIDE_BY_SLUG, guideJsonLd, guideSeo, guidesIndexJsonLd } from "@/data/seo";
import { Crumbs, Faqs, LinkList, QuoteButton, pathParts } from "@/pages/marketing/LocalPlaces";

// Guides / resource centre (SEO Phase 3 · Batch 5).
export const guideImage = (g) => CATEGORY_IMAGES[g.image] || IMG[g.image] || g.image;

export function GuidesIndex() {
  const seo = GUIDES_INDEX_SEO;
  return (
    <div data-testid="guides-index-page">
      <SEO title={seo.title} description={seo.description} path={seo.path} image={IMG.heroSeoBoxes} jsonLd={guidesIndexJsonLd()} />
      <Hero bgImage={IMG.heroSeoBoxes} eyebrow="GUIDES" title={seo.h1} subtitle={seo.intro} compact primaryCta={{ label: "Get an instant quote", href: "/auth/register?role=customer" }} />
      <Crumbs items={[["Home", "/"], ["Guides"]]} />
      <Section>
        <SectionHeading eyebrow="RESOURCE CENTRE" title="All guides" />
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3" data-testid="guides-list">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link to={`/guides/${g.slug}`} data-testid={`guide-card-${g.slug}`} className="group block h-full overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white transition-colors hover:border-[#D62828]">
                <img src={guideImage(g)} alt="" loading="lazy" className="h-40 w-full object-cover" />
                <div className="p-5">
                  <h2 className="text-[17px] font-bold text-[#111111] group-hover:text-[#D62828]">{g.h1}</h2>
                  <p className="mt-2 text-[14px] leading-snug text-[#6B7280]">{g.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Faqs faqs={GUIDES_INDEX_FAQS} />
    </div>
  );
}

export function GuideArticle() {
  const g = GUIDE_BY_SLUG[pathParts(useLocation().pathname)[1]];
  if (!g) return <Navigate to="/guides" replace />;
  const seo = guideSeo(g);
  const image = guideImage(g);
  return (
    <div data-testid={`guide-page-${g.slug}`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} image={image} jsonLd={guideJsonLd(g, image)} />
      <Hero bgImage={image} eyebrow="GUIDE" title={g.h1} subtitle={g.intro} compact primaryCta={{ label: "Get an instant quote", href: "/auth/register?role=customer" }} />
      <Crumbs items={[["Home", "/"], ["Guides", "/guides"], [g.h1]]} />
      <article className="mx-auto max-w-[800px] px-4 py-12 md:px-0" data-testid="guide-article">
        {g.sections.map((s) => <GuideSection key={s.h} s={s} />)}
      </article>
      <Faqs faqs={g.faqs} />
      <GuideLinks g={g} />
    </div>
  );
}

function GuideSection({ s }) {
  return (
    <section className="mb-8">
      <h2 className="text-[22px] font-bold text-[#111111]">{s.h}</h2>
      {s.p.map((t) => <p key={t} className="mt-3 text-[16px] leading-relaxed text-[#374151]">{t}</p>)}
      {s.list ? (
        <ul className="mt-3 space-y-2">
          {s.list.map((l) => <li key={l} className="flex items-start gap-2 text-[15px] text-[#374151]"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {l}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

function GuideLinks({ g }) {
  return (
    <Section bg="#F4F4F4">
      <div className="grid gap-8 md:grid-cols-3">
        <LinkList title="Related services and booking types" testId="guide-related" items={g.links} />
        <LinkList title="More guides" testId="guide-more" items={[["All guides", "/guides"], ...GUIDES.filter((o) => o.slug !== g.slug).slice(0, 4).map((o) => [o.h1, `/guides/${o.slug}`])]} />
        <div className="rounded-[20px] bg-[#111111] p-6 text-white">
          <h2 className="flex items-center gap-2 text-[20px] font-bold"><BookOpen className="h-5 w-5 text-[#D62828]" /> Ready to book?</h2>
          <p className="mt-1 text-[14px] text-white/70">See your price in a few seconds, then book a verified driver.</p>
          <div className="mt-4"><QuoteButton testId="guide-quote-btn-bottom" /></div>
          <Link to="/services" className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-white underline">All services <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </Section>
  );
}
