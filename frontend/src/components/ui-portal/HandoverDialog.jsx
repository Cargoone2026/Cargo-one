import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

// Admin handover: re-post to the marketplace or assign directly to a chosen driver.
export function HandoverDialog({ mode, details, onClose, onDone }) {
  const issue = details?.issue || {};
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!mode) return;
    setAddress(issue.lat != null ? `Near ${Number(issue.lat).toFixed(5)}, ${Number(issue.lng).toFixed(5)}` : details?.pickup_address || "");
    setLat(issue.lat != null ? String(issue.lat) : "");
    setLng(issue.lng != null ? String(issue.lng) : "");
    setNote("");
    setErr(null);
    setDriverId(null);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== "assign") return;
    const t = setTimeout(() => {
      api(`/admin/bookings/${details.booking_id}/handover/candidates?q=${encodeURIComponent(q)}`)
        .then((rows) => setDrivers(Array.isArray(rows) ? rows : []))
        .catch(() => setDrivers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [mode, q, details?.booking_id]);

  if (!mode) return null;
  const latN = Number(lat);
  const lngN = Number(lng);
  const coordsOk = lat !== "" && lng !== "" && Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;
  const canSubmit = address.trim() && coordsOk && (mode === "repost" || driverId) && !busy;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api(`/admin/bookings/${details.booking_id}/handover/${mode}`, {
        method: "POST",
        body: { address: address.trim(), lat: latN, lng: lngN, note: note.trim() || null, driver_id: driverId },
      });
      onDone?.(r);
    } catch (e) {
      setErr(e?.message || "Could not complete the handover");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid={`handover-dialog-${mode}`} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[16px] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <h2 className="text-[17px] font-bold text-[#111111]">{mode === "repost" ? "Re-post for handover" : "Assign to driver"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" data-testid="handover-close" className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-[13px]">
          <p className="text-[#374151]">
            Price and payment stay as they are. The current driver is removed and can&apos;t take this job again. The customer is told a new driver is being arranged.
          </p>
          <label className="block">
            <span className="text-[12px] font-semibold text-[#374151]">New pickup (handover location)</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} data-testid="handover-address"
              className="mt-1 w-full rounded-[10px] border border-[#E5E7EB] p-2 focus:border-[#111111] focus:outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[12px] text-[#6B7280]">Latitude</span>
              <input value={lat} onChange={(e) => setLat(e.target.value)} data-testid="handover-lat" inputMode="decimal"
                className="mt-1 w-full rounded-[10px] border border-[#E5E7EB] p-2 focus:border-[#111111] focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-[12px] text-[#6B7280]">Longitude</span>
              <input value={lng} onChange={(e) => setLng(e.target.value)} data-testid="handover-lng" inputMode="decimal"
                className="mt-1 w-full rounded-[10px] border border-[#E5E7EB] p-2 focus:border-[#111111] focus:outline-none" />
            </label>
          </div>
          {coordsOk ? (
            <a href={`https://www.google.com/maps?q=${latN},${lngN}`} target="_blank" rel="noreferrer" className="text-[12px] text-[#2563EB] hover:underline" data-testid="handover-map-check">
              Check on Google Maps
            </a>
          ) : (
            <p className="text-[12px] text-[#DC2626]">Enter a valid latitude and longitude.</p>
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} data-testid="handover-note"
            placeholder="Note for the new driver (optional)"
            className="w-full rounded-[10px] border border-[#E5E7EB] p-2 focus:border-[#111111] focus:outline-none" />

          {mode === "assign" ? (
            <div className="space-y-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drivers by name, email or phone" data-testid="handover-driver-search"
                className="w-full rounded-[10px] border border-[#E5E7EB] p-2 focus:border-[#111111] focus:outline-none" />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {drivers.length === 0 ? <p className="text-[12px] text-[#6B7280]">No eligible drivers found.</p> : null}
                {drivers.map((d) => (
                  <label key={d.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border p-2 ${driverId === d.id ? "border-[#111111] bg-[#F9FAFB]" : "border-[#E5E7EB]"}`}
                    data-testid={`handover-driver-${d.id}`}>
                    <span className="flex items-center gap-2">
                      <input type="radio" name="handover_driver" checked={driverId === d.id} onChange={() => setDriverId(d.id)} />
                      <span>
                        <span className="font-semibold">{d.name}</span>
                        <span className="block text-[11px] text-[#6B7280]">{d.phone || d.email}{d.live_online ? " · online" : ""}</span>
                      </span>
                    </span>
                    <span className="text-[12px] text-[#6B7280]">{d.distance_miles != null ? `${d.distance_miles} mi` : "—"}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {err ? <p className="text-[12px] text-[#DC2626]" data-testid="handover-error">{err}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-full border border-[#E5E7EB] px-4 py-2 font-medium hover:bg-[#F9FAFB]" data-testid="handover-back">Back</button>
            <button type="button" onClick={submit} disabled={!canSubmit} data-testid="handover-confirm"
              className="rounded-full bg-[#111111] px-4 py-2 font-semibold text-white hover:bg-black disabled:opacity-60">
              {busy ? "Working…" : mode === "repost" ? "Re-post job" : "Assign driver"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
