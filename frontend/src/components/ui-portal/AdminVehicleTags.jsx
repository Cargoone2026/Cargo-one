import React, { useState } from "react";
import { api } from "@/lib/api";

// Vehicle groups shared by the admin Drivers list (chips/pills) and the DriverDetail tag editor.
export const VEHICLE_GROUPS = [
  { key: "car", label: "Car" },
  { key: "small_van", label: "Small van" },
  { key: "large_van", label: "Large van" },
  { key: "luton", label: "Luton" },
  { key: "recovery", label: "Recovery" },
  { key: "car_transporter", label: "Car transporter" },
  { key: "7_5t", label: "7.5T" },
  { key: "hgv", label: "HGV" },
  { key: "motorbike", label: "Motorbike" },
  { key: "other", label: "Other" },
];
export const VEHICLE_LABEL = Object.fromEntries(VEHICLE_GROUPS.map((g) => [g.key, g.label]));

// Admin-only manual vehicle tags (for drivers who haven't added a vehicle in the app). Saves only admin_vehicle_tags.
export function AdminVehicleTags({ driverId, initial = [] }) {
  const [tags, setTags] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const toggle = async (key) => {
    const next = tags.includes(key) ? tags.filter((t) => t !== key) : [...tags, key];
    setSaving(true);
    setMsg("");
    try {
      const res = await api(`/admin/drivers/${driverId}/vehicle-tags`, { method: "POST", body: { tags: next } });
      setTags(res?.admin_vehicle_tags || next);
      setMsg("Saved");
    } catch (e) {
      setMsg(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[14px] border border-[#E5E7EB] p-3" data-testid="admin-vehicle-tags">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">Vehicle tags (admin)</p>
        {msg ? <span className="text-[11px] text-[#6B7280]" data-testid="admin-vehicle-tags-msg">{msg}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {VEHICLE_GROUPS.map((g) => {
          const on = tags.includes(g.key);
          return (
            <button
              key={g.key}
              type="button"
              disabled={saving}
              onClick={() => toggle(g.key)}
              aria-pressed={on}
              data-testid={`admin-vehicle-tag-${g.key}`}
              className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-60 ${on ? "bg-[#111111] text-white" : "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]"}`}
            >
              {g.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
