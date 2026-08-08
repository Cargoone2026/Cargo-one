import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X as XIcon, MapPin, Package, User, Truck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { JobExtras } from "@/components/ui-portal/JobExtras";

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);

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
            <li key={j.id} data-testid={`admin-job-${j.id}`}>
              <button
                type="button"
                onClick={() => setOpenId(j.id)}
                data-testid={`admin-job-open-${j.id}`}
                className="block w-full rounded-[12px] border border-[#E5E7EB] p-4 text-left transition-colors hover:border-[#111111]"
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
              </button>
            </li>
          ))
        )}
      </ul>

      {openId ? (
        <JobDetailModal jobId={openId} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function JobDetailModal({ jobId, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api(`/admin/jobs/${jobId}`);
        if (alive) setData(d);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load");
      }
    })();
    return () => { alive = false; };
  }, [jobId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-10"
      onClick={onClose}
      data-testid="admin-job-modal"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-[16px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-3">
          <h3 className="text-[16px] font-semibold text-[#111111]">Job details</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="admin-job-modal-close"
            className="rounded-full p-1 hover:bg-[#F4F4F4]"
          >
            <XIcon className="h-4 w-4 text-[#6B7280]" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 text-[14px]">
          {err ? (
            <p className="text-[13px] text-[#DC2626]">{err}</p>
          ) : !data ? (
            <p className="text-[13px] text-[#6B7280]">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[18px] font-bold text-[#111111]">{data.job.title}</p>
                  <StatusPill status={data.job.status} />
                </div>
                <p className="mt-1 text-[12px] capitalize text-[#6B7280]">
                  {(data.job.category || "").replace(/_/g, " ")} · {data.job.pricing_type} · {data.job.service_timing || "scheduled"}
                </p>
                <p className="mt-2 flex items-center gap-1 text-[13px] text-[#6B7280]">
                  <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                  {data.job.pickup_address || data.job.pickup_town} → {data.job.dropoff_address || data.job.dropoff_town}
                </p>
                <p className="mt-2 text-[13px]">
                  <span className="text-[#6B7280]">Price:</span>{" "}
                  <span className="font-semibold">
                    £{data.job.pricing_type === "fixed"
                      ? data.job.fixed_price
                      : data.job.accepted_price || data.job.suggested_price || "—"}
                  </span>{" "}
                  · <span className="text-[#6B7280]">{data.job.distance_miles} mi</span>
                </p>
              </div>

              <JobExtras job={data.job} />

              {data.customer ? (
                <div className="rounded-[10px] border border-[#E5E7EB] p-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                    Customer
                  </p>
                  <p className="flex items-center gap-2 text-[14px] font-semibold text-[#111111]">
                    <User className="h-4 w-4 text-[#6B7280]" />
                    {data.customer.name}
                  </p>
                  <p className="text-[12px] text-[#6B7280]">
                    {data.customer.email} {data.customer.phone ? `· ${data.customer.phone}` : ""}
                  </p>
                </div>
              ) : null}

              {data.driver ? (
                <div className="rounded-[10px] border border-[#E5E7EB] p-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                    Assigned driver
                  </p>
                  <p className="flex items-center gap-2 text-[14px] font-semibold text-[#111111]">
                    <Truck className="h-4 w-4 text-[#6B7280]" />
                    {data.driver.name}
                    <Link
                      to={`/admin/driver/${data.driver.id}`}
                      data-testid="admin-job-modal-driver-link"
                      className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[#D62828] hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                  </p>
                  <p className="text-[12px] text-[#6B7280]">
                    {data.driver.email} {data.driver.phone ? `· ${data.driver.phone}` : ""}
                  </p>
                </div>
              ) : null}

              {data.bids && data.bids.length > 0 ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                    Bids ({data.bids.length})
                  </p>
                  <ul className="space-y-1">
                    {data.bids.slice(0, 10).map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between rounded-[8px] bg-[#F9FAFB] px-3 py-2 text-[13px]"
                      >
                        <span className="truncate">{b.driver_name || b.driver_id?.slice(0, 8)}</span>
                        <span className="font-semibold">£{b.amount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.booking ? (
                <div className="rounded-[10px] border border-[#E5E7EB] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                      Booking
                    </p>
                    <StatusPill status={data.booking.status} />
                  </div>
                  <p className="mt-1 text-[13px] text-[#6B7280]">
                    Payment: <span className="font-semibold text-[#111111]">{data.booking.payment_status || "—"}</span>
                    {" · "}Deposit £{Number(data.booking.deposit_amount || 0).toFixed(2)}
                    {" · "}Total £{Number(data.booking.total_price || 0).toFixed(2)}
                  </p>
                </div>
              ) : (
                <p className="rounded-[10px] bg-[#F9FAFB] px-3 py-2 text-[13px] text-[#6B7280]">
                  No booking exists yet for this job.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
