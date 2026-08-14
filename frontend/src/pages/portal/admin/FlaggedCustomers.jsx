import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  X as XIcon,
} from "lucide-react";
import { api } from "@/lib/api";

/**
 * Admin — Flagged Customers dashboard.
 *
 * Reads `GET /api/admin/customers/flagged?threshold=N` (R35 signal-only
 * counter). Each row is a customer whose `post_accept_cancel_count` is at
 * or above the current threshold. Clicking a row opens a drawer with the
 * full `post_accept_cancel_history` — one entry per booking they cancelled
 * AFTER a driver had accepted. Deposit-only cancellation fees are the
 * platform policy (R35/R36) so we surface fee + refund per event.
 *
 * Purely read-only: no automated action is taken. Admin decides.
 */
export default function AdminFlaggedCustomers() {
  const [rows, setRows] = useState([]);
  const [threshold, setThreshold] = useState(2);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api(`/admin/customers/flagged?threshold=${threshold}`);
      setRows(Array.isArray(res?.customers) ? res.customers : []);
    } catch (ex) {
      setErr(ex?.message || "Could not load flagged customers.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [r.name, r.email, r.id].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  const stats = useMemo(() => {
    const totalEvents = rows.reduce(
      (s, r) => s + (r.post_accept_cancel_count || 0), 0,
    );
    const totalFees = rows.reduce((s, r) => {
      const hist = Array.isArray(r.post_accept_cancel_history)
        ? r.post_accept_cancel_history
        : [];
      return s + hist.reduce((x, h) => x + Number(h.cancellation_fee || 0), 0);
    }, 0);
    return { customers: rows.length, events: totalEvents, fees: totalFees };
  }, [rows]);

  return (
    <div className="min-h-screen bg-white pb-10" data-testid="admin-flagged-customers">
      <header className="px-4 pt-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
              Flagged customers
            </h1>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              Customers who cancelled AFTER a driver had already accepted. Signal-only —
              no automated action is taken. Use this to spot bypass attempts.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            data-testid="admin-flagged-refresh"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#F9FAFB]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </header>

      <section className="mx-4 mt-4 grid grid-cols-1 gap-3 md:mx-8 md:grid-cols-3">
        <StatCard label="Flagged customers" value={stats.customers} icon={ShieldAlert} testID="stat-customers" />
        <StatCard label="Post-accept cancels" value={stats.events} icon={AlertTriangle} testID="stat-events" />
        <StatCard label="Fees retained" value={`£${stats.fees.toFixed(2)}`} icon={Sliders} testID="stat-fees" />
      </section>

      <div className="mx-4 mt-5 flex flex-col gap-2 md:mx-8 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#6B7280]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, id…"
            data-testid="admin-flagged-search"
            className="flex-1 border-0 bg-transparent text-[13px] text-[#111111] focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-[#6B7280]" />
          <label className="text-[12px] font-semibold text-[#6B7280]" htmlFor="admin-flagged-threshold">
            Threshold ≥
          </label>
          <select
            id="admin-flagged-threshold"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            data-testid="admin-flagged-threshold"
            className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#111111] focus:outline-none"
          >
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {err ? (
        <p className="mx-4 mt-3 text-[13px] text-[#DC2626] md:mx-8" data-testid="admin-flagged-error">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="mx-4 mt-4 text-[13px] text-[#6B7280] md:mx-8">Loading…</p>
      ) : filtered.length === 0 ? (
        <div
          className="mx-4 mt-6 flex flex-col items-center gap-2 rounded-[16px] border border-[#E5E7EB] bg-white py-16 text-center md:mx-8"
          data-testid="admin-flagged-empty"
        >
          <ShieldAlert className="h-10 w-10 text-[#9CA3AF]" />
          <p className="text-[13px] text-[#6B7280]">
            {rows.length === 0
              ? `No customers have ≥ ${threshold} post-accept cancellations.`
              : "No customers match the current search."}
          </p>
        </div>
      ) : (
        <ul className="mx-4 mt-4 space-y-2 md:mx-8" data-testid="admin-flagged-list">
          {filtered.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                data-testid={`admin-flagged-row-${row.id}`}
                className="flex w-full items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white p-3 text-left hover:bg-[#F9FAFB]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-semibold text-[#111111]">
                      {row.name || "Unnamed customer"}
                    </p>
                    <span
                      className="whitespace-nowrap rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-bold text-[#DC2626]"
                      data-testid={`admin-flagged-count-${row.id}`}
                    >
                      {row.post_accept_cancel_count} post-accept cancel{row.post_accept_cancel_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">
                    {row.email} · joined {formatWhen(row.created_at)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <DetailDrawer row={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, testID }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-4"
      data-testid={`admin-flagged-${testID}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
          {label}
        </p>
        <p className="mt-0.5 text-[18px] font-bold text-[#111111]">{value}</p>
      </div>
    </div>
  );
}

function DetailDrawer({ row, onClose }) {
  const history = Array.isArray(row.post_accept_cancel_history)
    ? [...row.post_accept_cancel_history].sort(
        (a, b) => new Date(b.at || 0) - new Date(a.at || 0),
      )
    : [];
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-end bg-black/40 sm:items-stretch"
      role="dialog"
      aria-modal="true"
      data-testid="admin-flagged-detail-drawer"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-white shadow-2xl sm:rounded-l-[20px]"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-[#111111]">
              {row.name || "Unnamed customer"}
            </h2>
            <p className="truncate text-[12px] text-[#6B7280]">{row.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="admin-flagged-detail-close"
            className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[#E5E7EB] px-4 py-3 text-[13px] text-[#374151]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
              Post-accept cancellations
            </span>
            <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[12px] font-bold text-[#DC2626]">
              {row.post_accept_cancel_count}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-[#6B7280]">
            Cargo One retains a % of the paid deposit as the cancellation fee (R35/R36).
            The refund figure is the deposit MINUS that fee — never a % of the full booking price.
          </p>
        </div>

        <div className="flex-1 space-y-2 px-4 py-4">
          {history.length === 0 ? (
            <p className="text-[13px] text-[#6B7280]">No detailed history recorded.</p>
          ) : (
            history.map((h, i) => (
              <div
                key={h.booking_id || i}
                data-testid={`admin-flagged-history-${h.booking_id || i}`}
                className="rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-[13px] text-[#111111]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-[#374151]">
                    Booking {h.booking_id?.slice(0, 12)}…
                  </span>
                  <span className="whitespace-nowrap text-[11px] text-[#6B7280]">
                    {formatWhen(h.at, true)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <p className="text-[10px] uppercase text-[#6B7280]">Cancellation fee</p>
                    <p className="mt-0.5 font-semibold text-[#DC2626]">
                      £{Number(h.cancellation_fee || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#6B7280]">Refunded</p>
                    <p className="mt-0.5 font-semibold text-[#111111]">
                      £{Number(h.refund_amount || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function formatWhen(iso, withSeconds = false) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
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
