import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  X as XIcon,
} from "lucide-react";
import { api } from "@/lib/api";

/**
 * Admin — Driver Cancellations audit view.
 *
 * Hits `GET /api/admin/driver-cancellations` (optionally with `driver_id=` to
 * scope to a single driver — same endpoint powers the Driver Detail page's
 * cancellation history section). Purely a read-only surface: policy decisions
 * (suspension, warning, etc.) stay in Admin's hands, this screen only
 * exposes the evidence.
 *
 * Filters are all client-side over the last 500 rows returned by the server;
 * for larger scale we would move filtering to server params.
 */
export default function AdminDriverCancellations() {
  const [params, setParams] = useSearchParams();
  const driverIdFilter = params.get("driver_id") || "";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("all");
  const [timing, setTiming] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const url = driverIdFilter
        ? `/admin/driver-cancellations?driver_id=${encodeURIComponent(driverIdFilter)}`
        : "/admin/driver-cancellations";
      const res = await api(url);
      setRows(Array.isArray(res?.cancellations) ? res.cancellations : []);
    } catch (ex) {
      setErr(ex?.message || "Could not load cancellations.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [driverIdFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (reason !== "all" && r.reason !== reason) return false;
      if (timing !== "all" && (r.service_timing || "").toLowerCase() !== timing) return false;
      if (!needle) return true;
      const hay = [
        r.driver_name, r.driver_id, r.booking_id, r.job_id,
        r.reason_label, r.reason, r.explanation,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, reason, timing]);

  const reasons = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => r.reason && s.add(r.reason));
    return Array.from(s);
  }, [rows]);

  const stats = useMemo(() => {
    const byDriver = new Map();
    rows.forEach((r) => {
      byDriver.set(r.driver_id, (byDriver.get(r.driver_id) || 0) + 1);
    });
    const topDriver = Array.from(byDriver.entries())
      .sort((a, b) => b[1] - a[1])[0];
    return {
      total: rows.length,
      uniqueDrivers: byDriver.size,
      top: topDriver ? { count: topDriver[1], driver_id: topDriver[0],
                          driver_name: rows.find(r => r.driver_id === topDriver[0])?.driver_name } : null,
    };
  }, [rows]);

  const clearDriverFilter = () => {
    const next = new URLSearchParams(params);
    next.delete("driver_id");
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-white pb-10" data-testid="admin-driver-cancellations">
      <header className="px-4 pt-6 md:px-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
              Driver Cancellations
            </h1>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              Audit log of every driver-initiated cancellation. Sorted by most recent.
              {driverIdFilter ? " Filtered to a single driver." : " Showing the last 500 rows system-wide."}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            data-testid="admin-cancellations-refresh"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#F9FAFB]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        {driverIdFilter ? (
          <button
            type="button"
            onClick={clearDriverFilter}
            data-testid="admin-cancellations-clear-driver-filter"
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#D62828]"
          >
            <XIcon className="h-3.5 w-3.5" />
            Clear driver filter (currently: {driverIdFilter.slice(0, 12)}…)
          </button>
        ) : null}
      </header>

      <section className="mx-4 mt-4 grid grid-cols-1 gap-3 md:mx-8 md:grid-cols-3">
        <StatCard label="Cancellations" value={stats.total} icon={AlertTriangle} testID="stat-total" />
        <StatCard label="Unique drivers" value={stats.uniqueDrivers} icon={ShieldAlert} testID="stat-unique" />
        {stats.top ? (
          <StatCard
            label="Most cancellations by"
            value={`${stats.top.driver_name || stats.top.driver_id?.slice(0, 8)} · ${stats.top.count}`}
            icon={AlertTriangle}
            testID="stat-top-driver"
          />
        ) : (
          <StatCard label="Most cancellations by" value="—" icon={AlertTriangle} testID="stat-top-driver" />
        )}
      </section>

      <div className="mx-4 mt-5 flex flex-col gap-2 md:mx-8 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#6B7280]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search driver name, booking, reason…"
            data-testid="admin-cancellations-search"
            className="flex-1 border-0 bg-transparent text-[13px] text-[#111111] focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#6B7280]" />
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="admin-cancellations-filter-reason"
            className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#111111] focus:outline-none"
          >
            <option value="all">All reasons</option>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {rows.find((row) => row.reason === r)?.reason_label || r}
              </option>
            ))}
          </select>
          <select
            value={timing}
            onChange={(e) => setTiming(e.target.value)}
            data-testid="admin-cancellations-filter-timing"
            className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#111111] focus:outline-none"
          >
            <option value="all">All timings</option>
            <option value="asap">ASAP</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
      </div>

      {err ? (
        <p className="mx-4 mt-3 text-[13px] text-[#DC2626] md:mx-8" data-testid="admin-cancellations-error">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="mx-4 mt-4 text-[13px] text-[#6B7280] md:mx-8">Loading cancellations…</p>
      ) : filtered.length === 0 ? (
        <div className="mx-4 mt-6 flex flex-col items-center gap-2 rounded-[16px] border border-[#E5E7EB] bg-white py-16 text-center md:mx-8" data-testid="admin-cancellations-empty">
          <AlertTriangle className="h-10 w-10 text-[#9CA3AF]" />
          <p className="text-[13px] text-[#6B7280]">
            {rows.length === 0
              ? "No driver cancellations on record."
              : "No cancellations match the current filters."}
          </p>
        </div>
      ) : (
        <ul className="mx-4 mt-4 space-y-2 md:mx-8" data-testid="admin-cancellations-list">
          {filtered.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                data-testid={`admin-cancellation-row-${row.id}`}
                className="flex w-full items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white p-3 text-left hover:bg-[#F9FAFB]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-semibold text-[#111111]">
                      {row.driver_name || "Unknown driver"}
                    </p>
                    <span className="whitespace-nowrap text-[11px] text-[#6B7280]">
                      {formatWhen(row.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[#374151]">
                    <span className="font-semibold">{row.reason_label || row.reason}</span>
                    {row.explanation ? <span className="text-[#6B7280]"> · "{truncate(row.explanation, 80)}"</span> : null}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {row.service_timing ? (
                      <Chip
                        color={row.service_timing === "asap" ? "orange" : "grey"}
                        label={row.service_timing === "asap" ? "ASAP" : "Scheduled"}
                      />
                    ) : null}
                    {row.pricing_type ? (
                      <Chip color="grey" label={pricingLabel(row.pricing_type)} />
                    ) : null}
                    {row.service_type ? <Chip color="grey" label={row.service_type} /> : null}
                    <span className="text-[11px] text-[#9CA3AF]">
                      Booking {row.booking_id?.slice(0, 8)}…
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <DetailDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onFilterByDriver={() => {
            const next = new URLSearchParams(params);
            next.set("driver_id", selected.driver_id);
            setParams(next, { replace: true });
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, testID }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-4"
      data-testid={`admin-cancellations-${testID}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">{label}</p>
        <p className="mt-0.5 text-[18px] font-bold text-[#111111]">{value}</p>
      </div>
    </div>
  );
}

function Chip({ color, label }) {
  const styles =
    color === "orange"
      ? "bg-[#FFF7ED] text-[#E55E00]"
      : "bg-[#F4F4F4] text-[#374151]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function DetailDrawer({ row, onClose, onFilterByDriver }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-end bg-black/40 sm:items-stretch"
      role="dialog"
      aria-modal="true"
      data-testid="admin-cancellation-detail-drawer"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[480px] flex-col overflow-y-auto bg-white shadow-2xl sm:rounded-l-[20px]"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-[15px] font-bold text-[#111111]">Cancellation detail</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="admin-cancellation-detail-close"
            className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4 text-[13px] text-[#374151]">
          <Field label="Driver" value={row.driver_name || "—"} />
          <Field label="Driver ID" value={row.driver_id} mono />
          <Field label="Booking" value={row.booking_id} mono />
          <Field label="Job" value={row.job_id} mono />
          <Field label="Reason" value={row.reason_label || row.reason} highlight />
          {row.explanation ? <Field label="Explanation" value={row.explanation} italic /> : null}
          <Field
            label="Timing"
            value={row.service_timing === "asap" ? "ASAP" : "Scheduled"}
          />
          {row.pricing_type ? (
            <Field label="Pricing" value={pricingLabel(row.pricing_type)} />
          ) : null}
          {row.service_type ? <Field label="Service" value={row.service_type} /> : null}
          <Field label="Booking state before cancel" value={row.booking_status_before || "—"} />
          <Field label="Cancelled at" value={formatWhen(row.created_at, true)} />

          <div className="mt-3 flex flex-col gap-2 border-t border-[#E5E7EB] pt-3 sm:flex-row">
            <button
              type="button"
              onClick={onFilterByDriver}
              data-testid="admin-cancellation-detail-filter-driver"
              className="flex-1 rounded-[10px] border border-[#E5E7EB] py-2 text-[13px] font-semibold text-[#111111] hover:bg-[#F9FAFB]"
            >
              Show all cancellations by this driver
            </button>
            <Link
              to={`/admin/driver/${row.driver_id}`}
              data-testid="admin-cancellation-detail-open-driver"
              className="flex-1 rounded-[10px] bg-[#111111] py-2 text-center text-[13px] font-semibold text-white hover:bg-[#D62828]"
            >
              Open driver profile
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value, mono, italic, highlight }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-[13px] ${mono ? "font-mono text-[12px]" : ""} ${italic ? "italic" : ""} ${
          highlight ? "font-bold text-[#DC2626]" : "text-[#111111]"
        } break-words`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function pricingLabel(p) {
  switch ((p || "").toLowerCase()) {
    case "fixed":
      return "Fixed price";
    case "bidding":
      return "Bidding";
    case "asap_fixed":
      return "ASAP fixed";
    default:
      return p;
  }
}

function formatWhen(iso, withSeconds = false) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (!withSeconds) {
      if (diff < 60_000) return "just now";
      if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
      if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
      if (diff < 7 * 86400_000) return `${Math.round(diff / 86400_000)}d ago`;
    }
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: withSeconds ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_e) {
    return iso;
  }
}
