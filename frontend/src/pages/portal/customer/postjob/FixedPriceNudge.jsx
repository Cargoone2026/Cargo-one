import React from "react";
import { AlertTriangle, Info } from "lucide-react";

/**
 * R45 — Friendly inline nudge shown under the "Driver charge / Max budget"
 * field on the customer PostJob wizard. Compares the customer's typed
 * price against the engine's `suggested_price` and warns when it's far
 * below market — drivers filter out low-ball jobs, so the customer just
 * won't get accepted quickly. Silent when the price is fair (≥85% of the
 * suggestion) or when the suggestion / customer input is missing.
 *
 * Three tiers of feedback, in ascending severity:
 *   • ≥100% of suggestion  → nothing (fair or generous).
 *   • 85–99% of suggestion → nothing (within a normal market spread).
 *   • 60–84% of suggestion → soft warning ("this may take longer to fill").
 *   • <60% of suggestion   → strong warning ("this is well below UK market
 *                            rate — most drivers will skip it").
 *
 * Extracted from PostJob.jsx in R48 with no behaviour change.
 */
export function FixedPriceNudge({ pricingType, value, suggested }) {
  const numeric = Number(value);
  if (!suggested || !Number.isFinite(numeric) || numeric <= 0) return null;
  const ratio = numeric / Number(suggested);
  if (ratio >= 0.85) return null;

  const strong = ratio < 0.6;
  const shortfall = Math.max(0, Number(suggested) - numeric);
  const suggestedFmt = `£${Number(suggested).toFixed(0)}`;
  const shortfallFmt = `£${shortfall.toFixed(0)}`;

  const wrapperClass = strong
    ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
    : "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]";
  const Icon = strong ? AlertTriangle : Info;

  const priceWord = pricingType === "fixed" ? "fixed price" : "max budget";
  const headline = strong
    ? `Well below the UK market rate for this job (${suggestedFmt}).`
    : `Below the typical UK market rate for this job (${suggestedFmt}).`;

  const advice = strong
    ? `Most drivers filter out low-priced jobs. Consider raising your ${priceWord} by about ${shortfallFmt} to attract offers within the hour.`
    : `Adding roughly ${shortfallFmt} to your ${priceWord} would put you in the sweet spot and typically halves the wait time.`;

  return (
    <div
      className={`mt-2 flex items-start gap-2 rounded-[10px] border p-3 ${wrapperClass}`}
      role="status"
      aria-live="polite"
      data-testid="postjob-fixed-price-nudge"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-[12px] leading-[1.5]">
        <p className="font-semibold" data-testid="postjob-fixed-price-nudge-headline">
          {headline}
        </p>
        <p className="mt-0.5">{advice}</p>
      </div>
    </div>
  );
}
