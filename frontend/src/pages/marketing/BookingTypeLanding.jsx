import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronRight, Clock, Truck } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { CATEGORY_IMAGES, IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { BOOKING_TYPES, BOOKING_TYPE_BY_SLUG, SERVICE_BY_SLUG, bookingTypeJsonLd, bookingTypeSeo } from "@/data/seo";

const QUOTE_HREF = "/auth/register?role=customer";

function QuoteButton({ testId }) {
  return (
    <Link
      to={QUOTE_HREF}
      data-testid={testId}
      className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
    >
      Get an instant quote <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Breadcrumb({ name }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-[1200px] px-4 pt-4 md:px-10" data-testid="booking-type-breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-[#6B7280]">
        <li><Link to="/" className="hover:text-[#111111]">Home</Link></li>
        <ChevronRight className="h-3.5 w-3.5" />
        <li><Link to="/how-it-works" className="hover:text-[#111111]">How it works</Link></li>
        <ChevronRight className="h-3.5 w-3.5" />
        <li className="font-semibold text-[#111111]" aria-current="page">{name}</li>
      </ol>
    </nav>
  );
}

function Steps({ steps }) {
  return (
    <ol className="space-y-3" data-testid="booking-type-steps">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4 rounded-[20px] border border-[#E5E7EB] bg-white p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#D62828] text-[16px] font-bold text-white">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-[#111111]">{s.title}</h3>
            <p className="mt-1 text-[14px] leading-snug text-[#6B7280]">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Vehicles({ list }) {
  return (
    <Section bg="#F4F4F4">
      <SectionHeading eyebrow="RECOVERY VEHICLES" title="Recovery vehicles on Cargo One" />
      <ul className="flex flex-wrap gap-2" data-testid="booking-type-vehicles">
        {list.map((v) => (
          <li key={v} className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#111111]">
            <Truck className="h-3.5 w-3.5 text-[#6B7280]" /> {v}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default function BookingTypeLanding() {
  const { slug } = useParams();
  const type = BOOKING_TYPE_BY_SLUG[slug];
  if (!type) return <Navigate to="/how-it-works" replace />;
  return <BookingTypeBody type={type} />;
}

function BookingTypeBody({ type }) {
  const seo = bookingTypeSeo(type);
  const image = IMG[type.image] || CATEGORY_IMAGES[type.image] || IMG.heroHow;
  const others = BOOKING_TYPES.filter((b) => b.slug !== type.slug);
  const services = type.related.map((s) => SERVICE_BY_SLUG[s]).filter(Boolean);
  const vehicles = type.vehiclesFrom ? SERVICE_BY_SLUG[type.vehiclesFrom]?.vehicles : null;
  const is247 = type.slug.startsWith("asap");

  return (
    <div data-testid={`booking-type-page-${type.slug}`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} image={image} jsonLd={bookingTypeJsonLd(type)} />
      <Hero bgImage={image} eyebrow="WAYS TO BOOK" title={seo.h1} subtitle={type.intro} compact primaryCta={{ label: "Get an instant quote", href: QUOTE_HREF }} />
      <Breadcrumb name={type.name} />

      <Section>
        <div className="grid gap-8 md:grid-cols-[3fr_2fr]">
          <div>
            <SectionHeading eyebrow="HOW IT WORKS" title="Step by step" />
            <Steps steps={type.steps} />
          </div>
          <div className="space-y-4">
            {is247 ? (
              <div className="rounded-[20px] bg-[#111111] p-6 text-white" data-testid="booking-type-247">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-3 py-1 text-[12px] font-bold tracking-[1px]">
                  <Clock className="h-3.5 w-3.5" /> BOOK 24/7
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-white/85">
                  Open 24/7, 365 days a year, with drivers available around the clock. Your job goes to drivers who are online at that moment.
                </p>
              </div>
            ) : null}
            <div className="rounded-[20px] border border-[#E5E7EB] p-6" data-testid="booking-type-best-for">
              <h2 className="text-[20px] font-bold text-[#111111]">Who it's best for</h2>
              <ul className="mt-3 space-y-2">
                {type.bestFor.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[15px] text-[#374151]">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <QuoteButton testId="booking-type-quote-btn-mid" />
          </div>
        </div>
      </Section>

      {vehicles ? <Vehicles list={vehicles} /> : null}

      <Section bg={vehicles ? "#fff" : "#F4F4F4"}>
        <SectionHeading eyebrow="FAQS" title={`${type.name} questions`} />
        <div className="mx-auto max-w-[800px] space-y-3" data-testid="booking-type-faqs">
          {type.faqs.map((f) => (
            <details key={f.q} className="rounded-[16px] border border-[#E5E7EB] bg-white p-4">
              <summary className="cursor-pointer list-none text-[15px] font-bold text-[#111111]">{f.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 md:grid-cols-3">
          <LinkList title="Other ways to book" testId="booking-type-others" items={others.map((b) => [b.name, `/how-it-works/${b.slug}`])} />
          <LinkList title="Related services" testId="booking-type-services" items={services.map((s) => [s.name, `/services/${s.slug}`])} />
          <div className="rounded-[20px] bg-[#111111] p-6 text-white">
            <h2 className="text-[20px] font-bold">Ready to book?</h2>
            <p className="mt-1 text-[14px] text-white/70">See your price in a few seconds, then book a verified driver.</p>
            <div className="mt-4"><QuoteButton testId="booking-type-quote-btn-bottom" /></div>
            <Link to="/drivers" data-testid="booking-type-drive-link" className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-white underline">
              Drive with CargoOne <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>
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
            <Link to={to} className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#D62828] hover:underline">
              {name} <ArrowRight className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
