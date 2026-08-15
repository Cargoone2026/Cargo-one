import {
  Package,
  Truck,
  Home,
  Armchair,
  FileText,
  Layers,
  Bike,
  Car,
  Cog,
  Sprout,
  Hammer,
  Ship,
  Container,
  Caravan,
  TreePine,
  Building2,
  ShoppingBag,
  PartyPopper,
  Gavel,
  Zap,
  MapPinned,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
 * R33 — PostJob category icon + hint metadata
 *
 * Mirrors the R32 ASAP CategoryChipGrid look for scheduled jobs. Each key
 * matches a backend `service_categories.key`; unknown keys silently fall
 * back to the Package icon + no hint (safe forward-compat).
 *
 * Extracted from PostJob.jsx in R48 with no behaviour change.
 * ──────────────────────────────────────────────────────────────────────── */
export const CATEGORY_META = {
  house_removals:      { icon: Home,        hint: "Full house move" },
  furniture_delivery:  { icon: Armchair,    hint: "Sofa / bed / etc." },
  single_items:        { icon: Package,     hint: "One large item" },
  parcels:             { icon: Package,     hint: "Small / single item" },
  documents:           { icon: FileText,    hint: "Envelopes / paperwork" },
  pallets:             { icon: Layers,      hint: "Palletised freight" },
  freight:             { icon: Truck,       hint: "Bulk / commercial" },
  motorcycles:         { icon: Bike,        hint: "Bikes / scooters" },
  cars_vehicles:       { icon: Car,         hint: "Non-runners OK" },
  vans:                { icon: Truck,       hint: "Van transport" },
  machinery_plant:     { icon: Cog,         hint: "Plant / equipment" },
  agricultural:        { icon: Sprout,      hint: "Farm machinery" },
  building_materials:  { icon: Hammer,      hint: "Timber / bricks / etc." },
  boats_marine:        { icon: Ship,        hint: "Boats / trailers" },
  shipping_containers: { icon: Container,   hint: "20ft / 40ft containers" },
  caravans:            { icon: Caravan,     hint: "Touring caravans" },
  static_caravans:     { icon: Home,        hint: "Static / mobile homes" },
  garden_outdoor:      { icon: TreePine,    hint: "Garden furniture / plants" },
  office_commercial:   { icon: Building2,   hint: "Office moves" },
  retail_business:     { icon: ShoppingBag, hint: "Stock / merchandise" },
  event_equipment:     { icon: PartyPopper, hint: "Event / marquee kit" },
  auction_marketplace: { icon: Gavel,       hint: "eBay / auction pickup" },
  same_day_express:    { icon: Zap,         hint: "Urgent delivery" },
  long_distance_uk:    { icon: MapPinned,   hint: "Nationwide moves" },
  fragile_high_value:  { icon: ShieldCheck, hint: "Delicate / insured" },
  other:               { icon: HelpCircle,  hint: "Describe below" },
};
