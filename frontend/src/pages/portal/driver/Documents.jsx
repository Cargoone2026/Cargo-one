import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  UploadCloud,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";

const DOC_LABELS = {
  driving_licence: "Driving Licence",
  insurance: "Insurance Certificate",
  vehicle_registration: "Vehicle Registration",
  vehicle_photos: "Vehicle Photos",
  profile_photo: "Profile Photo",
  proof_of_address: "Proof of Address",
};

function statusColor(s) {
  if (s === "approved") return { bg: "#DCFCE7", fg: "#16A34A", Icon: CheckCircle2, label: "Approved" };
  if (s === "rejected") return { bg: "#FEE2E2", fg: "#DC2626", Icon: XCircle, label: "Rejected" };
  return { bg: "#FEF3C7", fg: "#B45309", Icon: Clock, label: "Pending" };
}

export default function DriverDocuments() {
  const navigate = useNavigate();
  const [required, setRequired] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);
  const [err, setErr] = useState(null);
  const fileRefs = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api("/users/me/documents");
      setRequired(res.required || []);
      setDocs(res.documents || []);
    } catch (e) {
      setErr(e?.message || "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const byType = new Map();
  docs.forEach((d) => {
    if (!byType.has(d.doc_type)) byType.set(d.doc_type, d);
  });

  async function pick(docType, file) {
    if (!file) return;
    setUploadingType(docType);
    setErr(null);
    try {
      const data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await api("/users/me/documents", {
        method: "POST",
        body: { doc_type: docType, base64: data },
      });
      await load();
    } catch (e) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-documents">
      <header className="flex items-center gap-3 px-4 pt-6 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="docs-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">
          Verification Documents
        </h1>
      </header>

      <div className="mx-auto max-w-[720px] px-4 py-4 md:px-8">
        <div className="mb-4 flex items-start gap-3 rounded-[12px] bg-[#DBEAFE] p-4">
          <FileText className="h-5 w-5 text-[#2563EB]" />
          <p className="text-[13px] leading-relaxed text-[#111111]">
            Upload clear photos or scans of each required document. Files stay
            private and are used only for verification.
          </p>
        </div>

        {err && (
          <p className="mb-3 text-[13px] text-[#DC2626]" data-testid="docs-error">
            {err}
          </p>
        )}

        {loading && required.length === 0 ? (
          <p className="text-[13px] text-[#6B7280]">Loading required documents…</p>
        ) : (
          <ul className="space-y-3">
            {required.map((t) => {
              const doc = byType.get(t);
              const s = statusColor(doc?.status);
              return (
                <li
                  key={t}
                  className="rounded-[12px] border border-[#E5E7EB] p-4"
                  data-testid={`doc-row-${t}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#111111]">
                        {DOC_LABELS[t] || t}
                      </p>
                      {doc?.rejection_reason && (
                        <p className="mt-1 text-[12px] text-[#DC2626]">
                          {doc.rejection_reason}
                        </p>
                      )}
                      {doc?.uploaded_at && (
                        <p className="mt-1 text-[12px] text-[#6B7280]">
                          Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {doc ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.6px]"
                        style={{ backgroundColor: s.bg, color: s.fg }}
                      >
                        <s.Icon className="h-3.5 w-3.5" />
                        {s.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[#F4F4F4] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">
                        Missing
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRefs.current[t]?.click()}
                    data-testid={`doc-upload-${t}`}
                    disabled={uploadingType === t}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#111111] px-3 py-2 text-[13px] font-bold text-white hover:bg-[#1C1C1E] disabled:opacity-60"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {uploadingType === t
                      ? "Uploading…"
                      : doc
                      ? "Re-upload"
                      : "Upload"}
                  </button>
                  <input
                    ref={(el) => (fileRefs.current[t] = el)}
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={(e) => pick(t, e.target.files?.[0])}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
