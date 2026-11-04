import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { AppStoreButtons } from "@/components/marketing/AppStoreButtons";
import { Hero } from "@/components/marketing/Hero";
import { Section } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { ASAP_PAGE_BY_PATH, asapJsonLd, asapOtherCities } from "@/data/seo";
import { Crumbs, Faqs, LinkList, QuoteButton } from "@/pages/marketing/LocalPlaces";

// ASAP live dispatch hub pages (/asap, /asap/live-tracking, /asap/recovery, /asap/recovery/{city}).
export default function AsapPage() {
  const p = ASAP_PAGE_BY_PATH[useLocation().pathname.replace(/\/+$/, "")];
  if (!p) return <Navigate to="/asap" replace />;
  const slug = p.path.split("/").filter(Boolean).join("-");
  return (
    <div data-testid={`${slug}-page`}>
      <SEO title={p.title} description={p.description} path={p.path} image={p.image} jsonLd={asapJsonLd(p)} />
      <Hero bgImage={p.image} eyebrow={p.eyebrow} title={p.h1} subtitle={p.intro} compact primaryCta={{ label: "Get an instant quote", href: "/auth/register?role=customer" }} />
      <Crumbs items={p.crumbs} />
      <article className="mx-auto max-w-[860px] px-4 py-12 md:px-0" data-testid="asap-article">
        <Badge247 />
        {p.sections.map((s) => <AsapSection key={s.h} s={s} />)}
        {p.table ? <CompareTable t={p.table} /> : null}
      </article>
      <Faqs faqs={p.faqs} />
      <AsapLinks p={p} />
    </div>
  );
}

function Badge247() {
  return (
    <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-1.5 text-[12px] font-bold tracking-[1px] text-white" data-testid="asap-247-badge">
      <Clock className="h-3.5 w-3.5 text-[#D62828]" /> BOOK 24/7 · 365 DAYS A YEAR
    </div>
  );
}

function AsapSection({ s }) {
  const safety = /safe/i.test(s.h);
  return (
    <section className={`mb-8 ${safety ? "rounded-[20px] border border-[#FCA5A5] bg-[#FEF2F2] p-6" : ""}`}>
      <h2 className="flex items-center gap-2 text-[22px] font-bold text-[#111111]">{safety ? <ShieldAlert className="h-5 w-5 text-[#D62828]" /> : null}{s.h}</h2>
      {s.p.map((t) => <p key={t} className="mt-3 text-[16px] leading-relaxed text-[#374151]">{t}</p>)}
      {s.list ? (
        <ul className="mt-3 space-y-2">
          {s.list.map((l) => <li key={l} className="flex items-start gap-2 text-[15px] text-[#374151]"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {l}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

function CompareTable({ t }) {
  return (
    <section className="mb-8" data-testid="asap-compare-table">
      <h2 className="text-[22px] font-bold text-[#111111]">{t.h}</h2>
      <div className="mt-4 overflow-x-auto rounded-[16px] border border-[#E5E7EB]">
        <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
          <thead className="bg-[#111111] text-white">
            <tr>{t.head.map((h) => <th key={h || "row"} className="px-4 py-3 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r[0]} className="border-t border-[#E5E7EB] bg-white align-top">
                {r.map((v, i) => <td key={`${r[0]}-${i}`} className={`px-4 py-3 ${i === 0 ? "font-bold text-[#111111]" : "text-[#374151]"}`}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AsapLinks({ p }) {
  const extra = p.otherCities ? asapOtherCities(p) : p.path === "/asap/recovery" ? asapOtherCities({ path: "" }) : null;
  return (
    <Section bg="#F4F4F4">
      <div className={`grid gap-8 ${extra ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <LinkList title="Related pages" testId="asap-related" items={p.links} />
        {extra ? <LinkList title={p.otherCities ? "ASAP Recovery in other cities" : "ASAP Recovery by city"} testId="asap-cities" items={extra} /> : null}
        <div className="rounded-[20px] bg-[#111111] p-6 text-white" data-testid="asap-cta">
          <h2 className="text-[20px] font-bold">Need it now?</h2>
          <p className="mt-1 text-[14px] text-white/70">Book 24/7, see an instant price and track your driver live.</p>
          <div className="mt-4"><QuoteButton testId="asap-quote-btn-bottom" /></div>
          {p.appLinks ? <div className="mt-5" data-testid="asap-app-links"><AppStoreButtons /></div> : null}
        </div>
      </div>
    </Section>
  );
}
