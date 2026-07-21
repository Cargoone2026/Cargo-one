import React, { useCallback, useEffect, useState } from "react";
import { Plus, Truck, Trash2, Star, X as XIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useVehicles, useCapabilities } from "@/hooks/useCatalog";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";

export default function DriverFleet() {
  const { data: vehicles } = useVehicles();
  const { data: capabilities } = useCapabilities();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/driver/vehicles").catch(() => []);
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (v) => {
    setSaving(true);
    setErr(null);
    try {
      const path = v.id ? `/driver/vehicles/${v.id}` : "/driver/vehicles";
      await api(path, { method: v.id ? "PUT" : "POST", body: v });
      setEditing(null);
      await load();
    } catch (e) {
      setErr(e?.message || "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v) => {
    if (!v.id) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remove ${v.registration} from your fleet?`)) return;
    try {
      await api(`/driver/vehicles/${v.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Could not remove vehicle");
    }
  };

  const openNew = () =>
    setEditing({
      vehicle_type_key: vehicles[0]?.key || "",
      registration: "",
      capabilities: [],
      photos: [],
    });

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-fleet">
      <header className="flex items-start justify-between gap-3 px-4 pt-6 md:px-8">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
            My Fleet
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Register your vehicles so we can match you to the right jobs.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          data-testid="fleet-add"
          aria-label="Add vehicle"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="mx-4 mt-4 md:mx-8">
        {loading && items.length === 0 ? (
          <p className="text-[13px] text-[#6B7280]">Loading fleet…</p>
        ) : items.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-[#E5E7EB] p-8 text-center"
            data-testid="fleet-empty"
          >
            <Truck className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[15px] font-semibold text-[#111111]">
              No vehicles yet
            </p>
            <p className="text-[13px] text-[#6B7280]">
              Tap the ＋ to register your first vehicle.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((v) => (
              <li
                key={v.id}
                className="rounded-[12px] border border-[#E5E7EB] p-4"
                data-testid={`fleet-veh-${v.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[16px] font-semibold text-[#111111]">
                        {v.vehicle_type_name || v.vehicle_type_key}
                      </p>
                      {v.is_default && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#E55E00]">
                          <Star className="h-3 w-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#6B7280]">
                      Reg: {v.registration || "—"} · {v.make || ""} {v.model || ""}
                    </p>
                    {v.capabilities?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {v.capabilities.map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-[#F4F4F4] px-2 py-0.5 text-[11px] text-[#111111]"
                          >
                            {c.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                      v.status === "active"
                        ? "bg-[#DCFCE7] text-[#16A34A]"
                        : "bg-[#FEF3C7] text-[#B45309]"
                    }`}
                  >
                    {v.status || "—"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    title="Edit"
                    variant="ghost"
                    small
                    fullWidth={false}
                    onClick={() => setEditing({ ...v })}
                    testID={`fleet-edit-${v.id}`}
                  />
                  <Button
                    title="Remove"
                    variant="outline"
                    small
                    fullWidth={false}
                    onClick={() => remove(v)}
                    testID={`fleet-remove-${v.id}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <VehicleModal
          value={editing}
          types={vehicles}
          caps={capabilities}
          saving={saving}
          err={err}
          onCancel={() => {
            setEditing(null);
            setErr(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function VehicleModal({ value, types, caps, saving, err, onCancel, onSave }) {
  const [v, setV] = useState(value);
  const patch = (p) => setV((prev) => ({ ...prev, ...p }));
  const toggleCap = (k) =>
    setV((prev) => {
      const list = new Set(prev.capabilities || []);
      list.has(k) ? list.delete(k) : list.add(k);
      return { ...prev, capabilities: Array.from(list) };
    });

  const canSave = v.vehicle_type_key && v.registration?.trim();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      data-testid="fleet-modal"
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden bg-white sm:max-w-[560px] sm:rounded-[20px]">
        <header className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex-1">
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#D62828]">
              {v.id ? "EDIT VEHICLE" : "ADD VEHICLE"}
            </p>
            <h2 className="text-[18px] font-bold text-[#111111]">
              {v.vehicle_type_name || "Register vehicle"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            data-testid="fleet-modal-close"
            className="rounded-full p-2 hover:bg-[#F4F4F4]"
          >
            <XIcon className="h-5 w-5 text-[#111111]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
              Vehicle type
            </span>
            <select
              value={v.vehicle_type_key}
              onChange={(e) => patch({ vehicle_type_key: e.target.value })}
              data-testid="fleet-vehicle-type"
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-[14px]"
            >
              {types.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Registration"
            value={v.registration || ""}
            onChange={(e) => patch({ registration: e.target.value.toUpperCase() })}
            placeholder="AB12 CDE"
            testID="fleet-registration"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Make"
              value={v.make || ""}
              onChange={(e) => patch({ make: e.target.value })}
              testID="fleet-make"
            />
            <Input
              label="Model"
              value={v.model || ""}
              onChange={(e) => patch({ model: e.target.value })}
              testID="fleet-model"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Year"
              value={v.year || ""}
              onChange={(e) => patch({ year: Number(e.target.value) || null })}
              inputMode="numeric"
              testID="fleet-year"
            />
            <Input
              label="Payload (kg)"
              value={v.payload_kg || ""}
              onChange={(e) => patch({ payload_kg: Number(e.target.value) || null })}
              inputMode="numeric"
              testID="fleet-payload"
            />
          </div>
          <div>
            <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
              Capabilities
            </span>
            <div className="flex flex-wrap gap-2">
              {caps.map((c) => {
                const on = (v.capabilities || []).includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCap(c.key)}
                    data-testid={`fleet-cap-${c.key}`}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                      on
                        ? "bg-[#111111] text-white"
                        : "bg-white text-[#111111] border border-[#E5E7EB]"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!v.is_default}
              onChange={(e) => patch({ is_default: e.target.checked })}
              data-testid="fleet-default"
            />
            <span className="text-[13px] text-[#111111]">Set as default vehicle</span>
          </label>
          {err && (
            <p className="text-[13px] text-[#DC2626]" data-testid="fleet-modal-error">
              {err}
            </p>
          )}
        </div>
        <footer className="flex gap-2 border-t border-[#E5E7EB] p-3">
          <Button
            title="Cancel"
            variant="ghost"
            fullWidth={false}
            onClick={onCancel}
            testID="fleet-modal-cancel"
          />
          <Button
            title={v.id ? "Save changes" : "Add vehicle"}
            variant="primary"
            loading={saving}
            disabled={!canSave}
            onClick={() => onSave(v)}
            testID="fleet-modal-save"
          />
        </footer>
      </div>
    </div>
  );
}
