import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Admin dashboard — Cancellation Insights sparkline.
 *
 * Reads `GET /api/admin/cancellations/weekly?weeks=8` (R41) which returns
 * one bucket per ISO-week for the last N weeks (oldest first, never
 * has holes). Renders a lightweight SVG bar chart — no chart library
 * dependency needed for 8 bars. Clicking anywhere opens the full
 * Flagged Customers table for drill-down.
 */
export function CancellationInsightsCard({ weeks = 8 }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api(`/admin/cancellations/weekly?weeks=${weeks}`);
        if (alive) setData(d || null);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not load cancellation trend.");
      }
    })();
    return () => { alive = false; };
  }, [weeks]);

  const buckets = data?.buckets || [];
  const maxCount = Math.max(1, ...buckets.map((b) => b.count || 0));
  const totalCount = data?.totals?.count || 0;
  const totalFees = data?.totals?.fees || 0;
  const totalRefunds = data?.totals?.refunds || 0;

  return (
    <Link
      to="/admin/flagged-customers"
      data-testid="admin-cancellation-insights"
      className="block rounded-[12px] border border-[#E5E7EB] bg-white p-4 transition hover:border-[#111111]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEF2F2]">
              <AlertTriangle className="h-4 w-4 text-[#D62828]" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[#111111]">
                Post-accept cancellations
              </p>
              <p className="text-[11px] text-[#6B7280]">
                Last {weeks} weeks · deposit-only fee retained
              </p>
            </div>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
      </div>

      {err ? (
        <p className="mt-3 text-[12px] text-[#DC2626]" data-testid="admin-cancellation-insights-error">
          {err}
        </p>
      ) : !data ? (
        <div className="mt-3 h-[70px] animate-pulse rounded-md bg-[#F3F4F6]" />
      ) : (
        <>
          <div
            className="mt-3 flex h-[70px] items-end gap-1.5"
            data-testid="admin-cancellation-insights-chart"
            aria-label={`Post-accept cancellations by week: ${buckets.map((b) => `${b.label} ${b.count}`).join(", ")}`}
          >
            {buckets.map((b) => {
              const h = Math.max(2, Math.round((b.count / maxCount) * 62));
              const isCurrent = buckets[buckets.length - 1]?.week_start === b.week_start;
              return (
                <div
                  key={b.week_start}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                  data-testid={`admin-cancellation-bar-${b.week_start}`}
                  title={`${b.label} — ${b.count} cancel${b.count === 1 ? "" : "s"}, £${b.fees.toFixed(2)} fee, £${b.refunds.toFixed(2)} refunded`}
                >
                  <div
                    className={`w-full rounded-t-sm ${
                      b.count === 0 ? "bg-[#F3F4F6]"
                      : isCurrent ? "bg-[#D62828]"
                      : "bg-[#111111]/70"
                    }`}
                    style={{ height: `${h}px` }}
                  />
                  <span className="text-[9px] text-[#9CA3AF]">{b.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <SummaryStat label="Cancels" value={totalCount} testID="insights-total-count" />
            <SummaryStat label="Fees" value={`£${totalFees.toFixed(2)}`} testID="insights-total-fees" />
            <SummaryStat label="Refunded" value={`£${totalRefunds.toFixed(2)}`} testID="insights-total-refunds" />
          </div>
        </>
      )}
    </Link>
  );
}

function SummaryStat({ label, value, testID }) {
  return (
    <div className="rounded-md bg-[#FAFAFA] px-2 py-1.5" data-testid={testID}>
      <p className="text-[10px] uppercase tracking-[0.4px] text-[#6B7280]">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold text-[#111111]">{value}</p>
    </div>
  );
}
