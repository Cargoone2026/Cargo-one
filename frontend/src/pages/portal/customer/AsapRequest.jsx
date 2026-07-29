import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, MapPin, Truck, Zap, ShieldCheck, AlertTriangle,
  Locate, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { AddressAutocomplete } from "@/components/ui-portal/AddressAutocomplete";
import { RouteMap } from "@/components/ui-portal/RouteMap";

/**
 * CargoOne — ASAP / Real-time Dispatch request page.
 *
 * Focused UX: customer chooses ASAP timing, optionally flips to Breakdown
 * Recovery mode, uses their current location for pickup, sees a
 * confirmation with the backend-computed price, then commits by paying the
 * deposit. Once paid, they hand off to `/customer/dispatch/{jobId}` which
 * polls until a driver claims the job.
 *
 * We DO NOT recompute pricing here — every commercial value is read from
 * the backend job response.
 */
export default function CustomerAsapRequest() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("transport"); // transport | breakdown_recovery
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [note, setNote] = useState("");
  const [vehicle, setVehicle] = useState({
    make: "", model: "", registration: "", condition: "will_not_start",
    rolls: "unknown", steers: "unknown", brakes: "unknown",
  });
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const useCurrentLocation = useCallback(async () => {
    setLocError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Location not supported on this device");
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          // Reuse the existing backend geocode/reverse if available; otherwise
          // set a minimal address the customer can edit before submit.
          setPickup({
            address: `Current location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            town: "Current location",
            lat: latitude,
            lng: longitude,
          });
        } finally {
          setLocBusy(false);
        }
      },
      (e) => {
        setLocError(
          e.code === 1 ? "Location permission denied" : "Could not get location"
        );
        setLocBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const canSubmit = useMemo(() => {
    if (!pickup || !dropoff) return false;
    if (mode === "breakdown_recovery") {
      if (!vehicle.make || !vehicle.model) return false;
    }
    return true;
  }, [pickup, dropoff, mode, vehicle]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      // Category maps sensibly: breakdown → cars; transport → parcels default.
      const category = mode === "breakdown_recovery" ? "cars" : "parcels";
      const distanceMiles = haversineMiles(
        pickup.lat, pickup.lng, dropoff.lat, dropoff.lng
      );
      // Suggested fixed price mirrors backend formula (max(30, 1.5 * dist * mult))
      // ONLY as an initial hint — backend recomputes authoritatively.
      const mult = mode === "breakdown_recovery" ? 2.0 : 1.0;
      const suggested = Math.max(30, Math.round(distanceMiles * 1.5 * mult));

      const created = await api("/jobs", {
        method: "POST",
        body: {
          title: mode === "breakdown_recovery" ? "ASAP Vehicle Recovery" : "ASAP Delivery",
          description: note || "ASAP request",
          category,
          service_timing: "asap",
          service_type: mode,
          vehicle_details: mode === "breakdown_recovery" ? vehicle : null,
          customer_note: note || null,
          pickup_address: pickup.address,
          pickup_town: pickup.town || "Pickup",
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_address: dropoff.address,
          dropoff_town: dropoff.town || "Dropoff",
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          weight_kg: mode === "breakdown_recovery" ? 1500 : 20,
          collection_date: new Date().toISOString(),
          delivery_date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          pricing_type: "fixed",
          fixed_price: suggested,
        },
      });
      // Create booking immediately (ASAP flow) — server allows pre-claim booking.
      const booking = await api("/bookings", {
        method: "POST",
        body: { job_id: created.id },
      });
      // Redirect straight to the deposit checkout — matches the scheduled path.
      const origin = window.location.origin;
      const dep = await api(`/bookings/${booking.id}/deposit`, {
        method: "POST",
        body: { origin_url: origin },
      });
      // After Stripe redirect back to /customer/booking/{id}?payment=success,
      // the BookingDetail polls status. Once paid, dispatch_ready_at is stamped
      // and the customer should see the driver-search screen. We also stash
      // the job id so the redirect target can bounce there.
      try {
        sessionStorage.setItem(`asap:${booking.id}`, created.id);
      } catch { /* ignore */ }
      if (dep && dep.url) {
        window.location.href = dep.url;
      } else {
        navigate(`/customer/booking/${booking.id}`);
      }
    } catch (e) {
      setErr(e?.message || "Could not create request");
      setSubmitting(false);
    }
  }, [canSubmit, mode, note, vehicle, pickup, dropoff, navigate]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6" data-testid="customer-asap-request">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
        data-testid="asap-back"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-5 w-5 text-amber-500" />
        <h1 className="text-2xl font-semibold tracking-tight">Request now — ASAP</h1>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Find a nearby CargoOne driver in real time.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode("transport")}
          className={`rounded-2xl border p-4 text-left transition ${
            mode === "transport"
              ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
              : "border-neutral-200 bg-white hover:border-neutral-400"
          }`}
          data-testid="asap-mode-transport"
        >
          <Truck className="h-5 w-5 mb-2" />
          <div className="font-medium">Transport</div>
          <div className={`text-xs mt-1 ${mode === "transport" ? "text-white/70" : "text-neutral-500"}`}>
            Urgent parcel, consignment or same-day movement
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode("breakdown_recovery")}
          className={`rounded-2xl border p-4 text-left transition ${
            mode === "breakdown_recovery"
              ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
              : "border-neutral-200 bg-white hover:border-neutral-400"
          }`}
          data-testid="asap-mode-recovery"
        >
          <AlertTriangle className="h-5 w-5 mb-2" />
          <div className="font-medium">Vehicle Recovery</div>
          <div className={`text-xs mt-1 ${mode === "breakdown_recovery" ? "text-white/70" : "text-neutral-500"}`}>
            Stranded vehicle, breakdown or recovery
          </div>
        </button>
      </div>

      <section className="mb-4">
        <label className="text-sm font-medium mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-600" /> Pickup
        </label>
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <AddressAutocomplete
              value={pickup?.address || ""}
              placeholder="Where are you now?"
              onSelect={(v) => setPickup({
                address: v.address, town: v.town, lat: v.lat, lng: v.lng,
              })}
              data-testid="asap-pickup"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={useCurrentLocation}
            disabled={locBusy}
            data-testid="asap-use-current-location"
          >
            {locBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Use my location</span>
          </Button>
        </div>
        {locError && (
          <p className="text-xs text-red-600" data-testid="asap-loc-error">{locError} — you can still enter it manually above.</p>
        )}
      </section>

      <section className="mb-6">
        <label className="text-sm font-medium mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-red-600" /> Destination
        </label>
        <AddressAutocomplete
          value={dropoff?.address || ""}
          placeholder="Where is it going?"
          onSelect={(v) => setDropoff({
            address: v.address, town: v.town, lat: v.lat, lng: v.lng,
          })}
          data-testid="asap-dropoff"
        />
      </section>

      {mode === "breakdown_recovery" && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3" data-testid="asap-recovery-fields">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Vehicle information
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={vehicle.make} placeholder="Make (e.g. BMW)"
              onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
              data-testid="asap-vehicle-make" />
            <Input value={vehicle.model} placeholder="Model (e.g. 3 Series)"
              onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
              data-testid="asap-vehicle-model" />
          </div>
          <Input value={vehicle.registration} placeholder="Registration (optional)"
            onChange={(e) => setVehicle({ ...vehicle, registration: e.target.value })}
            data-testid="asap-vehicle-reg" />
          <div>
            <label className="text-xs text-neutral-700">Condition</label>
            <select
              value={vehicle.condition}
              onChange={(e) => setVehicle({ ...vehicle, condition: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white p-2 text-sm"
              data-testid="asap-vehicle-condition"
            >
              <option value="will_not_start">Will not start</option>
              <option value="accident_damaged">Accident damaged</option>
              <option value="flat_tyre">Flat tyre</option>
              <option value="mechanical_failure">Mechanical failure</option>
              <option value="battery_issue">Battery issue</option>
              <option value="cannot_be_driven">Cannot be driven</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["rolls", "steers", "brakes"].map((k) => (
              <label key={k} className="text-xs text-neutral-700 block">
                {k[0].toUpperCase() + k.slice(1)}?
                <select
                  value={vehicle[k]}
                  onChange={(e) => setVehicle({ ...vehicle, [k]: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white p-1.5 text-sm"
                  data-testid={`asap-vehicle-${k}`}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <label className="text-sm font-medium mb-2 block">Anything the driver should know? (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Vehicle is on the hard shoulder / height restriction"
          data-testid="asap-note" />
      </section>

      {pickup && dropoff && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-neutral-200">
          <RouteMap
            pickup={{ lat: pickup.lat, lng: pickup.lng }}
            dropoff={{ lat: dropoff.lat, lng: dropoff.lng }}
            summary={{ pickup: pickup.town, dropoff: dropoff.town }}
          />
        </div>
      )}

      {err && (
        <p className="text-sm text-red-600 mb-3" data-testid="asap-error">{err}</p>
      )}

      <Button
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
        className="w-full"
        data-testid="asap-submit"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Confirm & find driver
      </Button>
      <p className="text-xs text-neutral-500 mt-3 flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> You pay the deposit now. We only start looking for a driver after payment.
      </p>
    </div>
  );
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
