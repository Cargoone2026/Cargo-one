import React, { useState } from "react";
import { api } from "@/lib/api";

// TEMPORARY pre-launch test-data cleanup page (remove after the real run).
function UserTable({ rows, testId }) {
  return (
    <div className="max-h-[360px] overflow-auto rounded-[10px] border border-[#E5E7EB]" data-testid={testId}>
      <table className="w-full text-left text-[12px]">
        <thead className="sticky top-0 bg-[#F9FAFB]">
          <tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Created</th></tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-[#F3F4F6]">
              <td className="p-2">{u.name || "—"}{u.deleted_at ? " (deleted)" : ""}</td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{(u.created_at || "").slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminTestDataCleanup() {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState(null);

  const run = async (mode) => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "dry") setReport(await api("/admin/test-data-cleanup/dry-run"));
      else setResult(await api("/admin/test-data-cleanup/execute", { method: "POST", body: { confirm } }));
    } catch (e) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-6 md:px-8" data-testid="admin-test-data-cleanup">
      <h1 className="text-[22px] font-bold text-[#111111]">Test-data cleanup (temporary)</h1>
      <p className="text-[13px] text-[#374151]">Dry run only reads data. Execute moves data into archive_* collections.</p>
      <button type="button" onClick={() => run("dry")} disabled={busy} data-testid="cleanup-dry-run-btn"
        className="rounded-full bg-[#111111] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
        {busy ? "Working…" : "Run dry run"}
      </button>
      {err ? <p className="text-[13px] text-[#DC2626]" data-testid="cleanup-error">{err}</p> : null}

      {report ? (
        <div className="space-y-4" data-testid="cleanup-report">
          <section>
            <h2 className="text-[15px] font-bold">Users kept: {report.kept_count}</h2>
            {report.missing_keep_emails.length ? (
              <p className="my-1 text-[12px] text-[#B91C1C]" data-testid="cleanup-missing">
                Keep-list emails NOT found: {report.missing_keep_emails.join(", ")}
              </p>
            ) : null}
            <UserTable rows={report.kept} testId="cleanup-kept-table" />
          </section>
          <section>
            <h2 className="text-[15px] font-bold">New since {report.new_since_cutoff} – needs decision: {report.new_since_count}</h2>
            <UserTable rows={report.new_since} testId="cleanup-new-table" />
          </section>
          <section>
            <h2 className="text-[15px] font-bold">Users to archive: {report.archive_count}</h2>
            <UserTable rows={report.archive} testId="cleanup-archive-table" />
          </section>
          <section>
            <h2 className="text-[15px] font-bold">Rows that would be archived</h2>
            <ul className="grid grid-cols-2 gap-1 text-[12px] md:grid-cols-4" data-testid="cleanup-counts">
              {Object.entries(report.collections_to_archive).map(([k, v]) => <li key={k}>{k}: <b>{v}</b></li>)}
            </ul>
            <p className="mt-2 text-[12px] text-[#6B7280]">Untouched: {report.untouched_collections.join(", ")}</p>
            <ul className="mt-2 list-disc pl-5 text-[12px] text-[#374151]">
              {report.execute_will.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </section>
          <section className="rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] p-4">
            <h2 className="text-[15px] font-bold text-[#991B1B]">Execute (only when approved)</h2>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder='Type "ARCHIVE TEST DATA"'
              data-testid="cleanup-confirm-input" className="mt-2 w-full max-w-sm rounded-[10px] border border-[#E5E7EB] p-2 text-[13px]" />
            <button type="button" onClick={() => run("exec")} disabled={busy || confirm !== "ARCHIVE TEST DATA"}
              data-testid="cleanup-execute-btn"
              className="ml-2 rounded-full bg-[#B91C1C] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
              Execute archive
            </button>
            {result ? <pre className="mt-2 text-[11px]" data-testid="cleanup-result">{JSON.stringify(result, null, 2)}</pre> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
