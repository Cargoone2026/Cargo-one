import React, { useCallback, useEffect, useState } from "react";
import { Activity, MapPin, Radar, RefreshCw, Search, Truck, User as UserIcon } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Admin Dispatch Monitor — real-time debugging screen for the ASAP dispatch
 * queue. Polls /api/admin/dispatch/active every ~5 s. Shows for every
 * pending ASAP job: waiting_seconds, current_search_radius_miles, next
 * expansion timestamp, attempt counts, drivers notified, and — where
 * applicable — the accepted driver. Clicking a row expands the raw
 * dispatch_log for that job (loaded on demand).
 */
export default function AdminDispatchMonitor() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [logRows, setLogRows] = useState({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await api("/admin/dispatch/active");
      setData(r);
      setErr(null);
    } catch (e) {
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const loadLog = useCallback(async (jobId) => {
    if (logRows[jobId]) return;
    try {
      const r = await api(`/admin/dispatch/log/${jobId}`);
      setLogRows((prev) => ({ ...prev, [jobId]: r.rows || [] }));
    } catch { /* silent */ }
  }, [logRows]);

  const items = (data?.items || []).filter((it) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (it.job_id || "").toLowerCase().includes(s)
      || (it.title || "").toLowerCase().includes(s)
      || (it.pickup_town || "").toLowerCase().includes(s)
      || (it.dropoff_town || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-white pb-8" data-testid="admin-dispatch-monitor">
      <div className="mx-auto max-w-[1100px] px-4 pt-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[28px] font-bold text-[#111111]">
              <Radar className="h-6 w-6 text-[#D62828]" />
              Dispatch Monitor
            </h1>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              Live view of every ASAP job waiting for a driver. Polls every 5 s.
              {data?.generated_at ? (
                <span className="ml-1 text-[#9CA3AF]">
                  Last: {new Date(data.generated_at).toLocaleTimeString()}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            data-testid="dispatch-refresh"
            className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:border-[#111111] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {data?.radius_ladder ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2"
            data-testid="dispatch-radius-ladder"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
              Radius ladder
            </span>
            {data.radius_ladder.map((r, i) => (
              <span
                key={i}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#111111] shadow-sm"
              >
                {r.until_seconds == null ? "∞" : `<${r.until_seconds}s`}
                {" · "}
                {r.radius_miles} mi
              </span>
            ))}
            <span className="ml-2 text-[11px] text-[#6B7280]">
              Heartbeat freshness: {data.heartbeat_freshness_seconds}s
            </span>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2 rounded-[12px] border border-[#E5E7EB] px-3 py-2">
          <Search className="h-4 w-4 text-[#9CA3AF]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="dispatch-search"
            placeholder="Search by job id / town / title…"
            className="w-full bg-transparent text-[13px] text-[#111111] outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
          <Stat label="Waiting" value={data?.active_count ?? "—"} tone="waiting" testId="dispatch-stat-waiting" />
          <Stat label="Recently claimed" value={data?.recently_claimed_count ?? "—"} tone="ok" testId="dispatch-stat-claimed" />
        </div>

        {loading && !data ? (
          <p className="mt-6 text-[13px] text-[#6B7280]">Loading dispatch state…</p>
        ) : null}
        {err ? (
          <p className="mt-6 text-[13px] text-[#DC2626]">Error: {err}</p>
        ) : null}

        <ul className="mt-4 space-y-2" data-testid="dispatch-items">
          {items.map((it) => (
            <li
              key={it.job_id}
              className={`rounded-[12px] border p-4 transition-colors ${
                it.queue_state === "claimed"
                  ? "border-[#DCFCE7] bg-[#F0FDF4]"
                  : "border-[#E5E7EB] bg-white hover:border-[#D62828]/60"
              }`}
              data-testid={`dispatch-item-${it.job_id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[#111111]">
                    {it.title || "Untitled"}
                    <span className="ml-2 text-[11px] text-[#9CA3AF]">
                      {(it.job_id || "").slice(0, 8)}
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[#6B7280]">
                    <MapPin className="h-3.5 w-3.5" />
                    {it.pickup_town || "?"} → {it.dropoff_town || "?"}
                    <span className="ml-1 rounded-full bg-[#F4F4F4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                      {it.service_type || "transport"}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={ageTone(it.waiting_seconds)}>
                    <Activity className="mr-1 h-3 w-3" />
                    Wait {formatDuration(it.waiting_seconds)}
                  </Pill>
                  <Pill tone="info">
                    <Radar className="mr-1 h-3 w-3" />
                    Radius {it.current_search_radius_miles} mi
                  </Pill>
                  {it.next_radius_expansion_at ? (
                    <Pill tone="muted">
                      Next widen{" "}
                      {formatShortTimeUntil(it.next_radius_expansion_at)}
                    </Pill>
                  ) : (
                    <Pill tone="muted">Nationwide</Pill>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                <MiniStat
                  label="Drivers notified"
                  value={it.drivers_notified_count}
                  Icon={UserIcon}
                />
                <MiniStat
                  label="Offers pending"
                  value={it.offers_pending}
                  Icon={Truck}
                />
                <MiniStat
                  label="Offers declined"
                  value={it.offers_declined}
                  Icon={Truck}
                />
                <MiniStat
                  label="Last attempt"
                  value={
                    it.last_dispatch_attempt?.ts
                      ? new Date(
                          it.last_dispatch_attempt.ts,
                        ).toLocaleTimeString()
                      : "—"
                  }
                  Icon={Activity}
                />
              </div>

              {it.accepted_by ? (
                <p
                  className="mt-2 rounded-[8px] bg-white px-3 py-1.5 text-[12px] text-[#166534]"
                  data-testid={`dispatch-item-accepted-${it.job_id}`}
                >
                  ✓ Accepted by <strong>{it.accepted_by.name}</strong>
                  {it.accepted_by.phone ? ` · ${it.accepted_by.phone}` : ""}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  const next = expanded === it.job_id ? null : it.job_id;
                  setExpanded(next);
                  if (next) loadLog(it.job_id);
                }}
                data-testid={`dispatch-item-log-toggle-${it.job_id}`}
                className="mt-2 text-[11px] font-semibold text-[#D62828] hover:underline"
              >
                {expanded === it.job_id
                  ? "Hide dispatch log"
                  : "Show raw dispatch log"}
              </button>

              {expanded === it.job_id ? (
                <ol className="mt-2 space-y-1 text-[11px]" data-testid={`dispatch-log-${it.job_id}`}>
                  {(logRows[it.job_id] || []).length === 0 ? (
                    <li className="text-[#9CA3AF]">No entries yet.</li>
                  ) : (
                    (logRows[it.job_id] || []).slice(0, 50).map((r, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center gap-2 rounded-[6px] bg-[#F9FAFB] px-2 py-1 font-mono"
                      >
                        <span className="text-[#6B7280]">
                          {new Date(r.ts).toLocaleTimeString()}
                        </span>
                        <span
                          className={`rounded-full px-1.5 font-semibold ${
                            r.outcome === "offered"
                              ? "bg-[#DCFCE7] text-[#166534]"
                              : r.outcome === "claimed"
                              ? "bg-[#DCFCE7] text-[#166534]"
                              : "bg-[#FEE2E2] text-[#991B1B]"
                          }`}
                        >
                          {r.outcome}
                        </span>
                        <span>drv {(r.driver_id || "-").slice(0, 8)}</span>
                        {r.distance_miles != null ? (
                          <span>· {r.distance_miles} mi</span>
                        ) : null}
                        <span>· r={r.radius_used} mi</span>
                        {r.reason ? (
                          <span className="text-[#6B7280]">
                            · {r.reason}
                          </span>
                        ) : null}
                      </li>
                    ))
                  )}
                </ol>
              ) : null}
            </li>
          ))}
          {items.length === 0 && !loading ? (
            <li
              className="rounded-[12px] border border-[#E5E7EB] bg-white p-6 text-center text-[13px] text-[#6B7280]"
              data-testid="dispatch-empty"
            >
              No ASAP jobs currently waiting.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, testId }) {
  const bg =
    tone === "ok"
      ? "bg-[#DCFCE7] text-[#166534]"
      : tone === "waiting"
      ? "bg-[#FEF3C7] text-[#92400E]"
      : "bg-[#F4F4F4] text-[#111111]";
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${bg}`}
    >
      <span className="text-[11px] uppercase tracking-[0.5px]">{label}</span>
      <span className="ml-1 text-[13px]">{value}</span>
    </span>
  );
}

function Pill({ children, tone }) {
  const bg =
    tone === "hot"
      ? "bg-[#FEE2E2] text-[#991B1B]"
      : tone === "warm"
      ? "bg-[#FEF3C7] text-[#92400E]"
      : tone === "info"
      ? "bg-[#E0F2FE] text-[#0C4A6E]"
      : tone === "muted"
      ? "bg-[#F4F4F4] text-[#6B7280]"
      : "bg-[#DCFCE7] text-[#166534]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${bg}`}
    >
      {children}
    </span>
  );
}

function MiniStat({ label, value, Icon }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-[#F9FAFB] px-2 py-1.5">
      <Icon className="h-4 w-4 text-[#6B7280]" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#9CA3AF]">
          {label}
        </p>
        <p className="text-[13px] font-semibold text-[#111111]">
          {value != null ? value : "—"}
        </p>
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
function ageTone(seconds) {
  if (seconds == null) return "info";
  if (seconds < 30) return "ok";
  if (seconds < 180) return "warm";
  return "hot";
}
function formatShortTimeUntil(iso) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((t - now) / 1000));
  if (s <= 0) return "any moment";
  if (s < 60) return `in ${s}s`;
  return `in ${Math.floor(s / 60)}m ${s % 60}s`;
}
