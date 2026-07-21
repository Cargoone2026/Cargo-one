import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X as XIcon, Car, FileText, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "changes_requested", label: "Changes requested" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "all", label: "All" },
];
const STATUS_PILL = {
  active: { bg: "#DCFCE7", fg: "#166534", label: "Active" },
  pending: { bg: "#FEF3C7", fg: "#92400E", label: "Pending" },
  changes_requested: { bg: "#FEE2E2", fg: "#991B1B", label: "Changes requested" },
  suspended: { bg: "#FEE2E2", fg: "#991B1B", label: "Suspended" },
};

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api("/admin/users?role=driver").catch(() => []);
      setDrivers(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? drivers : drivers.filter((d) => d.status === filter);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((d) =>
        `${d.name || ""} ${d.email || ""} ${d.id || ""}`.toLowerCase().includes(term),
      );
    }
    return list;
  }, [drivers, filter, q]);

  const pendingCount = drivers.filter((d) => d.status === "pending").length;
  const changesCount = drivers.filter((d) => d.status === "changes_requested").length;

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-drivers">
      <header className="px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">Drivers</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {filtered.length} shown · {pendingCount} pending review
          {changesCount > 0 ? ` · ${changesCount} awaiting driver` : ""}
        </p>
      </header>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or ID…"
          data-testid="admin-drivers-search"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear" data-testid="admin-drivers-search-clear">
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      <div className="mx-4 mt-3 flex flex-wrap gap-2 md:mx-8" data-testid="driver-filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            data-testid={`filter-drivers-${f.key}`}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              filter === f.key ? "bg-[#111111] text-white" : "bg-[#F4F4F4] text-[#111111]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-drivers-empty">
            <Car className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">
              {q ? "No matching drivers." : `No drivers with status "${filter}".`}
            </p>
          </li>
        ) : (
          filtered.map((d) => {
            const meta = STATUS_PILL[d.status] || { bg: "#F4F4F4", fg: "#111111", label: d.status };
            const needsReview = d.status === "pending" || d.status === "changes_requested";
            return (
              <li
                key={d.id}
                className="rounded-[12px] border border-[#E5E7EB] p-4"
                data-testid={`admin-driver-${d.id}`}
              >
                <Link
                  to={`/admin/driver/${d.id}`}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D62828] text-[16px] font-bold text-white">
                    {(d.name || "?")[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[#111111]">
                      {d.name}
                    </p>
                    <p className="truncate text-[12px] text-[#6B7280]">{d.email}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6B7280]">
                      <span>
                        {d.total_jobs || 0} jobs · {Number(d.rating || 5).toFixed(1)}★
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]"
                        style={{ backgroundColor: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
                </Link>
                <Link
                  to={`/admin/driver/${d.id}`}
                  data-testid={`review-driver-${d.id}`}
                  className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold ${
                    needsReview
                      ? "bg-[#D62828] text-white hover:bg-[#B01F1F]"
                      : "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  {needsReview ? "Review application" : "View details"}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
