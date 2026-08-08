import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X as XIcon, Ban, Users as UsersIcon, ExternalLink, MapPin, Truck, AlertTriangle, Send } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";

const ROLE_TABS = [
  { key: "all", label: "All", role: null },
  { key: "customer", label: "Customers", role: "customer" },
  { key: "driver", label: "Drivers", role: "driver" },
  { key: "admin", label: "Admins", role: "admin" },
];

export default function AdminUsers() {
  const [tab, setTab] = useState("all");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [phoneless, setPhoneless] = useState(null); // {count,total_drivers,drivers}
  const [nudgeResult, setNudgeResult] = useState(null);
  const [nudging, setNudging] = useState(false);

  const runNudge = useCallback(async () => {
    // eslint-disable-next-line no-alert
    if (!phoneless || !window.confirm(
      `Send an "add your phone" email to ${phoneless.count} flagged driver${
        phoneless.count === 1 ? "" : "s"
      }? Drivers already emailed in the last 24 h will be skipped.`,
    )) return;
    setNudging(true);
    setNudgeResult(null);
    try {
      const r = await api("/admin/drivers-missing-phone/nudge", { method: "POST" });
      setNudgeResult(r);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Nudge failed");
    } finally {
      setNudging(false);
    }
  }, [phoneless]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tabDef = ROLE_TABS.find((t) => t.key === tab);
      const path = tabDef?.role ? `/admin/users?role=${tabDef.role}` : "/admin/users";
      const [list, missing] = await Promise.all([
        api(path).catch(() => []),
        api("/admin/drivers-missing-phone").catch(() => null),
      ]);
      setUsers(Array.isArray(list) ? list : []);
      setPhoneless(missing);
    } finally {
      setLoading(false);
    }
  }, [tab]);
  useEffect(() => {
    load();
  }, [load]);

  const suspend = async (id, e) => {
    e?.stopPropagation?.();
    // eslint-disable-next-line no-alert
    const reason = window.prompt(
      "Suspend user — reason (≥10 chars):",
      "Repeated policy violations",
    );
    if (!reason || reason.trim().length < 10) return;
    setBusy(id);
    try {
      await api(`/admin/users/${id}/suspend`, {
        method: "POST",
        body: { reason: reason.trim() },
      });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Suspend failed");
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      `${u.name || ""} ${u.email || ""} ${u.id || ""} ${u.role || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [users, q]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-users">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
          Users
        </h1>
        <span className="text-[13px] text-[#6B7280]">
          {filtered.length} of {users.length}
        </span>
      </header>

      {phoneless && phoneless.count > 0 ? (
        <div
          className="mx-4 mt-3 flex items-start gap-3 rounded-[12px] border border-[#F59E0B] bg-[#FFFBEB] p-3 md:mx-8"
          data-testid="admin-drivers-missing-phone-banner"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
          <div className="min-w-0 flex-1 text-[13px] text-[#92400E]">
            <p className="font-semibold">
              {phoneless.count} driver{phoneless.count === 1 ? "" : "s"} missing a valid phone
            </p>
            <p className="mt-0.5">
              These drivers cannot be called by customers after a booking. Chase them via email so they can add or fix their phone.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runNudge}
                disabled={nudging}
                data-testid="admin-nudge-missing-phone"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#D62828] disabled:opacity-60"
              >
                <Send className={`h-3.5 w-3.5 ${nudging ? "animate-pulse" : ""}`} />
                {nudging ? "Emailing…" : `Email all ${phoneless.count} drivers`}
              </button>
              {nudgeResult ? (
                <span
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#111111]"
                  data-testid="admin-nudge-result"
                >
                  Emailed {nudgeResult.sent} · queued {nudgeResult.skipped} · failed {nudgeResult.failed}
                </span>
              ) : null}
            </div>
            <details className="mt-2 rounded-[8px] bg-white px-3 py-2 text-[12px] text-[#111111]">
              <summary
                className="cursor-pointer text-[12px] font-semibold text-[#111111]"
                data-testid="admin-drivers-missing-phone-toggle"
              >
                Show list
              </summary>
              <ul className="mt-2 space-y-1">
                {phoneless.drivers.slice(0, 50).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2"
                    data-testid={`admin-driver-missing-phone-${d.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(d.id)}
                      className="min-w-0 flex-1 truncate text-left hover:underline"
                    >
                      {d.name || "—"} · <span className="text-[#6B7280]">{d.email}</span>
                    </button>
                    <span className="shrink-0 rounded-full bg-[#F4F4F4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                      {d.status || "active"}
                    </span>
                  </li>
                ))}
                {phoneless.drivers.length > 50 ? (
                  <li className="text-[11px] italic text-[#6B7280]">
                    …and {phoneless.drivers.length - 50} more
                  </li>
                ) : null}
              </ul>
            </details>
          </div>
        </div>
      ) : null}

      <div className="mx-4 mt-3 flex flex-wrap gap-1 rounded-full bg-[#F4F4F4] p-1 md:mx-8" data-testid="admin-users-tabs">
        {ROLE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            data-testid={`admin-users-tab-${t.key}`}
            className={`flex-1 min-w-[80px] rounded-full py-2 text-[13px] font-semibold transition-colors ${
              tab === t.key ? "bg-[#111111] text-white" : "text-[#6B7280] hover:text-[#111111]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, role or ID…"
          data-testid="admin-users-search"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear"
            data-testid="admin-users-search-clear"
          >
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {loading && users.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading users…</li>
        ) : filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-users-empty">
            <UsersIcon className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">
              {q ? "No matching users." : "No users found."}
            </p>
          </li>
        ) : (
          filtered.map((u) => (
            <li key={u.id} data-testid={`admin-user-${u.id}`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(u.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(u.id);
                  }
                }}
                data-testid={`admin-user-open-${u.id}`}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-[#E5E7EB] p-4 text-left transition-colors hover:border-[#111111] focus:border-[#111111] focus:outline-none"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[16px] font-bold text-white">
                  {(u.name || "?")[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-[#111111]">
                      {u.name || "—"}
                    </p>
                    <RoleBadge role={u.role} />
                  </div>
                  <p className="truncate text-[12px] text-[#6B7280]">{u.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6B7280]">
                    <span>
                      {u.role === "driver"
                        ? `${u.total_jobs || 0} jobs · ${Number(u.rating || 5).toFixed(1)}★`
                        : `Joined ${u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}`}
                    </span>
                    <span
                      data-testid={`admin-user-status-${u.id}`}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                        u.status === "suspended"
                          ? "bg-[#FEE2E2] text-[#DC2626]"
                          : u.status === "pending"
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#DCFCE7] text-[#16A34A]"
                      }`}
                    >
                      {u.status || "active"}
                    </span>
                  </div>
                </div>
                {u.status !== "suspended" && u.role !== "admin" && (
                  <button
                    type="button"
                    onClick={(e) => suspend(u.id, e)}
                    disabled={busy === u.id}
                    data-testid={`suspend-user-${u.id}`}
                    aria-label="Suspend"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] disabled:opacity-60"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      {openId ? (
        <UserDetailModal userId={openId} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function RoleBadge({ role }) {
  const styles = {
    customer: "bg-[#E0F2FE] text-[#0C4A6E]",
    driver: "bg-[#FEF3C7] text-[#92400E]",
    admin: "bg-[#FEE2E2] text-[#991B1B]",
  };
  return (
    <span
      data-testid={`admin-user-role-${role || "unknown"}`}
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
        styles[role] || "bg-[#F4F4F4] text-[#6B7280]"
      }`}
    >
      {role || "user"}
    </span>
  );
}

function UserDetailModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api(`/admin/users/${userId}`);
        if (alive) setData(d);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load");
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const u = data?.user;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-10"
      onClick={onClose}
      data-testid="admin-user-modal"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-[16px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-3">
          <h3 className="text-[16px] font-semibold text-[#111111]">User details</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="admin-user-modal-close"
            className="rounded-full p-1 hover:bg-[#F4F4F4]"
          >
            <XIcon className="h-4 w-4 text-[#6B7280]" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 text-[14px]">
          {err ? (
            <p className="text-[13px] text-[#DC2626]">{err}</p>
          ) : !u ? (
            <p className="text-[13px] text-[#6B7280]">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[20px] font-bold text-white">
                  {(u.name || "?")[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[18px] font-bold text-[#111111]">{u.name || "—"}</p>
                    <RoleBadge role={u.role} />
                  </div>
                  <p className="truncate text-[13px] text-[#6B7280]">{u.email}</p>
                  {u.phone ? (
                    <p className="text-[13px] text-[#6B7280]">{u.phone}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">
                    ID: {u.id} · Joined {u.created_at ? new Date(u.created_at).toLocaleString() : "—"}
                  </p>
                </div>
                {u.role === "driver" ? (
                  <Link
                    to={`/admin/driver/${u.id}`}
                    data-testid="admin-user-modal-open-driver"
                    className="inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#D62828]"
                  >
                    Open driver <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>

              {u.address_line1 || u.town || u.postcode ? (
                <div className="rounded-[10px] border border-[#E5E7EB] p-3 text-[13px]">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                    Address on file
                  </p>
                  <p>{[u.address_line1, u.address_line2, u.town, u.county, u.postcode, u.country].filter(Boolean).join(", ")}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Status" value={u.status || "active"} />
                <Stat label="Jobs" value={u.total_jobs != null ? u.total_jobs : (data?.recent_jobs?.length || 0)} />
                <Stat label="Bookings" value={data?.recent_bookings?.length || 0} />
              </div>

              {data?.recent_jobs && data.recent_jobs.length > 0 ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                    Recent jobs
                  </p>
                  <ul className="space-y-1">
                    {data.recent_jobs.slice(0, 8).map((j) => (
                      <li
                        key={j.id}
                        className="flex items-center justify-between gap-2 rounded-[8px] bg-[#F9FAFB] px-3 py-2 text-[13px]"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <MapPin className="mr-1 inline h-3 w-3 text-[#D62828]" />
                          {j.title || `${j.pickup_town} → ${j.dropoff_town}`}
                        </span>
                        <StatusPill status={j.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data?.recent_bookings && data.recent_bookings.length > 0 ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">
                    Recent bookings
                  </p>
                  <ul className="space-y-1">
                    {data.recent_bookings.slice(0, 8).map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 rounded-[8px] bg-[#F9FAFB] px-3 py-2 text-[13px]"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <Truck className="mr-1 inline h-3 w-3 text-[#6B7280]" />
                          {b.job?.title || b.job?.pickup_town || b.id.slice(0, 8)}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#6B7280]">
                          £{Number(b.total_price || 0).toFixed(2)}
                        </span>
                        <StatusPill status={b.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-[10px] bg-[#F9FAFB] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9CA3AF]">
        {label}
      </p>
      <p className="text-[15px] font-bold text-[#111111]">{value ?? "—"}</p>
    </div>
  );
}
