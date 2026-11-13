import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X as XIcon, Car, FileText, ChevronRight, Download } from "lucide-react";
import { api } from "@/lib/api";
import { VEHICLE_GROUPS, VEHICLE_LABEL } from "@/components/ui-portal/AdminVehicleTags";

// Display-only stages computed by GET /admin/drivers/overview (driver status in the DB is unchanged).
const STAGES = [
  { key: "no_documents", label: "No documents", hint: "0 uploaded", short: "No docs" },
  { key: "in_progress", label: "In progress", hint: "some uploaded", short: "In progress" },
  { key: "ready_to_review", label: "Ready to review", hint: "all uploaded", short: "Ready" },
  { key: "changes_requested", label: "Changes requested", short: "Changes" },
  { key: "approved", label: "Approved", short: "Approved" },
  { key: "suspended", label: "Suspended", short: "Suspended" },
  { key: "all", label: "All" },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
const VEHICLE_CHIPS = [...VEHICLE_GROUPS, { key: "not_set", label: "Not set" }];
const STATUS_PILL = {
  active: { bg: "#DCFCE7", fg: "#166534", label: "Active" },
  pending: { bg: "#FEF3C7", fg: "#92400E", label: "Pending" },
  changes_requested: { bg: "#FEE2E2", fg: "#991B1B", label: "Changes requested" },
  suspended: { bg: "#FEE2E2", fg: "#991B1B", label: "Suspended" },
};

const matchesVehicles = (d, sel) => sel.length === 0 || sel.some((k) => (k === "not_set" ? d.vehicles.length === 0 : d.vehicles.includes(k)));
const matchesSearch = (d, term) => !term || `${d.name || ""} ${d.email || ""} ${d.id || ""} ${d.town || ""} ${d.postcode_area || ""}`.toLowerCase().includes(term);
const joined = (iso) => {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: dt.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("ready_to_review");
  const [vehicles, setVehicles] = useState([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api("/admin/drivers/overview").catch(() => []);
      setDrivers(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const term = q.trim().toLowerCase();
  const base = useMemo(() => drivers.filter((d) => matchesSearch(d, term)), [drivers, term]);
  const forStages = useMemo(() => base.filter((d) => matchesVehicles(d, vehicles)), [base, vehicles]);
  const forVehicles = useMemo(() => (stage === "all" ? base : base.filter((d) => d.stage === stage)), [base, stage]);
  const filtered = useMemo(() => forVehicles.filter((d) => matchesVehicles(d, vehicles)), [forVehicles, vehicles]);

  const stageCounts = useMemo(() => countBy(forStages, (d) => [d.stage]), [forStages]);
  const vehicleCounts = useMemo(() => countBy(forVehicles, (d) => (d.vehicles.length ? d.vehicles : ["not_set"])), [forVehicles]);
  const toggleVehicle = (k) => setVehicles((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-drivers">
      <header className="flex items-start justify-between gap-3 px-4 pt-6 md:px-8">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">Drivers</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">{loading ? "Loading…" : `${filtered.length} shown · ${drivers.length} drivers in total`}</p>
        </div>
        <button type="button" onClick={() => exportCsv(filtered)} disabled={!filtered.length} data-testid="admin-drivers-export-csv" className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#F4F4F4] disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </header>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, ID, town or postcode area…"
          data-testid="admin-drivers-search"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear" data-testid="admin-drivers-search-clear">
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      <SummaryStrip list={filtered} q={q.trim()} />

      <div className="mx-4 mt-3 flex flex-wrap gap-2 md:mx-8" data-testid="driver-filter-row">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStage(s.key)}
            data-testid={`filter-drivers-${s.key}`}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${stage === s.key ? "bg-[#111111] text-white" : "bg-[#F4F4F4] text-[#111111]"}`}
          >
            {s.label}
            {s.hint ? <span className={`ml-1 text-[11px] font-normal ${stage === s.key ? "text-white/70" : "text-[#6B7280]"}`}>({s.hint})</span> : null}
            <span className="ml-1.5" data-testid={`filter-drivers-${s.key}-count`}>{s.key === "all" ? forStages.length : stageCounts[s.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="mx-4 mt-2 flex flex-wrap gap-1.5 md:mx-8" data-testid="driver-vehicle-row">
        {VEHICLE_CHIPS.map((v) => {
          const on = vehicles.includes(v.key);
          return (
            <button key={v.key} type="button" onClick={() => toggleVehicle(v.key)} aria-pressed={on} data-testid={`filter-vehicle-${v.key}`} className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${on ? "border-[#D62828] bg-[#FEF2F2] text-[#D62828]" : "border-[#E5E7EB] text-[#374151]"}`}>
              {v.label} <span className="text-[#9CA3AF]">{vehicleCounts[v.key] || 0}</span>
            </button>
          );
        })}
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-drivers-empty">
            <Car className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">{loading ? "Loading drivers…" : q || vehicles.length ? "No matching drivers." : `No drivers in "${STAGE_LABEL[stage]}".`}</p>
          </li>
        ) : (
          filtered.map((d) => <DriverCard key={d.id} d={d} />)
        )}
      </ul>
    </div>
  );
}

function countBy(list, keysOf) {
  const out = {};
  list.forEach((d) => keysOf(d).forEach((k) => { out[k] = (out[k] || 0) + 1; }));
  return out;
}

function SummaryStrip({ list, q }) {
  const s = countBy(list, (d) => [d.stage]);
  const v = countBy(list, (d) => (d.vehicles.length ? d.vehicles : ["not_set"]));
  const parts = [
    ...STAGES.filter((x) => x.key !== "all" && s[x.key]).map((x) => `${x.short} ${s[x.key]}`),
    ...VEHICLE_CHIPS.filter((x) => v[x.key]).map((x) => `${x.label} ${v[x.key]}`),
  ];
  return (
    <p className="mx-4 mt-3 truncate text-[12px] text-[#6B7280] md:mx-8" data-testid="admin-drivers-summary" title={parts.join(" · ")}>
      <span className="font-semibold text-[#111111]">{q ? `${q}: ` : ""}{list.length} {list.length === 1 ? "driver" : "drivers"}</span>
      {parts.length ? ` · ${parts.join(" · ")}` : ""}
    </p>
  );
}

function DriverCard({ d }) {
  const meta = STATUS_PILL[d.status] || { bg: "#F4F4F4", fg: "#111111", label: d.status };
  const needsReview = d.status === "pending" || d.status === "changes_requested";
  const docs = d.docs || { approved: 0, uploaded: 0, required: 0, missing: [] };
  const place = [d.town, d.postcode_area].filter(Boolean).join(" · ");
  return (
    <li className="rounded-[12px] border border-[#E5E7EB] p-4" data-testid={`admin-driver-${d.id}`}>
      <Link to={`/admin/driver/${d.id}`} className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D62828] text-[16px] font-bold text-white">
          {(d.name || "?")[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[#111111]">{d.name}</p>
          <p className="truncate text-[12px] text-[#6B7280]">{d.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6B7280]">
            <span>
              {d.total_jobs || 0} jobs · {Number(d.rating || 5).toFixed(1)}★
            </span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]" style={{ backgroundColor: meta.bg, color: meta.fg }}>
              {meta.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B7280]" data-testid={`admin-driver-info-${d.id}`}>
            <span className="font-semibold">Docs {docs.approved}/{docs.required}</span>
            <span className="rounded-full bg-[#F4F4F4] px-1.5 py-0.5">{docs.uploaded} uploaded</span>
            {docs.missing.length ? <span className="rounded-full bg-[#F4F4F4] px-1.5 py-0.5">{docs.missing.length} missing</span> : null}
            {d.vehicles.map((v) => <span key={v} className="rounded-full bg-[#F4F4F4] px-1.5 py-0.5 text-[#374151]">{VEHICLE_LABEL[v] || v}</span>)}
            {place ? <span>· {place}</span> : null}
            {d.created_at ? <span>· Joined {joined(d.created_at)}</span> : null}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
      </Link>
      <Link
        to={`/admin/driver/${d.id}`}
        data-testid={`review-driver-${d.id}`}
        className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold ${
          needsReview ? "bg-[#D62828] text-white hover:bg-[#B01F1F]" : "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]"
        }`}
      >
        <FileText className="h-4 w-4" />
        {needsReview ? "Review application" : "View details"}
      </Link>
    </li>
  );
}

function exportCsv(list) {
  const cols = ["name", "email", "phone", "town", "postcode_area", "stage", "docs_approved", "docs_uploaded", "docs_required", "vehicles", "joined"];
  const esc = (v) => {
    const s = String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(s) && !/^\+?[\d ()-]+$/.test(s) ? `'${s}` : s; // stop spreadsheet formula injection (phone numbers left as-is)
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = list.map((d) => [
    d.name, d.email, d.phone, d.town, d.postcode_area, STAGE_LABEL[d.stage] || d.stage, d.docs?.approved, d.docs?.uploaded, d.docs?.required,
    d.vehicles.map((v) => VEHICLE_LABEL[v] || v).join("; "), (d.created_at || "").slice(0, 10),
  ]);
  const csv = "\uFEFF" + [cols, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `cargoone-drivers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
