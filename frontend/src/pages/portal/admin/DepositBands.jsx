import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X as XIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";

export default function AdminDepositBands() {
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
      const list = await api("/admin/deposit-bands").catch(() => []);
      setBands(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const runPreview = useCallback(async (p) => {
    const num = Number(p);
    if (Number.isNaN(num) || num < 0) return setPreview(null);
    try {
      const r = await api(`/deposit-bands/preview?price=${num}`);
      setPreview(r);
    } catch {
      setPreview(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    runPreview(previewPrice);
  }, [previewPrice, bands, runPreview]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErr(null);
    try {
      const body = {
        min_price: Number(editing.min_price) || 0,
        max_price: editing.max_price === "" || editing.max_price == null ? null : Number(editing.max_price),
        deposit_amount: Number(editing.deposit_amount) || 0,
        enabled: !!editing.enabled,
        label: editing.label || null,
      };
      if (editing.id) {
        await api(`/admin/deposit-bands/${editing.id}`, { method: "PUT", body });
      } else {
        await api("/admin/deposit-bands", { method: "POST", body });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (b) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete band ${b.label || `£${b.min_price}–${b.max_price ?? "∞"}`}?`))
      return;
    try {
      await api(`/admin/deposit-bands/${b.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Delete failed");
    }
  };
  const toggle = async (b) => {
    try {
      await api(`/admin/deposit-bands/${b.id}`, {
        method: "PUT",
        body: {
          min_price: b.min_price,
          max_price: b.max_price,
          deposit_amount: b.deposit_amount,
          enabled: !b.enabled,
          label: b.label,
        },
      });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Toggle failed");
    }
  };

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-deposit-bands">
      <header className="flex items-start justify-between gap-3 px-4 pt-6 md:px-8">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
            Booking Fee Bands
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            {bands.length} band{bands.length === 1 ? "" : "s"} · Backend is authoritative
            for calculations.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              min_price: 0,
              max_price: "",
              deposit_amount: 0,
              enabled: true,
              label: "",
            })
          }
          aria-label="Add band"
          data-testid="band-add"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="mx-4 mt-3 rounded-[12px] bg-[#F9FAFB] p-4 md:mx-8" data-testid="band-preview">
        <p className="text-[13px] font-semibold text-[#111111]">Preview calculator</p>
        <div className="mt-2 flex items-end gap-2">
          <Input
            label="Driver charge (£)"
            value={previewPrice}
            onChange={(e) => setPreviewPrice(e.target.value)}
            inputMode="decimal"
            testID="band-preview-price"
          />
          {preview && (
            <div className="mb-1 text-right text-[13px] text-[#111111]">
              Booking fee:{" "}
              <span className="text-[16px] font-bold text-[#D62828]">
                £{Number(preview.deposit_amount ?? preview.booking_fee ?? 0).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {loading && bands.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading bands…</li>
        ) : bands.length === 0 ? (
          <li
            className="rounded-[12px] bg-[#F9FAFB] p-6 text-center text-[13px] text-[#6B7280]"
            data-testid="bands-empty"
          >
            No bands configured. Fallback percentage applies.
          </li>
        ) : (
          bands.map((b) => (
            <li
              key={b.id}
              className="rounded-[12px] border border-[#E5E7EB] p-4"
              data-testid={`band-row-${b.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[#111111]">
                    {b.label || "Untitled band"}
                  </p>
                  <p className="text-[12px] text-[#6B7280]">
                    £{Number(b.min_price).toFixed(2)} —{" "}
                    {b.max_price != null ? `£${Number(b.max_price).toFixed(2)}` : "∞"}
                  </p>
                </div>
                <p className="text-[20px] font-bold text-[#111111]">
                  £{Number(b.deposit_amount).toFixed(2)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggle(b)}
                  data-testid={`band-toggle-${b.id}`}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.5px] ${
                    b.enabled
                      ? "bg-[#DCFCE7] text-[#16A34A]"
                      : "bg-[#FEE2E2] text-[#DC2626]"
                  }`}
                >
                  {b.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ ...b, max_price: b.max_price ?? "" })}
                  data-testid={`band-edit-${b.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F4F4F4] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#E5E7EB]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(b)}
                  data-testid={`band-delete-${b.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FECACA]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          role="dialog"
          data-testid="band-modal"
        >
          <div className="flex max-h-[92vh] w-full flex-col overflow-hidden bg-white sm:max-w-[520px] sm:rounded-[20px]">
            <header className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
              <h2 className="flex-1 text-[18px] font-bold text-[#111111]">
                {editing.id ? "Edit band" : "New band"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setErr(null);
                }}
                aria-label="Close"
                data-testid="band-modal-close"
              >
                <XIcon className="h-5 w-5 text-[#111111]" />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <Input
                label="Label"
                value={editing.label || ""}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                testID="band-input-label"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Min price (£)"
                  value={editing.min_price ?? ""}
                  onChange={(e) => setEditing({ ...editing, min_price: e.target.value })}
                  inputMode="decimal"
                  testID="band-input-min"
                />
                <Input
                  label="Max price (£, blank = ∞)"
                  value={editing.max_price ?? ""}
                  onChange={(e) => setEditing({ ...editing, max_price: e.target.value })}
                  inputMode="decimal"
                  testID="band-input-max"
                />
              </div>
              <Input
                label="Booking fee (£)"
                value={editing.deposit_amount ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, deposit_amount: e.target.value })
                }
                inputMode="decimal"
                testID="band-input-fee"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                  data-testid="band-input-enabled"
                />
                <span className="text-[13px] text-[#111111]">Enabled</span>
              </label>
              {err && (
                <p className="text-[13px] text-[#DC2626]" data-testid="band-modal-error">
                  {err}
                </p>
              )}
            </div>
            <footer className="flex gap-2 border-t border-[#E5E7EB] p-3">
              <Button
                title="Cancel"
                variant="ghost"
                fullWidth={false}
                onClick={() => {
                  setEditing(null);
                  setErr(null);
                }}
                testID="band-modal-cancel"
              />
              <Button
                title={editing.id ? "Save" : "Create"}
                variant="primary"
                loading={saving}
                onClick={save}
                testID="band-modal-save"
              />
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
