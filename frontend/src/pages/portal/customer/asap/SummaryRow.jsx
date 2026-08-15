import React from "react";

/**
 * R46 — Small key/value row used by the Booking Summary card on the ASAP
 * wizard. `big` scales the total-price line; `strong` bolds intermediate
 * values without scaling them. Extracted from AsapRequest.jsx to keep the
 * parent focused on flow / state — no props changed.
 */
export function SummaryRow({ label, value, strong = false, big = false }) {
  return (
    <div
      className={`flex items-baseline justify-between ${big ? "py-2" : "py-1"} ${
        big ? "text-base" : "text-sm"
      }`}
    >
      <span className={big ? "font-semibold text-neutral-900" : "text-neutral-500"}>
        {label}
      </span>
      <span
        className={
          big
            ? "font-bold text-neutral-900 text-xl"
            : strong
            ? "font-semibold text-neutral-900"
            : "text-neutral-800 text-right ml-2 max-w-[60%] truncate"
        }
      >
        {value}
      </span>
    </div>
  );
}
