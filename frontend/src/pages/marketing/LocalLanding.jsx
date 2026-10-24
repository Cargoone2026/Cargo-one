import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronRight, Clock, ExternalLink, MapPin, Route, Truck } from "lucide-react";
import { Hero } from "@/components/marketing/Hero";
import { CATEGORY_IMAGES, IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import {
  COURIERS_INDEX_SEO, LOCAL_CITIES, LOCAL_CITY_BY_SLUG, SERVICE_BY_SLUG, SERVICE_PAGES,
  cityHubFaqs, cityHubJsonLd, cityHubSeo, cityRoutes, localService, serviceCityJsonLd, serviceCitySeo,
} from "@/data/seo";

const QUOTE_HREF = "/auth/register?role=customer";
const STEPS = [
  { title: "Get an instant price", body: "Enter pickup, drop-off and what you're moving to see your price straight away." },
  { title: "A verified driver accepts", body: "Drivers are checked before they can take jobs, and you can see who's coming." },
  { title: "Track it live", body: "Follow your driver on the map and get photo proof of delivery." },
];

function QuoteButton({ testId }) {
  return (
    <Link to={QUOTE_HREF} data-testid={testId} className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#B01F1F]">
      Get an instant quote <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Crumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-[1200px] px-4 pt-4 md:px-10" data-testid="local-breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-[#6B7280]">
        {items.map(([name, to], i) => (
          <React.Fragment key={name}>
            {i > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
            <li>{to ? <Link to={to} className="hover:text-[#111111]">{name}</Link> : <span className="font-semibold text-[#111111]" aria-current="page">{name}</span>}</li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}

function Chips({ items, icon: Icon, testId }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2" data-testid={testId}>
      {items.map((v) => (
        <li key={v} className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#111111]">
          <Icon className="h-3.5 w-3.5 text-[#6B7280]" /> {v}
        </li>
      ))}
    </ul>
  );
}

function LinkList({ title, items, testId, cols }) {
  return (
    <div data-testid={testId}>
      <h2 className="text-[20px] font-bold text-[#111111]">{title}</h2>
      <ul className={`mt-3 gap-2 ${cols ? "grid sm:grid-cols-2" : "space-y-2"}`}>
        {items.map(([name, to]) => (
          <li key={to}>
            <Link to={to} className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#D62828] hover:underline">{name} <ArrowRight className="h-4 w-4" /></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faqs({ faqs }) {
  return (
    <Section>
      <SectionHeading eyebrow="FAQS" title="Questions" />
      <div className="mx-auto max-w-[800px] space-y-3" data-testid="local-faqs">
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

function Access({ city, notes }) {
  return (
    <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6" data-testid="local-access">
      <h2 className="text-[20px] font-bold text-[#111111]">Getting around {city.name}</h2>
      <ul className="mt-3 space-y-2">
        {notes.map((n) => (
          <li key={n} className="flex items-start gap-2 text-[15px] text-[#374151]"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {n}</li>
        ))}
      </ul>
      {city.cleanAir ? (
        <p className="mt-4 rounded-[12px] bg-[#F4F4F4] p-4 text-[14px] text-[#374151]" data-testid="local-clean-air">
          {city.cleanAir.text}{" "}
          <a href={city.cleanAir.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#D62828] underline">
            {city.cleanAir.label} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      ) : null}
    </div>
  );
}

function Asap247({ city }) {
  return (
    <div className="rounded-[20px] bg-[#111111] p-6 text-white md:p-8" data-testid="local-asap-247">
      <div className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-3 py-1 text-[12px] font-bold tracking-[1px]"><Clock className="h-3.5 w-3.5" /> BOOK 24/7</div>
      <h2 className="mt-3 text-[24px] font-bold">ASAP Transport and ASAP Recovery in {city.name}</h2>
      <p className="mt-2 max-w-[720px] text-[15px] leading-relaxed text-white/80">
        Need it moved now, or broken down? Book 24/7 and your job goes to drivers available around the clock near the pickup, with live tracking once one accepts.
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-[14px] font-semibold">
        <Link to="/how-it-works/asap-transport" className="underline">ASAP Transport</Link>
        <Link to="/how-it-works/asap-recovery" className="underline">ASAP Recovery</Link>
      </div>
    </div>
  );
}

export function CouriersIndex() {
  const seo = COURIERS_INDEX_SEO;
  return (
    <div data-testid="couriers-index-page">
      <SEO title={seo.title} description={seo.description} path={seo.path} image={IMG.heroHow} />
      <Hero bgImage={IMG.heroHow} eyebrow="CITIES" title={seo.h1} subtitle={seo.description} compact primaryCta={{ label: "Get an instant quote", href: QUOTE_HREF }} />
      <Crumbs items={[["Home", "/"], ["Couriers"]]} />
      <Section>
        <LinkList title="Choose your city" testId="couriers-index-cities" cols items={LOCAL_CITIES.map((c) => [`Couriers in ${c.name}`, `/couriers/${c.slug}`])} />
      </Section>
    </div>
  );
}

export function CityHub() {
  const { city } = useParams();
  const c = LOCAL_CITY_BY_SLUG[city];
  if (!c) return <Navigate to="/couriers" replace />;
  const seo = cityHubSeo(c);
  const faqs = cityHubFaqs(c);
  const routes = cityRoutes(c);
  return (
    <div data-testid={`city-hub-${c.slug}-page`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} image={IMG.heroHow} jsonLd={cityHubJsonLd(c, faqs)} />
      <Hero bgImage={IMG.heroHow} eyebrow={c.region.replace(/^the /, "").toUpperCase()} title={seo.h1} subtitle={seo.intro} compact primaryCta={{ label: "Get an instant quote", href: QUOTE_HREF }} />
      <Crumbs items={[["Home", "/"], ["Couriers", "/couriers"], [c.name]]} />
      <Section>
        <SectionHeading eyebrow="SERVICES" title={`Services in ${c.name}`} />
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3" data-testid="city-hub-services">
          {SERVICE_PAGES.map((s) => (
            <li key={s.slug}>
              <Link to={`/services/${s.slug}/${c.slug}`} data-testid={`city-hub-service-${s.slug}`} className="flex items-center justify-between rounded-[16px] border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] font-semibold text-[#111111] transition-colors hover:border-[#D62828]">
                {s.name} in {c.name} <ArrowRight className="h-4 w-4 text-[#D62828]" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <section className="mx-auto max-w-[1200px] px-4 md:px-10"><Asap247 city={c} /></section>
      <Section bg="#F4F4F4">
        <div className="grid gap-8 md:grid-cols-2">
          <div data-testid="city-hub-areas">
            <h2 className="text-[20px] font-bold text-[#111111]">Areas we cover</h2>
            <Chips items={[...c.residential, ...c.business.slice(0, 2), ...c.industrial.slice(0, 2)]} icon={MapPin} testId="city-hub-area-chips" />
          </div>
          <Access city={c} notes={[c.parking, `Main roads include the ${c.roads.join(", ")}.`]} />
        </div>
      </Section>
      <Faqs faqs={faqs} />
      <Section bg="#F4F4F4">
        <div className="grid gap-8 md:grid-cols-2">
          <LinkList title="Nearby big cities" testId="city-hub-nearby" items={routes.map((r) => [`Couriers in ${r.to.name} (via ${r.roads})`, `/couriers/${r.to.slug}`])} />
          <div className="rounded-[20px] bg-[#111111] p-6 text-white">
            <h2 className="text-[20px] font-bold">Ready to book in {c.name}?</h2>
            <p className="mt-1 text-[14px] text-white/70">See your price in a few seconds, then book a verified driver.</p>
            <div className="mt-4"><QuoteButton testId="city-hub-quote-btn-bottom" /></div>
          </div>
        </div>
      </Section>
    </div>
  );
}

export function ServiceCity() {
  const { slug, city } = useParams();
  const service = SERVICE_BY_SLUG[slug];
  const c = LOCAL_CITY_BY_SLUG[city];
  if (!service) return <Navigate to="/services" replace />;
  if (!c) return <Navigate to={`/services/${service.slug}`} replace />;
  return <ServiceCityBody service={service} c={c} />;
}

function ServiceCityBody({ service, c }) {
  const seo = serviceCitySeo(service, c);
  const local = localService(service, c);
  const image = service.heroImage || CATEGORY_IMAGES[service.image] || IMG.heroHow;
  const others = SERVICE_PAGES.filter((s) => s.slug !== service.slug);
  return (
    <div data-testid={`service-city-${service.slug}-${c.slug}-page`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} image={image} jsonLd={serviceCityJsonLd(service, c, local.faqs)} />
      <Hero bgImage={image} eyebrow={`${c.name.toUpperCase()} · ${service.name.toUpperCase()}`} title={seo.h1} subtitle={local.lead} compact primaryCta={{ label: "Get an instant quote", href: QUOTE_HREF }} />
      <Crumbs items={[["Home", "/"], ["Services", "/services"], [service.name, `/services/${service.slug}`], [c.name]]} />
      <Section>
        <SectionHeading eyebrow="HOW IT WORKS" title="Three steps" />
        <ol className="grid gap-4 md:grid-cols-3" data-testid="service-city-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
              <span className="text-[13px] font-bold text-[#D62828]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1 text-[16px] font-bold text-[#111111]">{s.title}</h3>
              <p className="mt-1 text-[14px] text-[#6B7280]">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section bg="#F4F4F4">
        <div className="grid gap-8 md:grid-cols-2">
          <div data-testid="service-city-moves">
            <h2 className="text-[20px] font-bold text-[#111111]">What we move</h2>
            <ul className="mt-3 space-y-2">
              {service.moves.map((m) => (
                <li key={m} className="flex items-start gap-2 text-[15px] text-[#374151]"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" /> {m}</li>
              ))}
            </ul>
          </div>
          <div data-testid="service-city-vehicles">
            <h2 className="text-[20px] font-bold text-[#111111]">Vehicles</h2>
            <Chips items={service.vehicles} icon={Truck} testId="service-city-vehicle-chips" />
          </div>
        </div>
      </Section>
      <Section>
        <SectionHeading eyebrow={c.region.replace(/^the /, "").toUpperCase()} title={`${service.name} around ${c.name}`} />
        <div className="grid gap-8 md:grid-cols-2" data-testid="service-city-local">
          <div>
            <h3 className="text-[18px] font-bold text-[#111111]">Areas covered</h3>
            <Chips items={local.areas} icon={MapPin} testId="service-city-areas" />
            <h3 className="mt-6 text-[18px] font-bold text-[#111111]">Popular routes</h3>
            <ul className="mt-3 space-y-2" data-testid="service-city-routes">
              {local.routes.map((r) => (
                <li key={r.to.slug} className="flex items-start gap-2 text-[15px] text-[#374151]">
                  <Route className="mt-1 h-4 w-4 shrink-0 text-[#D62828]" />
                  <span>
                    <Link to={`/services/${service.slug}/${r.to.slug}`} className="font-semibold text-[#111111] hover:text-[#D62828] hover:underline">{c.name} to {r.to.name}</Link>{" "}
                    <span className="text-[#6B7280]">via the {r.roads}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Access city={c} notes={local.access} />
        </div>
      </Section>
      {service.slug === "vehicle-recovery" ? <section className="mx-auto max-w-[1200px] px-4 md:px-10"><Asap247 city={c} /></section> : null}
      <Faqs faqs={local.faqs} />
      <Section bg="#F4F4F4">
        <div className="grid gap-8 md:grid-cols-3">
          <LinkList title={`More in ${c.name}`} testId="service-city-hubs" items={[[`All services in ${c.name}`, `/couriers/${c.slug}`], [`${service.name} across the UK`, `/services/${service.slug}`]]} />
          <LinkList title={`Other services in ${c.name}`} testId="service-city-others" items={others.map((s) => [s.name, `/services/${s.slug}/${c.slug}`])} />
          <div className="rounded-[20px] bg-[#111111] p-6 text-white">
            <h2 className="text-[20px] font-bold">Ready to book?</h2>
            <p className="mt-1 text-[14px] text-white/70">See your price in a few seconds, then book a verified driver.</p>
            <div className="mt-4"><QuoteButton testId="service-city-quote-btn-bottom" /></div>
          </div>
        </div>
      </Section>
    </div>
  );
}
