import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  AlertTriangle,
  Ban,
  Check,
  FileText,
  ShieldCheck,
  X as XIcon,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";

const DOC_TYPE_LABELS = {
  driving_licence: "Driving Licence",
  insurance: "Motor Insurance",
  vehicle_registration: "Vehicle Registration (V5C)",
  vehicle_photos: "Vehicle Photos",
  profile_photo: "Profile Photo",
  proof_of_address: "Proof of Address",
  goods_in_transit: "Goods in Transit Insurance",
  public_liability: "Public Liability Insurance",
};
const ALL_DOC_TYPES = Object.keys(DOC_TYPE_LABELS);
const STATUS_PILL = {
  approved: { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  pending: { bg: "#FEF3C7", fg: "#92400E", label: "Pending review" },
  submitted: { bg: "#FEF3C7", fg: "#92400E", label: "Pending review" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" },
  changes_requested: { bg: "#FEE2E2", fg: "#991B1B", label: "Changes requested" },
  active: { bg: "#DCFCE7", fg: "#166534", label: "Active" },
  suspended: { bg: "#FEE2E2", fg: "#991B1B", label: "Suspended" },
};

export default function AdminDriverDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [preview, setPreview] = useState(null);
  const [modal, setModal] = useState(null); // { kind: "changes" | "suspend" }
  const [reason, setReason] = useState("");
  const [reasonDocs, setReasonDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  // R23 — surface driver cancellation history + count on the admin detail page.
  const [cancels, setCancels] = useState({ count: 0, cancellations: [] });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api(`/admin/drivers/${id}`);
      setData(res);
      try {
        const canc = await api(`/admin/driver-cancellations?driver_id=${encodeURIComponent(id)}`);
        setCancels({
          count: canc?.count || 0,
          cancellations: canc?.cancellations || [],
        });
      } catch {
        setCancels({ count: 0, cancellations: [] });
      }
    } catch (e) {
      setErr(e?.message || "Could not load driver");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const approveDoc = async (docId) => {
    setBusy(true);
    try {
      await api(`/admin/documents/${docId}/review`, {
        method: "POST",
        body: { action: "approve" },
      });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Approve failed");
    } finally {
      setBusy(false);
    }
  };
  const rejectDoc = async (docId) => {
    // eslint-disable-next-line no-alert
    const reasonText = window.prompt("Reject reason (≥5 chars):", "Photo unclear");
    if (!reasonText || reasonText.trim().length < 5) return;
    setBusy(true);
    try {
      await api(`/admin/documents/${docId}/review`, {
        method: "POST",
        body: { action: "reject", reason: reasonText.trim() },
      });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Reject failed");
    } finally {
      setBusy(false);
    }
  };
  const approveDriver = async () => {
    setBusy(true);
    try {
      await api(`/admin/users/${id}/approve`, { method: "POST" });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Approve failed");
    } finally {
      setBusy(false);
    }
  };
  const submitReason = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) return;
    setBusy(true);
    try {
      const path =
        modal.kind === "changes"
          ? `/admin/users/${id}/request-changes`
          : `/admin/users/${id}/suspend`;
      const body = { reason: trimmed };
      if (modal.kind === "changes") body.doc_types = reasonDocs;
      await api(path, { method: "POST", body });
      setModal(null);
      setReason("");
      setReasonDocs([]);
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-4 pt-6 md:px-8" data-testid="admin-driver-detail">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="admin-driver-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <p className="mt-6 text-[13px] text-[#6B7280]">Loading driver…</p>
      </div>
    );
  }
  if (err || !data?.user) {
    return (
      <div className="min-h-screen bg-white px-4 pt-6 md:px-8" data-testid="admin-driver-detail">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="admin-driver-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <p className="mt-6 text-[13px] text-[#DC2626]">{err || "Driver not found"}</p>
      </div>
    );
  }

  const { user, documents = [], fleet = [], stats = {} } = data;
  const uploadedTypes = new Set(documents.map((d) => d.doc_type));
  const missing = ALL_DOC_TYPES.filter((k) => !uploadedTypes.has(k));
  const statusMeta = STATUS_PILL[user.status] || { bg: "#F4F4F4", fg: "#111111", label: user.status };

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-driver-detail">
      <header className="flex items-center gap-3 px-4 pt-6 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="admin-driver-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">Driver review</h1>
      </header>

      <div className="mx-auto max-w-[900px] space-y-4 px-4 pt-4 md:px-8">
        {/* Profile */}
        <section
          className="flex items-center gap-3 rounded-[14px] border border-[#E5E7EB] p-4"
          data-testid="admin-driver-profile"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D62828] text-[22px] font-bold text-white">
            {user.profile_photo ? (
              <img src={user.profile_photo} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              (user.name || "?")[0]?.toUpperCase()
            )}
          </span>
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-[#111111]">{user.name}</h2>
            <p className="text-[13px] text-[#6B7280]">{user.email}</p>
            {user.phone && <p className="text-[13px] text-[#6B7280]">{user.phone}</p>}
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]"
                style={{ backgroundColor: statusMeta.bg, color: statusMeta.fg }}
              >
                {statusMeta.label}
              </span>
              {user.verified_driver && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-2 py-0.5 text-[10px] font-bold text-white">
                  <ShieldCheck className="h-3 w-3" />
                  VERIFIED
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Bookings" value={String(stats.completed_bookings ?? 0)} />
          <Stat label="Earnings" value={`£${Number(stats.total_earnings ?? 0).toFixed(0)}`} />
          <Stat label="Rating" value={`${Number(stats.rating ?? user.rating ?? 5).toFixed(1)}★`} />
          <Stat
            label="Cancellations"
            value={String(cancels.count)}
            testID="driver-cancellation-count"
          />
        </div>

        {/* R23 — Cancellation history preview (last 5 rows). Full list on the
            dedicated Cancellations page filtered by this driver. */}
        {cancels.count > 0 ? (
          <section
            className="rounded-[16px] border border-[#E5E7EB] bg-white p-4"
            data-testid="driver-cancellation-history-section"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
                <h3 className="text-[15px] font-bold text-[#111111]">
                  Recent cancellations
                </h3>
                <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626]">
                  {cancels.count} total
                </span>
              </div>
              <Link
                to={`/admin/driver-cancellations?driver_id=${encodeURIComponent(id)}`}
                data-testid="admin-view-all-cancellations"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#111111] underline hover:text-[#D62828]"
              >
                View all
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="divide-y divide-[#F3F4F6]">
              {cancels.cancellations.slice(0, 5).map((c) => (
                <li key={c.id} className="py-2" data-testid={`driver-cancel-row-${c.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111111]">
                        {c.reason_label || c.reason}
                      </p>
                      {c.explanation ? (
                        <p className="mt-0.5 text-[12px] italic text-[#6B7280]">
                          "{c.explanation}"
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                        {(c.service_timing || "").toUpperCase() || "—"} · Booking {c.booking_id?.slice(0, 8)}…
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-[11px] text-[#6B7280]">
                      {formatWhen(c.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Action bar */}
        {user.role === "driver" && (
          <div className="flex flex-wrap gap-2" data-testid="admin-action-row">
            {user.status !== "active" && (
              <Button
                title="Approve driver"
                variant="primary"
                fullWidth={false}
                small
                loading={busy}
                onClick={approveDriver}
                testID="admin-approve-driver"
              >
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  Approve driver
                </span>
              </Button>
            )}
            <Button
              title="Request changes"
              variant="outline"
              fullWidth={false}
              small
              onClick={() => {
                setModal({ kind: "changes" });
                setReason("");
                setReasonDocs([]);
              }}
              testID="admin-request-changes"
            />
            {user.status !== "suspended" && (
              <Button
                title="Suspend"
                variant="outline"
                fullWidth={false}
                small
                onClick={() => {
                  setModal({ kind: "suspend" });
                  setReason("");
                }}
                testID="admin-suspend-driver"
              >
                <span className="inline-flex items-center gap-1">
                  <Ban className="h-3.5 w-3.5" />
                  Suspend
                </span>
              </Button>
            )}
          </div>
        )}

        {/* Documents */}
        <h3 className="pt-2 text-[18px] font-bold text-[#111111]">Documents</h3>
        <ul className="space-y-3">
          {documents.map((doc) => {
            const s = STATUS_PILL[doc.status] || { bg: "#F4F4F4", fg: "#111111", label: doc.status };
            return (
              <li
                key={doc.id}
                className="rounded-[12px] border border-[#E5E7EB] p-4"
                data-testid={`admin-doc-${doc.doc_type}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[#111111]">
                      {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                    </p>
                    <p className="text-[12px] text-[#6B7280]">
                      Uploaded {new Date(doc.uploaded_at || doc.created_at).toLocaleString()}
                    </p>
                    {doc.rejection_reason && (
                      <p className="mt-1 text-[12px] text-[#DC2626]">
                        {doc.rejection_reason}
                      </p>
                    )}
                  </div>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]"
                    style={{ backgroundColor: s.bg, color: s.fg }}
                  >
                    {s.label}
                  </span>
                </div>
                {doc.base64 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview(doc.base64)}
                      data-testid={`preview-doc-${doc.doc_type}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[#F4F4F4] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#E5E7EB]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    {doc.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => approveDoc(doc.id)}
                        disabled={busy}
                        data-testid={`approve-doc-${doc.doc_type}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#15803D] disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    )}
                    {doc.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => rejectDoc(doc.id)}
                        disabled={busy}
                        data-testid={`reject-doc-${doc.doc_type}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#DC2626] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#B91C1C] disabled:opacity-60"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {missing.length > 0 && (
            <li className="rounded-[12px] border border-dashed border-[#FDE68A] bg-[#FFFBEB] p-4" data-testid="admin-doc-missing">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[#F59E0B]" />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#78350F]">
                    {missing.length} document{missing.length === 1 ? "" : "s"} missing
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[12px] text-[#78350F]">
                    {missing.map((m) => (
                      <li key={m}>• {DOC_TYPE_LABELS[m] || m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          )}
        </ul>
      </div>

      {/* Reason modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          role="dialog"
          aria-modal="true"
          data-testid={`admin-reason-modal-${modal.kind}`}
        >
          <div className="flex max-h-[90vh] w-full flex-col overflow-hidden bg-white sm:max-w-[520px] sm:rounded-[20px]">
            <header className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
              <div className="flex-1">
                <p className="text-[11px] font-bold tracking-[1.5px] text-[#D62828]">
                  {modal.kind === "changes" ? "REQUEST CHANGES" : "SUSPEND DRIVER"}
                </p>
                <h2 className="text-[18px] font-bold text-[#111111]">
                  Provide a clear reason
                </h2>
              </div>
              <button type="button" onClick={() => setModal(null)} aria-label="Close" data-testid="admin-reason-close">
                <XIcon className="h-5 w-5 text-[#111111]" />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {modal.kind === "changes" && (
                <div>
                  <p className="mb-1 text-[13px] font-semibold text-[#111111]">
                    Which documents need changes?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DOC_TYPES.map((k) => {
                      const on = reasonDocs.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() =>
                            setReasonDocs((p) =>
                              on ? p.filter((x) => x !== k) : [...p, k],
                            )
                          }
                          data-testid={`reason-doc-${k}`}
                          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                            on ? "bg-[#111111] text-white" : "bg-[#F4F4F4] text-[#111111]"
                          }`}
                        >
                          {DOC_TYPE_LABELS[k] || k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                  Reason (≥10 characters)
                </span>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain your decision"
                  data-testid="admin-reason-input"
                  className="w-full resize-none rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px] outline-none focus:border-[#111111]"
                />
              </label>
            </div>
            <footer className="flex gap-2 border-t border-[#E5E7EB] p-3">
              <Button title="Cancel" variant="ghost" fullWidth={false} onClick={() => setModal(null)} testID="admin-reason-cancel" />
              <Button
                title={modal.kind === "changes" ? "Send request" : "Suspend"}
                variant="primary"
                loading={busy}
                disabled={reason.trim().length < 10}
                onClick={submitReason}
                testID="admin-reason-submit"
              />
            </footer>
          </div>
        </div>
      )}

      {/* Doc preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3"
          role="dialog"
          data-testid="admin-doc-preview"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-full max-w-3xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            {preview.startsWith("data:image") ? (
              <img src={preview} alt="doc" className="max-h-[80vh] max-w-full object-contain" />
            ) : (
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#111111]"
              >
                <ExternalLink className="h-4 w-4" />
                Open document
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, testID }) {
  return (
    <div className="rounded-[10px] bg-[#F9FAFB] p-3" data-testid={testID}>
      <p className="text-[18px] font-bold text-[#111111]">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">{label}</p>
    </div>
  );
}

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
    if (diff < 7 * 86400_000) return `${Math.round(diff / 86400_000)}d ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch (_e) {
    return iso;
  }
}
