import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X as XIcon, MapPin, Package } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api("/admin/jobs").catch(() => []);
      setJobs(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return jobs;
    return jobs.filter((j) =>
      `${j.title || ""} ${j.pickup_town || ""} ${j.dropoff_town || ""} ${j.category || ""} ${j.customer_name || ""} ${j.status || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [jobs, q]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-jobs">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">All Jobs</h1>
        <span className="text-[13px] text-[#6B7280]">
          {filtered.length} of {jobs.length}
        </span>
      </header>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, route, category, customer…"
          data-testid="admin-jobs-search"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} data-testid="admin-jobs-search-clear" aria-label="Clear">
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {loading && jobs.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading jobs…</li>
        ) : filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-jobs-empty">
            <Package className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">
              {q ? "No matching jobs." : "No jobs posted yet."}
            </p>
          </li>
        ) : (
          filtered.map((j) => (
            <li
              key={j.id}
              className="rounded-[12px] border border-[#E5E7EB] p-4"
              data-testid={`admin-job-${j.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold text-[#111111]">{j.title}</p>
                  <p className="text-[12px] capitalize text-[#6B7280]">
                    {(j.category || "").replace(/_/g, " ")} · {j.pricing_type}
                  </p>
                </div>
                <StatusPill status={j.status} />
              </div>
              <div className="mt-2 flex items-center gap-1 text-[14px] text-[#6B7280]">
                <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                <span className="truncate">
                  {j.pickup_town} → {j.dropoff_town}
                </span>
                <span className="ml-auto text-[12px] font-semibold">
                  {j.distance_miles} mi
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F4F6] pt-2">
                <span className="text-[13px] text-[#6B7280]">
                  By {j.customer_name || "—"}
                </span>
                <span className="text-[18px] font-bold text-[#111111]">
                  £{j.pricing_type === "fixed"
                    ? j.fixed_price
                    : j.accepted_price || j.suggested_price}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
