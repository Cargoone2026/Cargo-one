import React from "react";
import { Truck, Car, Package, Sparkles, Check } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
 * R29 — Vehicle Card Grid picker (extracted in R46)
 *
 * Replaces the plain `<select>` dropdown with a scannable 2-column card grid
 * of transport vehicles. Each card shows an icon, label, indicative payload
 * & internal dimensions, tail-lift badge, and price hint (min £ · £/mi).
 *
 * `VEHICLE_SPECS` is a client-side display-only metadata map — the backend
 * pricing engine remains the single source of truth for actual charges.
 * ──────────────────────────────────────────────────────────────────────── */

// Static per-vehicle display metadata. Payload / dims are indicative — the
// dispatcher and driver confirm the actual load fits. Numbers align to
// standard UK commercial vehicle specs; not to be interpreted as SLA.
export const VEHICLE_SPECS = {
  car:                    { icon: Car,     payload: "≤ 150 kg",  dims: "boot space" },
  small_van:              { icon: Package, payload: "≤ 500 kg",  dims: "1.8 × 1.2 × 1.1 m" },
  lwb_van:                { icon: Truck,   payload: "≤ 1000 kg", dims: "3.2 × 1.8 × 1.9 m" },
  elwb_van:               { icon: Truck,   payload: "≤ 1200 kg", dims: "4.0 × 1.8 × 2.1 m" },
  pickup:                 { icon: Truck,   payload: "≤ 1000 kg", dims: "open bed" },
  luton:                  { icon: Truck,   payload: "≤ 1000 kg", dims: "4.0 × 2.0 × 2.2 m" },
  luton_tail_lift:        { icon: Truck,   payload: "≤ 1000 kg", dims: "4.0 × 2.0 × 2.2 m + tail lift" },
  "3_5t_rigid":           { icon: Truck,   payload: "≤ 1200 kg", dims: "4.3 × 2.0 × 2.2 m" },
  "3_5t_rigid_tail_lift": { icon: Truck,   payload: "≤ 1200 kg", dims: "4.3 × 2.0 × 2.2 m + tail lift" },
  "5t_rigid":             { icon: Truck,   payload: "≤ 2500 kg", dims: "5.0 × 2.2 × 2.3 m" },
  "7_5t_rigid":           { icon: Truck,   payload: "≤ 3500 kg", dims: "6.0 × 2.4 × 2.4 m" },
  "7_5t_rigid_tail_lift": { icon: Truck,   payload: "≤ 3500 kg", dims: "6.0 × 2.4 × 2.4 m + tail lift" },
  "10_18t_rigid":         { icon: Truck,   payload: "≤ 10 t",    dims: "7.5 × 2.4 × 2.6 m" },
  "26t_rigid":            { icon: Truck,   payload: "≤ 16 t",    dims: "9.0 × 2.5 × 2.7 m" },
  "32t_rigid":            { icon: Truck,   payload: "≤ 20 t",    dims: "9.0 × 2.5 × 2.7 m" },
  multi_axle_rigid:       { icon: Truck,   payload: "≤ 26 t",    dims: "extra axle for weight/stability" },
  tractor_unit:           { icon: Truck,   payload: "trailer-fed", dims: "hitch only — needs trailer" },
  semi_trailer:           { icon: Truck,   payload: "≤ 26 t",    dims: "13.6 × 2.5 × 2.7 m" },
  articulated_hgv:        { icon: Truck,   payload: "≤ 26 t",    dims: "13.6 × 2.5 × 2.7 m (44 t GVW)" },
  heavy_haul_combo:       { icon: Truck,   payload: "abnormal",  dims: "STGO / escort · manual review" },
  // ── Recovery vehicles (R30) — payload here = max recoverable vehicle
  //    weight; dims = distinguishing recovery equipment.
  light_recovery_van:          { icon: Truck, payload: "cars ≤ 1.5 t",        dims: "spec lift / dolly" },
  pickup_recovery:             { icon: Truck, payload: "cars ≤ 1.5 t",        dims: "flat-bed pickup" },
  "3_5t_recovery":             { icon: Truck, payload: "cars ≤ 3.5 t",        dims: "3.5T flat-bed / spec lift" },
  "5_7_5t_recovery":           { icon: Truck, payload: "vans ≤ 5–7.5 t",      dims: "5–7.5T flat-bed" },
  "10_18t_recovery":           { icon: Truck, payload: "vans / LGV ≤ 10–18 t", dims: "large flat-bed" },
  "26t_recovery":              { icon: Truck, payload: "HGV ≤ 26 t",           dims: "heavy flat-bed" },
  "32t_recovery":              { icon: Truck, payload: "HGV ≤ 32 t",           dims: "heavy underlift + jib" },
  heavy_recovery:              { icon: Truck, payload: "HGV ≤ 40 t",           dims: "heavy underlift + jib" },
  heavy_6x4_8x4_recovery:      { icon: Truck, payload: "HGV ≤ 44 t",           dims: "6×4 / 8×4 · winch capable" },
  heavy_tractor_recovery:      { icon: Truck, payload: "artic tractor units",  dims: "5th-wheel underlift" },
  heavy_articulated_recovery:  { icon: Truck, payload: "full artic ≤ 44 t",    dims: "artic + trailer combo" },
  stgo_heavy_recovery:         { icon: Truck, payload: "abnormal / STGO",      dims: "escort · manual review" },
};

// Fallback lists used only when /asap/vehicles hasn't responded yet.
export const TRANSPORT_FALLBACK = [
  { key: "car",                    label: "Car" },
  { key: "small_van",              label: "Small Van" },
  { key: "lwb_van",                label: "LWB Van" },
  { key: "elwb_van",               label: "ELWB Van" },
  { key: "pickup",                 label: "Pickup" },
  { key: "luton",                  label: "Luton" },
  { key: "luton_tail_lift",        label: "Luton Tail Lift" },
  { key: "3_5t_rigid",             label: "3.5T Rigid" },
  { key: "3_5t_rigid_tail_lift",   label: "3.5T Rigid Tail Lift" },
  { key: "5t_rigid",               label: "5T Rigid" },
  { key: "7_5t_rigid",             label: "7.5T Rigid" },
  { key: "7_5t_rigid_tail_lift",   label: "7.5T Rigid Tail Lift" },
  { key: "10_18t_rigid",           label: "10–18T Rigid" },
  { key: "26t_rigid",              label: "26T Rigid" },
  { key: "32t_rigid",              label: "32T Rigid" },
  { key: "multi_axle_rigid",       label: "Other Multi-Axle Rigid" },
  { key: "tractor_unit",           label: "Tractor Unit" },
  { key: "semi_trailer",           label: "Semi-Trailer" },
  { key: "articulated_hgv",        label: "Articulated HGV" },
  { key: "heavy_haul_combo",       label: "Heavy-Haul Combination" },
];

export const RECOVERY_FALLBACK = [
  { key: "light_recovery_van",         label: "Light Recovery Van" },
  { key: "pickup_recovery",            label: "Pickup Recovery" },
  { key: "3_5t_recovery",              label: "3.5T Recovery" },
  { key: "5_7_5t_recovery",            label: "5–7.5T Recovery" },
  { key: "10_18t_recovery",            label: "10–18T Recovery" },
  { key: "26t_recovery",               label: "26T Recovery" },
  { key: "32t_recovery",               label: "32T Recovery" },
  { key: "heavy_recovery",             label: "Heavy Recovery" },
  { key: "heavy_6x4_8x4_recovery",     label: "Heavy 6×4 / 8×4 Recovery" },
  { key: "heavy_tractor_recovery",     label: "Heavy Tractor Recovery" },
  { key: "heavy_articulated_recovery", label: "Heavy Articulated Recovery" },
  { key: "stgo_heavy_recovery",        label: "STGO Heavy Recovery Combination" },
];

export function VehicleCardGrid({
  selectedKey,
  onSelect,
  vehicles,
  fallback = TRANSPORT_FALLBACK,
}) {
  const list = vehicles && vehicles.length ? vehicles : fallback;
  return (
    <div
      className="grid grid-cols-2 gap-2"
      role="radiogroup"
      aria-label="Vehicle class"
      data-testid="asap-vehicle-grid"
    >
      {/* Recommend-for-me card — always first, always available. */}
      <VehicleCard
        selected={!selectedKey}
        onClick={() => onSelect("")}
        icon={Sparkles}
        label="Recommend for me"
        payload="Based on your load"
        dims="We'll pick the smallest fit"
        highlight
        testKey="__recommend"
      />
      {list.map((v) => {
        const spec = VEHICLE_SPECS[v.key] || {};
        const Icon = spec.icon || Truck;
        return (
          <VehicleCard
            key={v.key}
            selected={selectedKey === v.key}
            onClick={() => onSelect(v.key)}
            icon={Icon}
            label={v.label}
            payload={spec.payload || ""}
            dims={spec.dims || ""}
            tailLift={v.tail_lift || (typeof v.key === "string" && v.key.endsWith("_tail_lift"))}
            manualReview={v.requires_manual_review}
            priceHint={
              v.minimum_charge != null && v.per_mile != null
                ? `from £${Number(v.minimum_charge).toFixed(0)} · £${Number(v.per_mile).toFixed(2)}/mi`
                : null
            }
            testKey={v.key}
          />
        );
      })}
    </div>
  );
}

function VehicleCard({
  selected,
  onClick,
  icon: Icon,
  label,
  payload,
  dims,
  tailLift = false,
  manualReview = false,
  priceHint = null,
  highlight = false,
  testKey,
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={`asap-vehicle-card-${testKey}`}
      className={[
        "group relative flex flex-col items-start rounded-2xl border p-3 text-left transition",
        selected
          ? "border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900"
          : "border-neutral-200 bg-white hover:border-neutral-300",
        highlight && !selected ? "bg-amber-50 border-amber-200" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {selected ? (
        <span
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white"
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
      ) : null}
      <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[13px] font-semibold leading-tight text-neutral-900">{label}</div>
      {payload ? (
        <div className="mt-0.5 text-[11px] font-medium text-neutral-700">{payload}</div>
      ) : null}
      {dims ? <div className="text-[11px] leading-tight text-neutral-500">{dims}</div> : null}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {tailLift ? (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            Tail lift
          </span>
        ) : null}
        {manualReview ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            Manual review
          </span>
        ) : null}
      </div>
      {priceHint ? (
        <div className="mt-1 text-[10px] font-medium text-neutral-500">{priceHint}</div>
      ) : null}
    </button>
  );
}
