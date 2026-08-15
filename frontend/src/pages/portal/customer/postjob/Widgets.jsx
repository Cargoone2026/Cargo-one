import React from "react";

/** R48 — Small stat card used on step 4 quote preview. */
export function QuoteStat({ Icon, label, value }) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-3 text-center">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#F4F4F4]">
        <Icon className="h-4 w-4 text-[#111111]" />
      </div>
      <p className="text-[14px] font-bold text-[#111111]">{value}</p>
      <p className="text-[11px] text-[#6B7280]">{label}</p>
    </div>
  );
}

/** R48 — Full-row toggle with pill switch. */
export function Toggle({ label, value, onChange, testID }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      data-testid={testID}
      className={`flex w-full items-center justify-between gap-3 rounded-[12px] border px-3 py-3 text-left transition-colors ${
        value ? "border-[#111111] bg-[#111111]" : "border-[#E5E7EB] bg-white"
      }`}
    >
      <span
        className={`text-[13px] font-medium ${value ? "text-white" : "text-[#111111]"}`}
      >
        {label}
      </span>
      <span
        className={`inline-flex h-6 w-10 items-center rounded-full p-0.5 ${
          value ? "bg-[#D62828]" : "bg-[#E5E7EB]"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

/** R48 — Vehicle card on the step-4 picker. */
export function VehicleCard({ active, onPress, name, description, Icon, highlight, testID }) {
  return (
    <button
      type="button"
      onClick={onPress}
      data-testid={testID}
      className={`flex w-full items-start gap-3 rounded-[12px] border p-3 text-left transition-colors ${
        active
          ? "border-[#D62828] bg-white shadow-sm"
          : highlight
          ? "border-dashed border-[#D62828] bg-[#FFF7ED] hover:bg-white"
          : "border-[#E5E7EB] bg-white hover:border-[#111111]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
          active ? "bg-[#D62828] text-white" : "bg-[#F4F4F4] text-[#D62828]"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={`block text-[14px] font-semibold ${
            active ? "text-[#D62828]" : "text-[#111111]"
          }`}
        >
          {name}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[12px] text-[#6B7280]">
          {description}
        </span>
      </span>
    </button>
  );
}

/** R48 — Fixed/Bidding pricing-type tab. */
export function PriceTab({ active, onClick, Icon, label, testID }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold transition-colors ${
        active ? "bg-[#111111] text-white" : "text-[#6B7280] hover:text-[#111111]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/** R48 — Booking Summary key/value row. `big` scales the total; `emphasise` bolds intermediate values. */
export function SummaryRow({ label, value, emphasise, big, testID }) {
  return (
    <div className="flex items-center justify-between py-1" data-testid={testID}>
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span
        className={`text-right ${
          big
            ? "text-[20px] font-bold text-[#D62828]"
            : emphasise
            ? "text-[15px] font-bold text-[#111111]"
            : "text-[14px] text-[#111111]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
