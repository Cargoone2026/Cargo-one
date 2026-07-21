import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Bed, Bike, Sailboat, Box, Briefcase, Car, ClipboardList,
  Diamond, FileText, Flower2, Hammer, Home, Layers, Leaf, Map,
  Megaphone, Package, ShoppingBag, Store, Tag, Truck, Wrench, Zap,
} from "lucide-react";
import { CardImage } from "@/components/marketing/CardImage";
import { Hero } from "@/components/marketing/Hero";
import { CATEGORY_IMAGES, IMG } from "@/components/marketing/images";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { SEO } from "@/components/marketing/SEO";
import { useResponsive } from "@/hooks/useResponsive";

const SERVICES = [
  { icon: Home, title: "House Removals", body: "Full or part-house moves, studio to 5-bed. 2-man crews, packing service and insured drivers.", tag: "Studio to 5-bed", image: CATEGORY_IMAGES.house_moves },
  { icon: Bed, title: "Furniture Delivery", body: "Single sofas, wardrobes, beds and dining sets — kerbside or in-room placement.", tag: "Any item", image: CATEGORY_IMAGES.furniture },
  { icon: Box, title: "Single Items", body: "One-off items that are too big for a parcel courier but too small for a van hire.", tag: "Awkward items", image: CATEGORY_IMAGES.single_items },
  { icon: Package, title: "Parcels & Packages", body: "Small parcels, next-day priorities, fragile items — same-day and scheduled options.", tag: "From £5", image: CATEGORY_IMAGES.parcels },
  { icon: FileText, title: "Documents", body: "Same-hour secure document couriers on bikes with chain-of-custody logs.", tag: "Same-hour", image: CATEGORY_IMAGES.documents },
  { icon: Layers, title: "Pallets", body: "UK, Euro or oversized pallets. Tail-lift loading, chilled or ambient. 1 to 26 pallets.", tag: "1–26 pallets", image: CATEGORY_IMAGES.pallets },
  { icon: Layers, title: "Freight", body: "Full and part-load freight across the UK — 7.5T, 18T and 44T HGV options.", tag: "Up to 26T", image: CATEGORY_IMAGES.freight },
  { icon: Bike, title: "Motorcycles & Scooters", body: "Insured trailer transport for bikes, mopeds and scooters. Chocks and straps included.", tag: "Any bike", image: CATEGORY_IMAGES.motorcycles },
  { icon: Car, title: "Cars & Vehicles", body: "Recovery, dealer transfers, private sales — covered transporters, flatbeds and driven collections.", tag: "UK & Europe", image: CATEGORY_IMAGES.vehicles },
  { icon: Truck, title: "Vans", body: "Van transport up to 3.5T — dealer-to-dealer, breakdown recovery, private sale collection.", tag: "Up to 3.5T", image: CATEGORY_IMAGES.vans },
  { icon: Wrench, title: "Machinery & Plant", body: "Construction and industrial machinery on flatbeds and hiab-crane vehicles.", tag: "Heavy plant", image: CATEGORY_IMAGES.machinery },
  { icon: Leaf, title: "Agricultural Equipment", body: "Tractors, implements and farm machinery — insured, permitted and abnormal-load ready.", tag: "Farm & rural", image: CATEGORY_IMAGES.agricultural },
  { icon: Hammer, title: "Building Materials", body: "Bricks, timber, plasterboard and aggregates — flatbed and curtain-side options.", tag: "Trade & DIY", image: CATEGORY_IMAGES.building_materials },
  { icon: Sailboat, title: "Boats & Marine Transport", body: "Boats, jet-skis and marine trailers — with UK & European delivery options.", tag: "Marine", image: CATEGORY_IMAGES.boats },
  { icon: Box, title: "Shipping Containers", body: "20ft and 40ft shipping containers — hiab-crane loading and unloading available.", tag: "20 / 40 ft", image: CATEGORY_IMAGES.shipping_containers },
  { icon: Truck, title: "Caravans", body: "Touring caravans — collection, delivery and storage relocation across the UK.", tag: "Touring caravans", image: CATEGORY_IMAGES.caravans },
  { icon: Home, title: "Static Caravans", body: "Static caravan and park-home relocation with abnormal-load permits and escorts.", tag: "Park homes", image: CATEGORY_IMAGES.static_caravans },
  { icon: Flower2, title: "Garden & Outdoor Items", body: "Hot tubs, sheds, playhouses, garden furniture and outdoor equipment.", tag: "Outdoor & garden", image: CATEGORY_IMAGES.garden_outdoor },
  { icon: Briefcase, title: "Office & Commercial Moves", body: "Office relocations, retail store fit-outs and exhibition logistics with weekend crews.", tag: "Commercial", image: CATEGORY_IMAGES.office_moves },
  { icon: Store, title: "Retail & Business Deliveries", body: "Retail replenishment, wholesale drops and B2B deliveries with priority SLAs.", tag: "B2B", image: CATEGORY_IMAGES.retail_business },
  { icon: Megaphone, title: "Event Equipment", body: "AV kit, staging and exhibition equipment — weekend and out-of-hours crews.", tag: "Events", image: CATEGORY_IMAGES.event_equipment },
  { icon: Tag, title: "Auction & Marketplace", body: "eBay, Facebook Marketplace and live auction house collections — verified pickup notes.", tag: "Auctions", image: CATEGORY_IMAGES.auction_marketplace },
  { icon: Zap, title: "Same Day / Express", body: "Urgent same-hour and same-day dedicated runs — priority-matched drivers.", tag: "Same-day", image: CATEGORY_IMAGES.same_day },
  { icon: Map, title: "Long Distance UK", body: "300+ mile UK routes, overnight and next-day scheduled deliveries.", tag: "Nationwide", image: CATEGORY_IMAGES.long_distance_uk },
  { icon: Diamond, title: "Fragile & High Value", body: "Art, antiques, glass, medical and high-value goods — climate-controlled options available.", tag: "White-glove", image: CATEGORY_IMAGES.fragile_high_value },
];

export default function Services() {
  const { isMobile } = useResponsive();
  return (
    <>
      <SEO
        title="Delivery Services | Cargo One"
        description="Everything Cargo One moves — parcels, pallets, house moves, vehicles, motorcycles, freight, and commercial logistics. Book a vetted UK driver in minutes."
        path="/services"
        image={IMG.heroServices}
      />
      <Hero
        bgImage={IMG.heroServices}
        eyebrow="OUR SERVICES"
        title="One platform. Every load size."
        subtitle="From urgent same-day parcels to full house removals and heavy freight — all with vetted UK drivers, live tracking and photo proof of delivery."
        compact
        primaryCta={{ label: "Get an Instant Quote", href: "/auth/register?role=customer" }}
      />

      <Section bg="#fff">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="flex flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white">
              <div className="relative h-[180px] w-full">
                <CardImage uri={s.image} alt={s.title} className="h-full w-full object-cover" testId={`svc-${s.title}`} />
                <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-1">
                  <span className="text-[12px] font-bold text-[#D62828]">{s.tag}</span>
                </div>
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#FEE2E2]">
                    <s.icon className="h-5 w-5 text-[#D62828]" />
                  </div>
                  <h3 className="flex-1 text-[16px] font-bold text-[#111111]">{s.title}</h3>
                </div>
                <p className="text-[14px] leading-snug text-[#6B7280]">{s.body}</p>
                <Link
                  to="/auth/register?role=customer"
                  className="mt-1 inline-flex items-center gap-1 text-[14px] font-bold text-[#D62828]"
                >
                  Get a quote
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#F4F4F4">
        <SectionHeading
          eyebrow="COVERAGE"
          title="UK-wide network. Same-day possible."
          subtitle="Cargo One drivers cover every UK postcode with same-day, next-day and scheduled options. Cross-border European deliveries available on request."
        />
        <div className={`flex flex-wrap gap-4 ${isMobile ? "flex-col" : "flex-row"}`}>
          {[
            { label: "UK postcodes covered", value: "98%" },
            { label: "Average pickup ETA", value: "< 90 min" },
            { label: "Cross-border routes", value: "27 countries" },
            { label: "Vehicle classes", value: "12 types" },
          ].map((s) => (
            <div key={s.label} className="flex min-w-[200px] flex-1 flex-col items-center rounded-[20px] border border-[#E5E7EB] bg-white p-6">
              <p className="text-[40px] font-bold tracking-[-1px] text-[#D62828]">{s.value}</p>
              <p className="mt-1 text-[14px] text-[#6B7280]">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
