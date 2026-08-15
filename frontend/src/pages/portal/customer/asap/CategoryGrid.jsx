import React from "react";
import {
  Package,
  FileText,
  Heart,
  Layers,
  Armchair,
  Cog,
  Boxes,
  ShoppingBag,
  Zap,
  HelpCircle,
  Check,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
 * R32 — Transport Category chip grid
 *
 * Replaces the plain `<select>` for the transport-mode "What are you
 * sending?" category picker. Matches the R29–R31 chip / card aesthetic.
 * Extracted from AsapRequest.jsx in R46 with no behaviour change.
 * ──────────────────────────────────────────────────────────────────────── */
export const CATEGORY_OPTIONS = [
  { value: "parcel",           label: "Parcel",           icon: Package,     hint: "Small / single item" },
  { value: "documents",        label: "Documents",        icon: FileText,    hint: "Envelopes / paperwork" },
  { value: "medical_supplies", label: "Medical supplies", icon: Heart,       hint: "Time-critical" },
  { value: "pallets",          label: "Pallets",          icon: Layers,      hint: "Palletised freight" },
  { value: "furniture",        label: "Furniture",        icon: Armchair,    hint: "Sofa / bed / etc." },
  { value: "machinery",        label: "Machinery",        icon: Cog,         hint: "Plant / equipment" },
  { value: "boxes",            label: "Boxes",            icon: Boxes,       hint: "Multiple boxes / cartons" },
  { value: "retail_goods",     label: "Retail goods",     icon: ShoppingBag, hint: "Stock / merchandise" },
  { value: "electrical_items", label: "Electrical items", icon: Zap,         hint: "Appliances / electronics" },
  { value: "other",            label: "Other",            icon: HelpCircle,  hint: "Describe below" },
];

export function CategoryChipGrid({ selected, onSelect }) {
  return (
    <div
      className="grid grid-cols-2 gap-2"
      role="radiogroup"
      aria-label="Transport category"
      data-testid="asap-transport-category"
    >
      {CATEGORY_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isSel = selected === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={isSel}
            onClick={() => onSelect(opt.value)}
            data-testid={`asap-transport-category-${opt.value}`}
            className={[
              "relative flex items-start gap-2 rounded-xl border p-2 text-left transition",
              isSel
                ? "border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900"
                : "border-neutral-200 bg-white hover:border-neutral-300",
            ].join(" ")}
          >
            {isSel ? (
              <span
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-white"
                aria-hidden="true"
              >
                <Check className="h-2.5 w-2.5" />
              </span>
            ) : null}
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold leading-tight text-neutral-900">
                {opt.label}
              </div>
              <div className="text-[10px] leading-tight text-neutral-500">{opt.hint}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
