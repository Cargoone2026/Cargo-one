import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { HandoverDialog } from "@/components/ui-portal/HandoverDialog";
import { AdminCancelDialog } from "@/components/ui-portal/AdminCancelDialog";

const LIVE_STATUSES = ["deposit_paid", "confirmed", "accepted", "travelling", "arrived", "collected", "on_route"];
const STATE_LABEL = { handover_reposted: "Re-posted for handover", handover_assigned: "Assigned to a new driver" };

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const money = (v) => (v == null ? "—" : `£${Number(v).toFixed(2)}`);

function Section({ title, children }) {
  return (
    <div className="rounded-[10px] border border-[#F3F4F6] bg-white p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">{title}</p>
      <div className="space-y-1 text-[13px] text-[#111111]">{children}</div>
    </div>
  );
}

function Contact({ who, person, testId }) {
  return (
    <>
      <p className="font-semibold">{person?.name || "—"}</p>
      {person?.phone ? (
        <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 text-[#2563EB] hover:underline" data-testid={`${testId}-phone`}>
          <Phone className="h-3.5 w-3.5" /> {person.phone}
        </a>
      ) : (
        <p className="text-[#6B7280]" data-testid={`${testId}-no-phone`}>No phone on file</p>
      )}
      {person?.email ? (
        <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-[#2563EB] hover:underline" data-testid={`${testId}-email`}>
          <Mail className="h-3.5 w-3.5" /> {person.email}
        </a>
      ) : (
        <p className="text-[#6B7280]">No {who} email</p>
      )}
    </>
  );
}

// Full "Needs attention" panel for a driver-reported problem, with Mark resolved.
export function SupportIssuePanel({ details, onResolved, onChanged }) {
  const [handoverMode, setHandoverMode] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);
  const d = details;
  const issue = d.issue || {};
  const resolved = !!issue.resolved_at;
  const loc = d.driver_location || {};
  const pay = d.payment || {};
  const canHandover = !resolved && pay.payment_status === "paid" && LIVE_STATUSES.includes(d.status);
  const canCancel = !["cancelled", "delivered", "pod_uploaded", "completed"].includes(d.status);

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(d.booking_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const resolve = async () => {
    setBusy(true);
    setErr(null);
    try {
      const next = await api(`/admin/bookings/${d.booking_id}/support-issue/resolve`, {
        method: "POST",
        body: { note: note.trim() || null },
      });
      onResolved?.(next);
    } catch (e) {
      setErr(e?.message || "Could not mark as resolved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`mt-3 space-y-2 rounded-[12px] p-3 ${resolved ? "bg-[#F9FAFB]" : "bg-red-50"}`}
      data-testid={`support-issue-panel-${d.booking_id}`}
    >
      <Section title="Problem">
        <p><b>{issue.reason_label || "—"}</b></p>
        <p className="whitespace-pre-wrap" data-testid="support-issue-note">{issue.note || "—"}</p>
        <p className="text-[12px] text-[#6B7280]">Reported {fmt(issue.created_at)} · status then: {issue.booking_status || "—"}</p>
      </Section>

      <div className="grid gap-2 md:grid-cols-2">
        <Section title="Job">
          <p className="font-semibold">{d.job_title || "—"}</p>
          <button type="button" onClick={copyRef} className="flex items-center gap-1.5 font-mono text-[12px] text-[#374151] hover:text-[#111111]" data-testid="support-issue-copy-ref">
            <Copy className="h-3.5 w-3.5" /> {d.booking_id} {copied ? <span className="font-sans text-[#16A34A]">Copied</span> : null}
          </button>
          <p className="capitalize text-[#374151]">{[d.job_type, d.pricing_type].filter(Boolean).join(" · ") || "—"}</p>
          <p><span className="text-[#6B7280]">Pickup:</span> {d.pickup_address || "—"}</p>
          <p><span className="text-[#6B7280]">Drop-off:</span> {d.dropoff_address || "—"}</p>
          <p><span className="text-[#6B7280]">Status now:</span> {d.status || "—"}</p>
          <p className="text-[12px] text-[#6B7280]">
            {d.scheduled_at ? `Scheduled ${fmt(d.scheduled_at)} · ` : ""}Created {fmt(d.created_at)}
          </p>
          {d.job_id ? (
            <Link to={`/admin/jobs?job=${d.job_id}`} className="inline-flex items-center gap-1 text-[#2563EB] hover:underline" data-testid="support-issue-view-job">
              <ExternalLink className="h-3.5 w-3.5" /> View job
            </Link>
          ) : null}
        </Section>

        <Section title="Payment">
          <p><span className="text-[#6B7280]">Status:</span> {pay.payment_status || "—"}</p>
          <p><span className="text-[#6B7280]">Deposit:</span> {money(pay.deposit_amount)}</p>
          <p><span className="text-[#6B7280]">Driver charge:</span> {money(pay.driver_charge)}</p>
          {pay.booking_fee != null ? <p><span className="text-[#6B7280]">Booking fee:</span> {money(pay.booking_fee)}</p> : null}
          {pay.total_price != null ? <p><span className="text-[#6B7280]">Total:</span> {money(pay.total_price)}</p> : null}
        </Section>

        <Section title="Driver">
          <Contact who="driver" person={d.driver} testId="support-issue-driver" />
          {loc.maps_url ? (
            <a href={loc.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#2563EB] hover:underline" data-testid="support-issue-maps">
              <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
            </a>
          ) : (
            <p className="text-[#6B7280]">No location available</p>
          )}
          {loc.maps_url ? <p className="text-[12px] text-[#6B7280]">Location at {fmt(loc.at)}</p> : null}
        </Section>

        <Section title="Customer">
          <Contact who="customer" person={d.customer} testId="support-issue-customer" />
        </Section>
      </div>

      {issue.state ? (
        <p className="rounded-[8px] bg-amber-50 px-2 py-1 text-[12px] font-semibold text-amber-900" data-testid="support-issue-state">
          {STATE_LABEL[issue.state] || issue.state}
        </p>
      ) : null}
      {actionMsg ? <p className="text-[12px] text-[#16A34A]" data-testid="support-issue-action-msg">{actionMsg}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canHandover ? (
          <>
            <button type="button" onClick={() => setHandoverMode("repost")} data-testid="support-issue-repost-btn"
              className="rounded-[10px] border border-[#111111] bg-white px-3 py-2 text-[13px] font-semibold text-[#111111] hover:bg-[#F3F4F6]">
              Re-post for handover
            </button>
            <button type="button" onClick={() => setHandoverMode("assign")} data-testid="support-issue-assign-btn"
              className="rounded-[10px] border border-[#111111] bg-white px-3 py-2 text-[13px] font-semibold text-[#111111] hover:bg-[#F3F4F6]">
              Assign to driver
            </button>
          </>
        ) : null}
        {canCancel ? (
          <button type="button" onClick={() => setCancelOpen(true)} data-testid="support-issue-admin-cancel-btn"
            className="rounded-[10px] border border-[#FCA5A5] bg-white px-3 py-2 text-[13px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]">
            Cancel booking (admin)
          </button>
        ) : null}
      </div>
      <HandoverDialog
        mode={handoverMode}
        details={d}
        onClose={() => setHandoverMode(null)}
        onDone={() => {
          setActionMsg(handoverMode === "repost" ? "Job re-posted for handover." : "Driver assigned for handover.");
          setHandoverMode(null);
          onChanged?.();
        }}
      />
      {cancelOpen ? (
        <AdminCancelDialog
          booking={{ id: d.booking_id }}
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false);
            onChanged?.();
          }}
        />
      ) : null}

      {resolved ? (
        <Section title="Resolved">
          <p data-testid="support-issue-resolved-info">
            {fmt(issue.resolved_at)}{issue.resolved_by_name ? ` by ${issue.resolved_by_name}` : ""}
          </p>
          {issue.resolution_note ? <p className="whitespace-pre-wrap">{issue.resolution_note}</p> : null}
        </Section>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Resolution note (optional)"
            data-testid="support-issue-resolve-note"
            className="w-full rounded-[10px] border border-[#E5E7EB] bg-white p-2 text-[13px] focus:border-[#111111] focus:outline-none"
          />
          {err ? <p className="text-[12px] text-[#DC2626]" data-testid="support-issue-resolve-error">{err}</p> : null}
          <button
            type="button"
            onClick={resolve}
            disabled={busy}
            data-testid="support-issue-resolve-btn"
            className="rounded-[10px] bg-[#111111] px-4 py-2 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {busy ? "Saving…" : "Mark resolved"}
          </button>
        </div>
      )}
    </div>
  );
}
