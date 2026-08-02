/**
 * Admin — Booking-Fee Bands (Session F, percentage tiers).
 *
 * The single source of truth for every booking fee on the platform.
 * The backend seeds the default 5 tiers (£0-150 → 15% … £1000+ → 10%)
 * on first boot; admins own the collection from that point onward.
 *
 * Each booking snapshots the tier % at creation time so historical
 * bookings retain the rate that was live when the customer paid.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X as XIcon, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";

export default function AdminBookingFeeBands() {
  const [bands, setBands] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewPrice, setPreviewPrice] = useState("500");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api("/admin/booking-fee-bands").catch(() => []);
      setBands(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const runPreview = useCallback(async (p) => {
    const num = Number(p);
    if (Number.isNaN(num) || num < 0) return setPreview(null);
    try {
      const r = await api(`/booking-fee-bands/preview?driver_charge=${num}`);
      setPreview(r);
    } catch {
      setPreview(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { runPreview(previewPrice); }, [previewPrice, bands, runPreview]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErr(null);
    try {
      const body = {
        min_amount: Number(editing.min_amount) || 0,
        max_amount: editing.max_amount === "" || editing.max_amount == null ? null : Number(editing.max_amount),
        booking_fee_percent: Number(editing.booking_fee_percent) || 0,
        enabled: !!editing.enabled,
        label: editing.label || null,
        priority: editing.priority == null ? null : Number(editing.priority),
      };
      if (editing.id) {
        await api(`/admin/booking-fee-bands/${editing.id}`, { method: "PUT", body });
      } else {
        await api("/admin/booking-fee-bands", { method: "POST", body });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (band) => {
    if (!band?.id) return;
    if (!window.confirm(`Delete band "${band.label || band.min_amount}"?`)) return;
    await api(`/admin/booking-fee-bands/${band.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-booking-fee-bands">
      <div className="mx-auto max-w-[960px] px-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-[24px] font-bold text-[#111111]">
              <TrendingUp className="h-6 w-6 text-[#D62828]" />
              Booking-Fee Bands
            </h1>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              Percentage tiers applied to every booking on the platform. Changes take effect for new bookings only —
              historical bookings retain the % that was live when they were created.
            </p>
          </div>
          <Button
            data-testid="admin-band-add-btn"
            onClick={() =>
              setEditing({
                min_amount: 0,
                max_amount: "",
                booking_fee_percent: 15,
                enabled: true,
                label: "",
                priority: bands.length,
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add band
          </Button>
        </div>

        {/* Live preview */}
        <div className="mt-4 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">Live preview</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="text-[13px] text-[#374151]">
              Driver charge £
              <input
                type="number"
                value={previewPrice}
                onChange={(e) => setPreviewPrice(e.target.value)}
                className="ml-2 w-28 rounded-[8px] border border-[#E5E7EB] bg-white px-2 py-1 text-[13px]"
                data-testid="admin-band-preview-input"
                min="0"
                step="1"
              />
            </label>
            {preview ? (
              <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#111111]">
                <span>Fee <b>{Number(preview.booking_fee_percent).toFixed(0)}%</b> =
                  <b> £{Number(preview.booking_fee).toFixed(2)}</b></span>
                <span className="text-[#6B7280]">Total <b>£{Number(preview.customer_total).toFixed(2)}</b></span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  preview.booking_fee_source === "booking_fee_bands"
                    ? "bg-emerald-50 text-emerald-700"
                    : preview.booking_fee_source === "deposit_bands"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-neutral-100 text-neutral-600"
                }`}>{preview.booking_fee_source}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bands table */}
        <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#E5E7EB]">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="bg-[#F9FAFB] text-[#6B7280]">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Min £</th>
                <th className="px-3 py-2">Max £</th>
                <th className="px-3 py-2">Fee %</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-[#6B7280]">Loading…</td></tr>
              ) : bands.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-[#6B7280]">No bands yet. Click "Add band".</td></tr>
              ) : bands.map((b) => (
                <tr key={b.id} className="border-t border-[#F3F4F6]" data-testid={`admin-band-row-${b.id}`}>
                  <td className="px-3 py-2">{b.label || "—"}</td>
                  <td className="px-3 py-2">£{Number(b.min_amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-2">{b.max_amount == null ? "∞" : `£${Number(b.max_amount).toFixed(2)}`}</td>
                  <td className="px-3 py-2 font-semibold">{Number(b.booking_fee_percent).toFixed(1)}%</td>
                  <td className="px-3 py-2">{b.priority ?? 0}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.enabled ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {b.enabled ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button className="mr-2 rounded p-1 hover:bg-[#F3F4F6]" onClick={() => setEditing(b)} data-testid={`admin-band-edit-${b.id}`}>
                      <Pencil className="h-4 w-4 text-[#6B7280]" />
                    </button>
                    <button className="rounded p-1 hover:bg-[#FEE2E2]" onClick={() => remove(b)} data-testid={`admin-band-delete-${b.id}`}>
                      <Trash2 className="h-4 w-4 text-[#DC2626]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-[420px] rounded-[16px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[18px] font-bold">{editing.id ? "Edit band" : "New band"}</h2>
              <button onClick={() => setEditing(null)}><XIcon className="h-5 w-5 text-[#6B7280]" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 block">
                <span className="mb-1 block text-[11px] font-semibold text-[#374151]">Label</span>
                <Input value={editing.label || ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} data-testid="admin-band-label" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-[#374151]">Min amount £</span>
                <Input type="number" value={editing.min_amount ?? ""} onChange={(e) => setEditing({ ...editing, min_amount: e.target.value })} data-testid="admin-band-min" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-[#374151]">Max amount £ (blank = ∞)</span>
                <Input type="number" value={editing.max_amount ?? ""} onChange={(e) => setEditing({ ...editing, max_amount: e.target.value })} data-testid="admin-band-max" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-[#374151]">Fee %</span>
                <Input type="number" value={editing.booking_fee_percent ?? ""} onChange={(e) => setEditing({ ...editing, booking_fee_percent: e.target.value })} data-testid="admin-band-pct" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-[#374151]">Priority</span>
                <Input type="number" value={editing.priority ?? 0} onChange={(e) => setEditing({ ...editing, priority: e.target.value })} data-testid="admin-band-priority" />
              </label>
              <label className="col-span-2 flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={!!editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} data-testid="admin-band-enabled" />
                Enabled
              </label>
            </div>
            {err ? <p className="mt-2 text-[12px] font-medium text-[#DC2626]">{err}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-[8px] px-3 py-2 text-[13px] text-[#6B7280] hover:bg-[#F3F4F6]" onClick={() => setEditing(null)}>Cancel</button>
              <Button onClick={save} disabled={saving} data-testid="admin-band-save">
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
