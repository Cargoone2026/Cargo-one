import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, CalendarClock, ChevronRight, Clock, MapPin, Truck, Zap } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { CATEGORY_IMAGES, IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { SERVICE_BY_SLUG, serviceJsonLd, serviceSeo } from "@/data/seo";

const QUOTE_HREF = "/auth/register?role=customer";

const STEPS = [
  { icon: Zap, title: "Get an instant price", body: "Enter pickup, drop-off and what you're moving. You see the price before you book." },
  { icon: BadgeCheck, title: "A verified driver takes the job", body: "Drivers are checked before they can accept jobs, and you see who's coming." },
  { icon: MapPin, title: "Track it live", body: "Follow your driver on the map and get photo proof when it's delivered." },
];

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

const RECOVERY_POINTS = [
  "Urgent breakdown and non-runner collection",
  "Drivers available around the clock",
  "Live tracking from acceptance to drop-off",
  "ASAP, bid and fixed-price jobs",
];

function Recovery247() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-6 md:px-10" data-testid="service-recovery-247">
      <div className="rounded-[20px] bg-[#111111] p-6 text-white md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-3 py-1 text-[12px] font-bold tracking-[1px]">
          <Clock className="h-3.5 w-3.5" /> OPEN 24/7, 365 DAYS A YEAR
        </div>
        <h2 className="mt-3 text-[24px] font-bold md:text-[28px]">24/7 ASAP recovery</h2>
        <p className="mt-2 max-w-[720px] text-[15px] leading-relaxed text-white/80">
          Broken down or stuck with a non-runner? Book 24/7 and your ASAP job goes straight to recovery drivers online near you. Prefer to plan? Post it as a bid or fixed-price job instead.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {RECOVERY_POINTS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[14px] text-white/90">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {p}
            </li>
          ))}
        </ul>
        <div className="mt-5"><QuoteButton testId="service-recovery-quote-btn" /></div>
      </div>
    </section>
  );
}

function Breadcrumb({ name }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-[1200px] px-4 pt-4 md:px-10" data-testid="service-breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-[#6B7280]">
        <li><Link to="/" className="hover:text-[#111111]">Home</Link></li>
        <ChevronRight className="h-3.5 w-3.5" />
        <li><Link to="/services" className="hover:text-[#111111]">Services</Link></li>
        <ChevronRight className="h-3.5 w-3.5" />
        <li className="font-semibold text-[#111111]" aria-current="page">{name}</li>
      </ol>
    </nav>
  );
}

export default function ServiceLanding() {
  const { slug } = useParams();
  const service = SERVICE_BY_SLUG[slug];
  if (!service) return <Navigate to="/services" replace />;
  return <ServiceLandingBody service={service} />;
}

function ServiceLandingBody({ service }) {
  const seo = serviceSeo(service);
  const image = CATEGORY_IMAGES[service.image] || IMG.heroServices;
  const related = service.related.map((s) => SERVICE_BY_SLUG[s]).filter(Boolean);

  return (
    <div data-testid={`service-page-${service.slug}`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} image={image} jsonLd={serviceJsonLd(service)} />
      <Hero
        bgImage={image}
        eyebrow="CARGO ONE SERVICES"
        title={seo.h1}
        subtitle={service.intro}
        compact
        primaryCta={{ label: "Get an instant quote", href: QUOTE_HREF }}
      />
      <Breadcrumb name={service.name} />
      {service.recovery247 ? <Recovery247 /> : null}

      <Section>
        <SectionHeading eyebrow="HOW IT WORKS" title={`Book ${service.name.toLowerCase()} in three steps`} />
        <div className="grid gap-4 md:grid-cols-3" data-testid="service-steps">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2] text-[#D62828]">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-[12px] font-bold text-[#6B7280]">STEP {i + 1}</span>
              </div>
              <h3 className="mt-3 text-[16px] font-bold text-[#111111]">{s.title}</h3>
              <p className="mt-1 text-[14px] leading-snug text-[#6B7280]">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#F4F4F4">
        <div className="grid gap-8 md:grid-cols-2">
          <div data-testid="service-moves">
            <h2 className="text-[22px] font-bold text-[#111111]">What we move</h2>
            <ul className="mt-3 space-y-2">
              {service.moves.map((m) => (
                <li key={m} className="flex items-start gap-2 text-[15px] text-[#374151]">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {m}
                </li>
              ))}
            </ul>
          </div>
          <div data-testid="service-vehicles">
            <h2 className="text-[22px] font-bold text-[#111111]">Vehicles used</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {service.vehicles.map((v) => (
                <li key={v} className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#111111]">
                  <Truck className="h-3.5 w-3.5 text-[#6B7280]" /> {v}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-[#6B7280]">We suggest a vehicle from the details you enter. You can change it before you book.</p>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="ASAP OR SCHEDULED" title="Book now or plan ahead" />
        <div className="grid gap-4 md:grid-cols-2" data-testid="service-timing">
          <div className="rounded-[20px] border border-[#E5E7EB] p-6">
            <Zap className="h-6 w-6 text-[#D62828]" />
            <h3 className="mt-2 text-[17px] font-bold text-[#111111]">ASAP</h3>
            <p className="mt-1 text-[14px] leading-snug text-[#6B7280]">
              For jobs that need doing now. Once you've paid, your job goes out to nearby drivers who are online, and you see when one accepts and is on the way.
            </p>
          </div>
          <div className="rounded-[20px] border border-[#E5E7EB] p-6">
            <CalendarClock className="h-6 w-6 text-[#D62828]" />
            <h3 className="mt-2 text-[17px] font-bold text-[#111111]">Scheduled</h3>
            <p className="mt-1 text-[14px] leading-snug text-[#6B7280]">
              Pick a date and time that suits you. Your job is posted for drivers to accept, and you confirm with a deposit once a driver takes it.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-center"><QuoteButton testId="service-quote-btn-mid" /></div>
      </Section>

      <Section bg="#F4F4F4">
        <SectionHeading eyebrow="FAQS" title={`${service.name} questions`} />
        <div className="mx-auto max-w-[800px] space-y-3" data-testid="service-faqs">
          {service.faqs.map((f) => (
            <details key={f.q} className="group rounded-[16px] border border-[#E5E7EB] bg-white p-4">
              <summary className="cursor-pointer list-none text-[15px] font-bold text-[#111111]">{f.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <div data-testid="service-related">
            <h2 className="text-[20px] font-bold text-[#111111]">Related services</h2>
            <ul className="mt-3 space-y-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link to={`/services/${r.slug}`} className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#D62828] hover:underline">
                    {r.name} <ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/services" className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#111111] hover:underline">
                  All services <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            </ul>
          </div>
          <div className="rounded-[20px] bg-[#111111] p-6 text-white">
            <h2 className="text-[20px] font-bold">Ready to book?</h2>
            <p className="mt-1 text-[14px] text-white/70">See your price in a few seconds, then book a verified driver.</p>
            <div className="mt-4"><QuoteButton testId="service-quote-btn-bottom" /></div>
            <Link to="/drivers" data-testid="service-drive-link" className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-white underline">
              Drive with CargoOne <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
