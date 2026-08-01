/**
 * JobExtras — one place that renders every optional customer selection
 * on a booking / job.
 *
 * Historically these flags (forklift, loading assistance, vehicle
 * condition, item weight/count, customer note) were stored on the job
 * document but never rendered anywhere in the UI. This component is the
 * canonical way to surface them so customers, drivers and admins all
 * see the same information throughout the booking lifecycle.
 *
 * Props:
 *   job — any job or booking's `job` sub-object. May be null / undefined
 *         while a page is loading, in which case we render nothing.
 *   dense — when true (used inside compact cards) drops the outer border
 *           and reduces spacing.
 */
import React from "react";
import {
  Info, Package, Scale, Ruler, Truck, Wrench, HandHelping,
  StickyNote, AlertTriangle, Car,
} from "lucide-react";

function Chip({ icon: Icon, label, tone = "neutral", testid }) {
  const styles = {
    neutral: "bg-neutral-100 text-neutral-800 border-neutral-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    red: "bg-red-50 text-red-800 border-red-200",
  }[tone];
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${styles}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

export function JobExtras({ job, dense = false }) {
  if (!job || typeof job !== "object") return null;

  const chips = [];
  if (job.needs_forklift) {
    chips.push({ key: "forklift", icon: Wrench, tone: "amber",
      label: "Forklift / loading equipment required",
      testid: "jobextras-forklift" });
  }
  if (job.needs_loading_help) {
    chips.push({ key: "loading", icon: HandHelping, tone: "amber",
      label: "Loading assistance (tail lift / extra hands)",
      testid: "jobextras-loading" });
  }
  if (job.weight_kg) {
    chips.push({ key: "weight", icon: Scale, tone: "neutral",
      label: `${job.weight_kg} kg`, testid: "jobextras-weight" });
  }
  if (job.item_count) {
    chips.push({ key: "items", icon: Package, tone: "neutral",
      label: `${job.item_count} item${job.item_count > 1 ? "s" : ""}`,
      testid: "jobextras-items" });
  }
  const dims = [job.dimensions_l_m, job.dimensions_w_m, job.dimensions_h_m].filter(Boolean);
  if (dims.length) {
    chips.push({ key: "dims", icon: Ruler, tone: "neutral",
      label: `${dims.map((d) => `${d}m`).join(" × ")} L·W·H`,
      testid: "jobextras-dims" });
  }
  if (job.recommended_vehicle || job.vehicle_label) {
    chips.push({ key: "vehicle", icon: Truck, tone: "neutral",
      label: job.recommended_vehicle || job.vehicle_label,
      testid: "jobextras-vehicle" });
  }

  // Recovery-specific vehicle information (make/model/condition/rolls/steers/brakes)
  const v = job.vehicle_details;
  const vehicleBits = [];
  if (v && typeof v === "object") {
    if (v.make || v.model) {
      vehicleBits.push([`${v.make || ""} ${v.model || ""}`.trim(),
        v.registration ? `· ${v.registration}` : ""].filter(Boolean).join(" "));
    }
    if (v.condition && v.condition !== "unknown") {
      vehicleBits.push(String(v.condition).replace(/_/g, " "));
    }
    ["rolls", "steers", "brakes"].forEach((k) => {
      if (v[k] && v[k] !== "unknown") vehicleBits.push(`${k}: ${v[k]}`);
    });
  }

  const note = (job.customer_note || "").trim();

  if (chips.length === 0 && vehicleBits.length === 0 && !note) return null;

  const wrapperCls = dense
    ? "space-y-2"
    : "rounded-2xl border border-neutral-200 bg-white p-4 space-y-3";

  return (
    <div className={wrapperCls} data-testid="job-extras">
      {!dense && (
        <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-800">
          <Info className="h-4 w-4 text-neutral-500" />
          Booking details
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c.key} icon={c.icon} label={c.label} tone={c.tone} testid={c.testid} />
          ))}
        </div>
      )}

      {vehicleBits.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900" data-testid="jobextras-recovery">
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <Car className="h-4 w-4" /> Vehicle recovery details
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {vehicleBits.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {note && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[13px] text-neutral-800" data-testid="jobextras-note">
          <div className="mb-1 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-neutral-600">
            <StickyNote className="h-3.5 w-3.5" /> Customer note
          </div>
          <p className="whitespace-pre-wrap break-words">{note}</p>
        </div>
      )}
    </div>
  );
}

export default JobExtras;
