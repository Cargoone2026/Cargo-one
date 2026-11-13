import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X as XIcon, MapPin, Package, User, Truck, ExternalLink, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { JobExtras } from "@/components/ui-portal/JobExtras";
import {
  STAGE_TABS, BOOKING_TYPES, ChipRow, JobMetaLine, SummaryLine, countBy, exportJobsCsv,
} from "@/components/ui-portal/AdminJobsOrganiser";

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [params] = useSearchParams();
  const [openId, setOpenId] = useState(params.get("job"));
  const [showDeleted, setShowDeleted] = useState(false);
  const [tab, setTab] = useState("attention");
  const [types, setTypes] = useState([]);
  const [cats, setCats] = useState([]);
  const [hideTest, setHideTest] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api(`/admin/jobs/overview${showDeleted ? "?include_deleted=true" : ""}`).catch(() => []);
      setJobs(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);
  useEffect(() => {
    load();
  }, [load]);

  const base = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs.filter(
      (j) =>
        (!hideTest || !j.is_test) &&
        (!term ||
          `${j.title || ""} ${j.pickup_town || ""} ${j.dropoff_town || ""} ${j.customer_name || ""} ${j.assigned_driver_name || ""} ${j.id}`
            .toLowerCase()
            .includes(term)),
    );
  }, [jobs, q, hideTest]);
  const inTab = (j) => STAGE_TABS.find((t) => t.key === tab).match(j);
  const byType = (j) => types.length === 0 || types.includes(j.booking_type);
  const byCat = (j) => cats.length === 0 || cats.includes(j.category_label);
  const tabCounts = useMemo(
    () => Object.fromEntries(STAGE_TABS.map((t) => [t.key, base.filter((j) => byType(j) && byCat(j) && t.match(j)).length])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, types, cats],
  );
  const typeCounts = countBy(base.filter((j) => inTab(j) && byCat(j)), (j) => j.booking_type);
  const catCounts = countBy(base.filter((j) => inTab(j) && byType(j)), (j) => j.category_label);
  const catOptions = Object.keys(countBy(jobs, (j) => j.category_label)).sort().map((c) => ({ key: c, label: c }));
  const filtered = base.filter((j) => inTab(j) && byType(j) && byCat(j));
  const flip = (setter) => (k) => setter((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-jobs">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">All Jobs</h1>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#6B7280]">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              data-testid="admin-jobs-show-deleted"
              className="h-4 w-4 accent-[#D62828]"
            />
            Show deleted
          </label>
          <span className="text-[13px] text-[#6B7280]" data-testid="admin-jobs-count">
            {filtered.length} of {jobs.length}
          </span>
        </div>
      </header>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, town, customer, driver, job ID…"
          data-testid="admin-jobs-search"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} data-testid="admin-jobs-search-clear" aria-label="Clear">
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      <div className="mx-4 mt-3 flex flex-wrap gap-2 md:mx-8" data-testid="admin-jobs-stage-tabs">
        {STAGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            data-testid={`admin-jobs-tab-${t.key}`}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              tab === t.key ? "bg-[#D62828] text-white" : "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]"
            }`}
          >
            {t.label} <span className={tab === t.key ? "text-white/70" : "text-[#9CA3AF]"}>{tabCounts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="mx-4 mt-3 space-y-2 md:mx-8">
        <ChipRow
          label="Booking type"
          options={BOOKING_TYPES.map((t) => ({ key: t, label: t }))}
          counts={typeCounts}
          selected={types}
          onToggle={flip(setTypes)}
          testPrefix="admin-jobs-type"
        />
        <ChipRow label="Service" options={catOptions} counts={catCounts} selected={cats} onToggle={flip(setCats)} testPrefix="admin-jobs-cat" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SummaryLine list={filtered} />
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#6B7280]">
              <input
                type="checkbox"
                checked={hideTest}
                onChange={(e) => setHideTest(e.target.checked)}
                data-testid="admin-jobs-hide-test"
                className="h-4 w-4 accent-[#D62828]"
              />
              Hide test jobs
            </label>
            <button
              type="button"
              onClick={() => exportJobsCsv(filtered)}
              data-testid="admin-jobs-export-csv"
              className="rounded-full bg-[#111111] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#D62828]"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {loading && jobs.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading jobs…</li>
        ) : filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-jobs-empty">
            <Package className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">
              {q ? "No matching jobs." : jobs.length ? "No jobs match these filters." : "No jobs posted yet."}
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
                  <div className="flex items-center gap-2">
                    {j.support_issue_open ? (
                      <span
                        className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-red-700"
                        data-testid={`admin-job-needs-attention-${j.id}`}
                      >
                        Needs attention
                      </span>
                    ) : null}
                    {j.deleted_at ? <DeletedBadge testId={`admin-job-deleted-${j.id}`} /> : null}
                    <StatusPill status={j.status} />
                  </div>
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
                <JobMetaLine job={j} />
                <div className="mt-3 flex items-center justify-between border-t border-[#F3F4F6] pt-2">
                  <span className="text-[13px] text-[#6B7280]">
                    By {j.customer_name || "—"}
                  </span>
                  <span className="text-[18px] font-bold text-[#111111]">
                    £{j.price}
                  </span>
                </div>
              </button>
              <FeedToggle
                job={j}
                onChange={(hidden) => setJobs((list) => list.map((x) => (x.id === j.id ? { ...x, public_feed_hidden: hidden } : x)))}
              />
            </li>
          ))
        )}
      </ul>

      {openId ? (
        <JobDetailModal
          jobId={openId}
          onClose={() => setOpenId(null)}
          onDeleted={() => {
            setOpenId(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function FeedToggle({ job, onChange }) {
  const [busy, setBusy] = useState(false);
  const hidden = !!job.public_feed_hidden;
  const toggle = async () => {
    setBusy(true);
    try {
      await api(`/admin/jobs/${job.id}/public-feed`, { method: "POST", body: { hidden: !hidden } });
      onChange(!hidden);
    } catch {
      /* leave state unchanged on failure */
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      data-testid={`admin-job-feed-toggle-${job.id}`}
      className="mt-1 text-[12px] font-semibold text-[#6B7280] underline hover:text-[#111111] disabled:opacity-50"
    >
      {hidden ? "Show on public feed" : "Hide from public feed"}
    </button>
  );
}

function DeletedBadge({ testId }) {
  return (
    <span
      className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#B91C1C]"
      data-testid={testId}
    >
      Deleted
    </span>
  );
}

function DeleteJobAction({ jobId, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const doDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/jobs/${jobId}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError(e?.message || "Delete failed");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-t border-[#F3F4F6] pt-4" data-testid="admin-job-delete-section">
      {error ? (
        <p className="mb-3 rounded-[10px] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]" data-testid="admin-job-delete-error">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <div className="rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] p-3" data-testid="admin-job-delete-confirm">
          <p className="text-[13px] text-[#7F1D1D]">
            Delete this job? It will be hidden from customers, drivers and lists. Payments, earnings and records are not changed.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              data-testid="admin-job-delete-cancel"
              className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#111111] ring-1 ring-[#E5E7EB] hover:bg-[#F4F4F4]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doDelete}
              disabled={busy}
              data-testid="admin-job-delete-confirm-btn"
              className="rounded-full bg-[#DC2626] px-4 py-1.5 text-[13px] font-bold text-white hover:bg-[#B91C1C] disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Yes, delete job"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          data-testid="admin-job-delete-btn"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#DC2626] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#B91C1C]"
        >
          <Trash2 className="h-4 w-4" />
          Delete job
        </button>
      )}
    </div>
  );
}

function JobDetailModal({ jobId, onClose, onDeleted }) {
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
                  <div className="flex items-center gap-2">
                    {data.job.deleted_at ? <DeletedBadge testId="admin-job-modal-deleted" /> : null}
                    <StatusPill status={data.job.status} />
                  </div>
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

              {data.job.deleted_at ? (
                <p className="rounded-[10px] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#7F1D1D]" data-testid="admin-job-modal-deleted-note">
                  Deleted {new Date(data.job.deleted_at).toLocaleString()} — read-only record.
                </p>
              ) : (
                <DeleteJobAction jobId={jobId} onDeleted={onDeleted} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
