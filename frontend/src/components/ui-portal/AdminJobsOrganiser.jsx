import React from "react";

export const ATTENTION_STAGES = ["open_no_bids", "needs_quote", "issue"];
export const STAGE_TABS = [
  { key: "attention", label: "Needs attention", match: (j) => ATTENTION_STAGES.includes(j.stage) },
  { key: "open_no_bids", label: "Open · no bids", match: (j) => j.stage === "open_no_bids" },
  { key: "open_with_bids", label: "Open · has bids", match: (j) => j.stage === "open_with_bids" },
  { key: "in_progress", label: "In progress", match: (j) => j.stage === "in_progress" },
  { key: "completed", label: "Completed", match: (j) => j.stage === "completed" },
  { key: "cancelled", label: "Cancelled", match: (j) => j.stage === "cancelled" },
  { key: "all", label: "All", match: () => true },
];
export const BOOKING_TYPES = ["Bid Jobs", "Fixed Price Jobs", "ASAP Transport", "ASAP Recovery"];

export const ago = (iso) => {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (!iso || Number.isNaN(h)) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export const countBy = (list, keyFn) =>
  list.reduce((acc, j) => {
    const k = keyFn(j);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

export function ChipRow({ label, options, counts, selected, onToggle, testPrefix }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`${testPrefix}-chips`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#9CA3AF]">{label}</span>
      {options.map((o) => {
        const on = selected.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onToggle(o.key)}
            data-testid={`${testPrefix}-chip-${o.key}`}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
              on ? "bg-[#111111] text-white" : "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]"
            }`}
          >
            {o.label} <span className={on ? "text-white/70" : "text-[#9CA3AF]"}>{counts[o.key] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export function JobMetaLine({ job }) {
  const waitClass =
    job.stage === "open_no_bids" && job.waiting_hours > 24
      ? "bg-red-100 text-red-700"
      : job.stage === "open_no_bids" && job.waiting_hours > 2
        ? "bg-amber-100 text-amber-800"
        : null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6B7280]" data-testid={`admin-job-meta-${job.id}`}>
      <span className="rounded-full bg-[#F4F4F4] px-2 py-0.5 font-semibold text-[#111111]">{job.booking_type}</span>
      <span>· {job.bids_count ? `${job.bids_count} bid${job.bids_count === 1 ? "" : "s"}` : "No bids yet"}</span>
      <span>· Posted {ago(job.created_at)}</span>
      {job.collection_date ? <span>· Collect {String(job.collection_date).slice(0, 10)}</span> : null}
      {job.is_test ? <span className="rounded-full bg-[#F4F4F4] px-2 py-0.5 text-[10px] font-bold uppercase">Test</span> : null}
      {waitClass ? (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${waitClass}`} data-testid={`admin-job-waiting-${job.id}`}>
          Waiting · no bids
        </span>
      ) : null}
    </div>
  );
}

export function SummaryLine({ list }) {
  const towns = Object.entries(countBy(list, (j) => j.pickup_town || "—")).sort((a, b) => b[1] - a[1]);
  const parts = [
    `${list.length} jobs`,
    `${list.filter((j) => ATTENTION_STAGES.includes(j.stage)).length} need attention`,
    `${list.filter((j) => j.stage === "in_progress").length} in progress`,
    `${list.filter((j) => j.stage === "completed").length} completed`,
    towns[0] ? `${towns[0][0]} ${towns[0][1]}` : null,
    `ASAP ${list.filter((j) => j.service_timing === "asap").length}`,
  ].filter(Boolean);
  return (
    <p className="text-[12px] text-[#6B7280]" data-testid="admin-jobs-summary">
      {parts.join(" · ")}
    </p>
  );
}

export function exportJobsCsv(list) {
  const cols = ["created_at", "title", "booking_type", "stage", "status", "pickup_town", "dropoff_town", "bids_count", "price", "customer_name", "assigned_driver_name", "is_test"];
  const head = ["created", "title", "booking_type", "stage", "status", "pickup_town", "dropoff_town", "bids_count", "price", "customer", "driver", "test"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [head.join(","), ...list.map((j) => cols.map((c) => esc(j[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `cargoone-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
