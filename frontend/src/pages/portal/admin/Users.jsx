import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X as XIcon, Ban, Users as UsersIcon } from "lucide-react";
import { api } from "@/lib/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api("/admin/users?role=customer").catch(() => []);
      setUsers(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const suspend = async (id) => {
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
      `${u.name || ""} ${u.email || ""} ${u.id || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [users, q]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-users">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
          Customers
        </h1>
        <span className="text-[13px] text-[#6B7280]">
          {filtered.length} of {users.length}
        </span>
      </header>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or ID…"
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
          <li className="text-[13px] text-[#6B7280]">Loading customers…</li>
        ) : filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-users-empty">
            <UsersIcon className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">
              {q ? "No matching customers." : "No customers yet."}
            </p>
          </li>
        ) : (
          filtered.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] p-4"
              data-testid={`admin-user-${u.id}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] text-[16px] font-bold text-white">
                {(u.name || "?")[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[#111111]">
                  {u.name}
                </p>
                <p className="truncate text-[12px] text-[#6B7280]">{u.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6B7280]">
                  <span>
                    {u.total_jobs || 0} jobs · {Number(u.rating || 5).toFixed(1)}★
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                      u.status === "suspended"
                        ? "bg-[#FEE2E2] text-[#DC2626]"
                        : "bg-[#DCFCE7] text-[#16A34A]"
                    }`}
                  >
                    {u.status || "active"}
                  </span>
                </div>
              </div>
              {u.status !== "suspended" && (
                <button
                  type="button"
                  onClick={() => suspend(u.id)}
                  disabled={busy === u.id}
                  data-testid={`suspend-user-${u.id}`}
                  aria-label="Suspend"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] disabled:opacity-60"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
