import React from "react";
import {
  KeyRound,
  AlertTriangle,
  Disc,
  Wrench,
  BatteryLow,
  Ban,
  HelpCircle,
  Check,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
 * R31 — Recovery condition + Rolls/Steers/Brakes chip grids
 *
 * Turns the two dropdowns in the recovery info form (`Condition`, and the
 * Rolls/Steers/Brakes yes-no-unknown triplet) into tap-friendly card /
 * chip grids so recovery mode matches the visual language of the vehicle
 * picker. Same a11y radiogroup pattern; same testid conventions.
 * Extracted from AsapRequest.jsx in R46 with no behaviour change.
 * ──────────────────────────────────────────────────────────────────────── */

export const CONDITION_OPTIONS = [
  { value: "will_not_start",     label: "Won't start",       icon: KeyRound,       hint: "Engine won't crank" },
  { value: "accident_damaged",   label: "Accident damage",   icon: AlertTriangle,  hint: "Impact / crash" },
  { value: "flat_tyre",          label: "Flat tyre",         icon: Disc,           hint: "Puncture / blow-out" },
  { value: "mechanical_failure", label: "Mechanical failure", icon: Wrench,        hint: "Engine / gearbox / drive" },
  { value: "battery_issue",      label: "Battery issue",     icon: BatteryLow,     hint: "Flat / faulty battery" },
  { value: "cannot_be_driven",   label: "Cannot be driven",  icon: Ban,            hint: "Immobile / unsafe" },
  { value: "other",              label: "Other",             icon: HelpCircle,     hint: "Describe in the note" },
];

export function ConditionCardGrid({ selected, onSelect }) {
  return (
    <div
      className="grid grid-cols-2 gap-2"
      role="radiogroup"
      aria-label="Vehicle condition"
      data-testid="asap-vehicle-condition"
    >
      {CONDITION_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isSel = selected === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={isSel}
            onClick={() => onSelect(opt.value)}
            data-testid={`asap-vehicle-condition-${opt.value}`}
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

export const YESNO_OPTIONS = [
  { value: "yes",     label: "Yes"     },
  { value: "no",      label: "No"      },
  { value: "unknown", label: "Unknown" },
];

export function YesNoChipRow({ name, value, onChange }) {
  return (
    <div
      className="grid grid-cols-3 gap-1.5"
      role="radiogroup"
      aria-label={name}
      data-testid={`asap-vehicle-${name}`}
    >
      {YESNO_OPTIONS.map((opt) => {
        const isSel = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={isSel}
            onClick={() => onChange(opt.value)}
            data-testid={`asap-vehicle-${name}-${opt.value}`}
            className={[
              "rounded-lg border px-2 py-1.5 text-center text-[12px] font-medium transition",
              isSel
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
