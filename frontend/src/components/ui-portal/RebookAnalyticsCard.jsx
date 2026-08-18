import React, { useEffect, useState } from "react";
import { Repeat, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";

/**
 * R63 — Rebook Analytics tile for the Admin dashboard.
 *
 * Reads `GET /api/admin/analytics/rebooks?days=<n>&window_hours=24`.
 * The backend endpoint retro-computes: for every cancelled ASAP
 * booking in the window, does the same customer have a fresh
 * (non-cancelled) ASAP booking within `window_hours` of the cancel?
 * If yes → counts as recovered.
 *
 * Renders a compact 30-day daily bar chart (cancelled = grey, rebooked
 * = emerald overlay) plus the headline rebook rate. Matches the visual
 * language of `CancellationInsightsCard` (R41) so it slots neatly onto
 * the dashboard.
 */
export function RebookAnalyticsCard({ days = 30, windowHours = 24 }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api(
          `/admin/analytics/rebooks?days=${days}&window_hours=${windowHours}`
        );
        if (alive) setData(d || null);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not load rebook analytics.");
      }
    })();
    return () => { alive = false; };
  }, [days, windowHours]);

  const daily = data?.daily || [];
  const maxCount = Math.max(1, ...daily.map((d) => d.cancelled || 0));
  const total = data?.cancelled_asap || 0;
  const rebooked = data?.rebooked || 0;
  const rate = data?.rebook_rate_pct ?? 0;

  return (
    <div
      data-testid="admin-rebook-analytics"
      className="block rounded-[12px] border border-[#E5E7EB] bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0FDF4]">
              <Repeat className="h-4 w-4 text-[#16A34A]" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[#111111]">
                Rebooked cancelled ASAPs
              </p>
              <p className="text-[11px] text-[#6B7280]">
                Last {days} days · {windowHours}h rebook window
              </p>
            </div>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
      </div>

      {err ? (
        <p
          className="mt-3 text-[12px] text-[#DC2626]"
          data-testid="admin-rebook-analytics-error"
        >
          {err}
        </p>
      ) : !data ? (
        <div className="mt-3 h-[70px] animate-pulse rounded-md bg-[#F3F4F6]" />
      ) : total === 0 ? (
        <p
          className="mt-4 text-[12px] text-[#6B7280]"
          data-testid="admin-rebook-analytics-empty"
        >
          No cancelled ASAP bookings in the last {days} days.
        </p>
      ) : (
        <>
          <div
            className="mt-3 flex h-[70px] items-end gap-[2px]"
            data-testid="admin-rebook-analytics-chart"
            aria-label={`Rebook trend: ${daily.map((d) => `${d.date} cancelled ${d.cancelled} rebooked ${d.rebooked}`).join(", ")}`}
          >
            {daily.map((d) => {
              const h = Math.max(2, Math.round((d.cancelled / maxCount) * 62));
              const rh = d.cancelled
                ? Math.max(0, Math.round((d.rebooked / d.cancelled) * h))
                : 0;
              return (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-stretch justify-end"
                  title={`${d.date} — ${d.cancelled} cancelled, ${d.rebooked} rebooked`}
                  data-testid={`admin-rebook-bar-${d.date}`}
                >
                  <div className="relative w-full" style={{ height: `${h}px` }}>
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-t-sm bg-[#E5E7EB]"
                      style={{ height: `${h}px` }}
                    />
                    {rh > 0 && (
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-sm bg-[#16A34A]"
                        style={{ height: `${rh}px` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <RebookStat label="Cancelled" value={total} testID="rebook-total-cancelled" />
            <RebookStat label="Rebooked" value={rebooked} testID="rebook-total-rebooked" />
            <RebookStat label="Rate" value={`${rate}%`} testID="rebook-rate" />
          </div>

          <p className="mt-2 text-[10px] leading-tight text-[#9CA3AF]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#16A34A] align-middle" />{" "}
            recovered inside {windowHours}h ·{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-[#E5E7EB] align-middle" />{" "}
            cancelled without rebook
          </p>
        </>
      )}
    </div>
  );
}

function RebookStat({ label, value, testID }) {
  return (
    <div className="rounded-md bg-[#FAFAFA] px-2 py-1.5" data-testid={testID}>
      <p className="text-[10px] uppercase tracking-[0.4px] text-[#6B7280]">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold text-[#111111]">{value}</p>
    </div>
  );
}

export default RebookAnalyticsCard;
