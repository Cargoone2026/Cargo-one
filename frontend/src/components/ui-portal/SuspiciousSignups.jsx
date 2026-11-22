import React, { useState } from "react";
import { api } from "@/lib/api";

export function SuspiciousSignups({ onDone }) {
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const find = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api("/admin/users/suspicious-signups/preview", { method: "POST" });
      setRows(r);
      setPicked(r.map((x) => x.id));
    } catch (e) {
      setMsg(e?.message || "Could not load");
    } finally {
      setBusy(false);
    }
  };

  const mark = async () => {
    setBusy(true);
    try {
      for (let i = 0; i < picked.length; i += 200) {
        await api("/admin/users/test-flag-bulk", { method: "POST", body: { user_ids: picked.slice(i, i + 200), is_test: true } });
      }
      setMsg(`Marked ${picked.length} as test accounts.`);
      setRows(null);
      onDone?.();
    } catch (e) {
      setMsg(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const flip = (id) => setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="mx-4 mt-3 md:mx-8" data-testid="suspicious-signups">
      <button
        type="button"
        onClick={rows ? () => setRows(null) : find}
        disabled={busy}
        data-testid="suspicious-signups-find"
        className="rounded-full border border-[#111111] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#F4F4F4] disabled:opacity-60"
      >
        {rows ? "Hide suspicious sign-ups" : busy ? "Searching…" : "Find suspicious sign-ups"}
      </button>
      {msg ? <span className="ml-3 text-[13px] text-[#6B7280]" data-testid="suspicious-signups-msg">{msg}</span> : null}
      {rows ? (
        <div className="mt-3 rounded-[12px] border border-[#E5E7EB] p-3">
          {rows.length === 0 ? (
            <p className="text-[13px] text-[#6B7280]" data-testid="suspicious-signups-empty">No suspicious sign-ups in the last 7 days.</p>
          ) : (
            <>
              <ul className="max-h-[360px] space-y-1 overflow-auto">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 text-[13px]" data-testid={`suspicious-row-${r.id}`}>
                    <input type="checkbox" checked={picked.includes(r.id)} onChange={() => flip(r.id)} className="h-4 w-4 accent-[#D62828]" data-testid={`suspicious-select-${r.id}`} />
                    <span className="w-[160px] truncate font-semibold">{r.name}</span>
                    <span className="flex-1 truncate text-[#374151]">{r.email}</span>
                    <span className="hidden text-[#9CA3AF] md:inline">{(r.created_at || "").slice(0, 16).replace("T", " ")}</span>
                    <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] text-[#92400E]">{r.reason}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={mark}
                disabled={busy || picked.length === 0}
                data-testid="suspicious-signups-mark"
                className="mt-3 rounded-full bg-[#111111] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#D62828] disabled:opacity-60"
              >
                Mark selected as test accounts ({picked.length})
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
