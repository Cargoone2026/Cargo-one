import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bed,
  Bike,
  Sailboat,
  Box,
  Camera,
  Car,
  CheckCircle2,
  ClipboardEdit,
  CreditCard,
  Home,
  Hammer,
  Layers,
  Lock,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  ShieldCheck,
  ShoppingBag,
  Star,
  Users,
  Truck,
  Wrench,
  Zap,
  Briefcase,
} from "lucide-react";
import { AppStoreButtons } from "@/components/marketing/AppStoreButtons";
import { CardImage } from "@/components/marketing/CardImage";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { Hero } from "@/components/marketing/Hero";
import { CATEGORY_IMAGES, IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { useResponsive } from "@/hooks/useResponsive";

const STATS = [
  { label: "Verified drivers", value: "5,000+" },
  { label: "Deliveries completed", value: "120k" },
  { label: "Avg. driver rating", value: "4.9★" },
  { label: "UK coverage", value: "98%" },
];

const CATEGORIES = [
  { icon: Home, label: "House Moves", image: CATEGORY_IMAGES.house_moves },
  { icon: Bed, label: "Furniture", image: CATEGORY_IMAGES.furniture },
  { icon: Car, label: "Vehicles", image: CATEGORY_IMAGES.vehicles },
  { icon: Bike, label: "Motorcycles", image: CATEGORY_IMAGES.motorcycles },
  { icon: Truck, label: "Caravans", image: CATEGORY_IMAGES.caravans },
  { icon: Home, label: "Static Caravans", image: CATEGORY_IMAGES.static_caravans },
  { icon: Box, label: "Shipping Containers", image: CATEGORY_IMAGES.shipping_containers },
  { icon: Wrench, label: "Machinery", image: CATEGORY_IMAGES.machinery },
  { icon: Layers, label: "Pallets", image: CATEGORY_IMAGES.pallets },
  { icon: Sailboat, label: "Boats", image: CATEGORY_IMAGES.boats },
  { icon: Briefcase, label: "Office Moves", image: CATEGORY_IMAGES.office_moves },
  { icon: Hammer, label: "Building Materials", image: CATEGORY_IMAGES.building_materials },
  { icon: Package, label: "Parcels", image: CATEGORY_IMAGES.parcels },
  { icon: Layers, label: "Freight", image: CATEGORY_IMAGES.freight },
  { icon: Zap, label: "Same Day", image: CATEGORY_IMAGES.same_day },
];

export default function HomePage() {
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="Cargo One — Ship Anything. Anywhere. Instant Quotes."
        description="The UK's trusted logistics marketplace. Get instant quotes from vetted drivers for parcels, pallets, house moves, freight and vehicles. Live tracking, secure payments, proof of delivery."
        image={IMG.heroHome}
        path="/"
      />

      <Hero
        bgImage={IMG.heroHome}
        eyebrow="CARGO ONE — UK LOGISTICS MARKETPLACE"
        title={"Ship Anything.\nAnywhere.\nInstant Quotes."}
        subtitle="Post a job in 60 seconds. Compare bids from verified UK drivers, pay a small booking fee, and track your delivery live from pickup to doorstep."
        primaryCta={{ label: "Get an Instant Quote", href: "/auth/register?role=customer" }}
        secondaryCta={{ label: "How It Works", href: "/how-it-works" }}
      />

      {/* Trust strip */}
      <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] py-3" data-testid="trust-strip">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-6 px-4">
          {[
            { icon: ShieldCheck, text: "Vetted & insured drivers" },
            { icon: CreditCard, text: "Secure payments via Stripe" },
            { icon: MapPin, text: "Live GPS tracking" },
            { icon: Star, text: "4.9★ average rating" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-[#D62828]" />
              <span className="text-[14px] font-medium text-[#6B7280]">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <Section bg="#fff">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title="Three steps to your delivery"
          subtitle="From tiny parcels to full house removals — Cargo One matches you with the right driver in minutes."
        />
        <div className={`flex flex-wrap justify-center gap-6 ${isMobile ? "flex-col" : ""}`}>
          {[
            { n: "01", icon: ClipboardEdit, title: "Post your job for free", body: "Tell us what you're moving, where and when. Set a fixed price or accept bids from drivers." },
            { n: "02", icon: Users, title: "Compare vetted drivers", body: "See ratings, vehicle types and reviews. Pay a small booking fee to lock in your driver." },
            { n: "03", icon: Navigation, title: "Track it live to the door", body: "Get GPS tracking, in-app chat and photo proof of delivery when it arrives." },
          ].map((s) => (
            <div key={s.n} className="flex min-w-[260px] flex-1 flex-col gap-2 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <p className="text-[54px] font-bold leading-none tracking-[-2px] text-[#FEE2E2]">{s.n}</p>
              <div className="-mt-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#FEE2E2]">
                <s.icon className="h-[26px] w-[26px] text-[#D62828]" />
              </div>
              <h3 className="mt-2 text-[20px] font-bold text-[#111111]">{s.title}</h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280]">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            to="/auth/register?role=customer"
            data-testid="home-post-job-cta"
            className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-6 py-3 text-[16px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
          >
            Post a Job — It's Free
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </Section>

      {/* Categories */}
      <Section bg="#F4F4F4">
        <SectionHeading
          eyebrow="WHAT WE MOVE"
          title="Any load. Any distance."
          subtitle="From single parcels to full removals — Cargo One handles UK & European deliveries."
        />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              to="/services"
              data-testid={`home-cat-${c.label}`}
              className="relative block h-[140px] cursor-pointer overflow-hidden rounded-[20px]"
            >
              <CardImage uri={c.image} alt={c.label} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/55" />
              <div className="relative flex h-full flex-col justify-end gap-1 p-4">
                <c.icon className="h-[22px] w-[22px] text-white" />
                <span className="text-[20px] font-bold text-white">{c.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Why Cargo One */}
      <Section bg="#fff">
        <SectionHeading
          eyebrow="WHY CARGO ONE"
          title="Built for professionals & everyday senders"
          subtitle="Every feature designed to make sending, receiving and moving simpler and safer."
        />
        <div className="flex flex-wrap gap-4">
          <FeatureCard icon={Zap} title="Instant AI quotes" body="Enter your route — we calculate distance, vehicle type and price in under 3 seconds." />
          <FeatureCard icon={ShieldCheck} title="Verified drivers only" body="Licence, insurance, ID and address checked before any driver can accept a job." />
          <FeatureCard icon={MapPin} title="Live GPS tracking" body="Watch your driver in real-time, share the ETA with recipients, and get status alerts." />
          <FeatureCard icon={Camera} title="Photo proof of delivery" body="Time-stamped, GPS-tagged photos + optional signature on every delivery." />
          <FeatureCard icon={Lock} title="Secure Stripe payments" body="Only a small booking fee up front. Pay drivers directly on delivery." />
          <FeatureCard icon={MessageSquare} title="In-app messaging" body="Chat with your driver from booking to doorstep — no personal number exchange required." />
        </div>
      </Section>

      {/* Business */}
      <Section bg="#0B0B0F">
        <div className={`flex items-center gap-12 ${isMobile ? "flex-col" : "flex-row"}`}>
          <div className="flex-1 space-y-3">
            <p className="text-[12px] font-bold tracking-[2px] text-[#FF6A00]">CARGO ONE FOR BUSINESS</p>
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.5px] text-white md:text-[34px]">
              Scale your logistics without hiring a fleet.
            </h2>
            <p className="text-[16px] leading-relaxed text-white/75 md:text-[18px]">
              Multi-user accounts, priority driver matching, monthly invoicing, and dedicated account management — designed for retailers, movers, auction houses and manufacturers.
            </p>
            <ul className="mt-2 space-y-2">
              {[
                "Volume discounts on booking fees",
                "Reserved fleet for peak days",
                "Custom SLAs & priority support",
                "CSV export & API access",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#FF6A00]" />
                  <span className="text-[16px] text-white">{t}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/business"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[16px] font-bold text-[#111] transition-colors hover:bg-white/90"
            >
              Explore Business Accounts
              <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
          </div>
          <div className="min-h-[300px] flex-1 overflow-hidden rounded-[20px]">
            <img src={IMG.heroBusiness} alt="Business logistics" className="h-full min-h-[300px] w-full object-cover" />
          </div>
        </div>
      </Section>

      {/* Stats */}
      <Section bg="#fff">
        <div className="flex flex-wrap justify-center gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-grow basis-[160px] flex-col items-center py-4">
              <p className="text-[44px] font-bold tracking-[-1px] text-[#D62828]">{s.value}</p>
              <p className="mt-1 text-[14px] font-medium text-[#6B7280]">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Testimonials */}
      <Section bg="#F4F4F4">
        <SectionHeading eyebrow="TRUSTED BY BRITISH SHIPPERS" title="What customers & drivers say" />
        <div className={`flex flex-wrap gap-4 ${isMobile ? "flex-col" : "flex-row"}`}>
          {[
            { q: "Used Cargo One to move my parents' house from Manchester to Cornwall. Driver was verified, price was fair, and I tracked him the whole way. Fantastic service.", n: "Priya S.", r: "Customer" },
            { q: "Instant quotes save me hours. The photo proof of delivery gave our warehouse ops team complete peace of mind.", n: "James T.", r: "Business account" },
            { q: "As a driver I love the transparent bidding — no hidden commissions, customer pays my price direct on delivery. Best platform I've used.", n: "Kwame O.", r: "Driver, 4.98★" },
          ].map((t, i) => (
            <div key={i} className="flex min-w-[260px] flex-1 flex-col rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <p className="text-[20px] tracking-[2px] text-[#F59E0B]">★★★★★</p>
              <p className="mt-3 text-[16px] italic leading-relaxed text-[#111111]">"{t.q}"</p>
              <div className="mt-3">
                <p className="text-[14px] font-bold text-[#111111]">{t.n}</p>
                <p className="text-[12px] text-[#6B7280]">{t.r}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <Section bg="#D62828">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-[28px] font-bold tracking-[-0.5px] text-white md:text-[36px]">
            Ready to send something?
          </h2>
          <p className="max-w-[640px] text-[16px] leading-relaxed text-white/90 md:text-[18px]">
            Post your job in 60 seconds and get instant quotes from verified UK drivers.
          </p>
          <div className={`mt-3 flex ${isMobile ? "w-full flex-col" : "flex-row"} items-center gap-3`}>
            <Link
              to="/auth/register?role=customer"
              className="rounded-full bg-white px-6 py-3 text-[16px] font-bold text-[#D62828]"
            >
              Get a Quote
            </Link>
            <Link
              to="/drivers"
              className="rounded-full border-2 border-white/80 px-6 py-3 text-[16px] font-bold text-white"
            >
              Become a Driver
            </Link>
          </div>
          <div className="mt-4">
            <AppStoreButtons />
          </div>
        </div>
      </Section>
    </>
  );
}

// Also re-export SectionHeading for pages that used it as a named import.
export { SectionHeading };
