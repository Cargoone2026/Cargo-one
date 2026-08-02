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
  const [transportCategory, setTransportCategory] = useState("");
  const [transportDescription, setTransportDescription] = useState("");
  const [vehicle, setVehicle] = useState({
    make: "", model: "", registration: "", condition: "will_not_start",
    rolls: "unknown", steers: "unknown", brakes: "unknown",
  });
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  // Live route quote from backend (uses Google Distance Matrix when available)
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const useCurrentLocation = useCallback(async () => {
    setLocError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Unable to determine your location. Please search manually.");
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          // Reverse geocode via the Maps JS Geocoder if available. Falls back
          // to raw coordinates if Google Maps hasn't finished loading.
          let address = `Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`;
          let town = "Current location";
          try {
            const g = window?.google?.maps;
            if (g?.Geocoder) {
              const geocoder = new g.Geocoder();
              const result = await new Promise((resolve) => {
                geocoder.geocode({ location: { lat: latitude, lng: longitude } },
                  (results, status) => resolve(status === "OK" ? results : null));
              });
              if (result && result[0]) {
                address = result[0].formatted_address;
                const locality = (result[0].address_components || []).find(
                  (c) => c.types.includes("postal_town") || c.types.includes("locality")
                );
                if (locality) town = locality.long_name;
              }
            }
          } catch { /* keep coord fallback */ }
          setPickup({
            formatted_address: address,
            address_line: "",
            postcode: "",
            town,
            region: "",
            country_code: "GB",
            country: "United Kingdom",
            place_id: "",
            lat: latitude,
            lng: longitude,
          });
        } finally {
          setLocBusy(false);
        }
      },
      (e) => {
        setLocError(
          e.code === 1
            ? "Location permission denied. Please search for your collection address."
            : "Unable to determine your location. Please search manually."
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

  // Estimated commercial values shown to the customer BEFORE payment. Backend
  // recomputes authoritatively on job creation — this is a hint only. Follows
  // the same formula as the server's `create_job` suggested price.
  const { estimatedTotal, estimatedDeposit } = useMemo(() => {
    if (!pickup || !dropoff) return { estimatedTotal: 0, estimatedDeposit: 0 };
    // Prefer server-side quote when available (uses Google Distance Matrix).
    if (quote && quote.suggested_price) {
      const mult = mode === "breakdown_recovery" ? 2.0 : 1.0;
      const total = Math.max(30, Math.round(quote.suggested_price * mult));
      const deposit = Math.min(25, Math.max(10, Math.round(total * 0.125)));
      return { estimatedTotal: total, estimatedDeposit: deposit };
    }
    const distance = haversineMiles(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const mult = mode === "breakdown_recovery" ? 2.0 : 1.0;
    const total = Math.max(30, Math.round(distance * 1.5 * mult));
    // Existing platform fee is a percentage bucket managed by /admin/deposit-bands.
    // For the pre-payment hint we approximate at 12.5% capped at £25 — the
    // actual figure is set by the backend booking response.
    const deposit = Math.min(25, Math.max(10, Math.round(total * 0.125)));
    return { estimatedTotal: total, estimatedDeposit: deposit };
  }, [pickup, dropoff, mode, quote]);

  // Live quote fetch — hit /api/quote/estimate whenever both endpoints are set.
  // Debounced so quick edits don't spam the backend. Backend uses Google
  // Distance Matrix when the maps key is configured, else Haversine.
  useEffect(() => {
    if (!pickup || !dropoff) { setQuote(null); return undefined; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const category = mode === "breakdown_recovery" ? "cars_vehicles" : "parcels";
        const q = await api(
          `/quote/estimate?pickup_lat=${pickup.lat}&pickup_lng=${pickup.lng}` +
          `&dropoff_lat=${dropoff.lat}&dropoff_lng=${dropoff.lng}` +
          `&category=${category}`
        );
        if (!cancelled) setQuote(q);
      } catch {
        // Non-fatal — fall back to Haversine hint.
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pickup, dropoff, mode]);

  const onSubmit = useCallback(async () => {
    // Explicit user-friendly validation — never surface raw backend JSON.
    if (!pickup || !pickup.formatted_address || !Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng) || (pickup.lat === 0 && pickup.lng === 0)) {
      setErr("Please confirm your collection location.");
      return;
    }
    if (!dropoff || !dropoff.formatted_address || !Number.isFinite(dropoff.lat) || !Number.isFinite(dropoff.lng) || (dropoff.lat === 0 && dropoff.lng === 0)) {
      setErr("Please enter a delivery destination.");
      return;
    }
    if (mode === "breakdown_recovery" && (!vehicle.make || !vehicle.model)) {
      setErr("Please enter the vehicle make and model."); return;
    }
    if (mode === "transport" && !transportCategory) {
      setErr("Please select what you're sending."); return;
    }
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
          title: mode === "breakdown_recovery"
            ? "ASAP Vehicle Recovery"
            : `ASAP Delivery — ${(transportCategory || "General").replace(/_/g, " ")}`,
          category: mode === "breakdown_recovery"
            ? "cars_vehicles"
            : (transportCategory === "furniture" ? "furniture_delivery" :
                transportCategory === "pallets"   ? "freight_haulage" :
                transportCategory === "machinery" ? "freight_haulage" :
                "package_delivery"),
          description: mode === "breakdown_recovery"
            ? "ASAP vehicle recovery"
            : (transportDescription || `ASAP delivery — ${transportCategory}`),
          transport_category: mode === "transport" ? transportCategory : null,
          transport_description: mode === "transport" ? (transportDescription || null) : null,
          service_timing: "asap",
          service_type: mode,
          vehicle_details: mode === "breakdown_recovery" ? vehicle : null,
          customer_note: note || null,
          pickup_address: pickup.formatted_address,
          pickup_town: pickup.town || "Pickup",
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_address: dropoff.formatted_address,
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
      // Convert any raw API detail into a friendly message.
      const raw = e?.message || "";
      let friendly = "Something went wrong. Please try again.";
      if (/location|coordinates/i.test(raw)) friendly = "Please confirm your collection location.";
      else if (/destination|drop/i.test(raw)) friendly = "Please enter a delivery destination.";
      else if (/payment|stripe/i.test(raw)) friendly = "We couldn't start payment. Please try again in a moment.";
      else if (/csrf|forbidden|401/i.test(raw)) friendly = "Session expired — please sign in again.";
      setErr(friendly);
      setSubmitting(false);
    }
  }, [mode, note, vehicle, pickup, dropoff, navigate]);

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
          <MapPin className="h-4 w-4 text-emerald-600" /> Collection location
        </label>
        <Button
          type="button"
          onClick={useCurrentLocation}
          disabled={locBusy}
          className="w-full mb-2"
          data-testid="asap-use-current-location"
        >
          {locBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Locate className="h-4 w-4 mr-2" />}
          Use my current location
        </Button>
        <div className="text-xs text-neutral-500 mb-2 text-center">or search below</div>
        <AddressAutocomplete
          value={pickup}
          placeholder="Enter your collection address"
          onSelect={(v) => setPickup(v)}
          data-testid="asap-pickup"
        />
        {pickup && (
          <p className="text-xs text-neutral-600 mt-1" data-testid="asap-pickup-preview">
            <MapPin className="inline h-3 w-3 text-emerald-600 mr-1" />
            {pickup.formatted_address}
          </p>
        )}
        {locError && (
          <p className="text-xs text-red-600 mt-1" data-testid="asap-loc-error">{locError}</p>
        )}
      </section>

      <section className="mb-6">
        <label className="text-sm font-medium mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-red-600" /> Destination
        </label>
        <AddressAutocomplete
          value={dropoff}
          placeholder="Where is it going?"
          onSelect={(v) => setDropoff(v)}
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

      {mode === "transport" && (
        <section className="mb-6" data-testid="asap-transport-details">
          <label className="text-sm font-medium mb-2 block">
            What are you sending? <span className="text-red-500">*</span>
          </label>
          <select
            value={transportCategory}
            onChange={(e) => setTransportCategory(e.target.value)}
            data-testid="asap-transport-category"
            className="mb-2 block w-full rounded-lg border border-neutral-200 bg-white p-2 text-sm"
          >
            <option value="">Select a category…</option>
            <option value="parcel">Parcel</option>
            <option value="documents">Documents</option>
            <option value="medical_supplies">Medical supplies</option>
            <option value="pallets">Pallets</option>
            <option value="furniture">Furniture</option>
            <option value="machinery">Machinery</option>
            <option value="boxes">Boxes</option>
            <option value="retail_goods">Retail goods</option>
            <option value="electrical_items">Electrical items</option>
            <option value="other">Other</option>
          </select>
          <Input
            value={transportDescription}
            onChange={(e) => setTransportDescription(e.target.value)}
            placeholder="Describe what's being collected (e.g. 3 boxes of glassware, ~30kg total)"
            data-testid="asap-transport-description"
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Drivers see this before they accept — the clearer, the faster you'll be matched.
          </p>
        </section>
      )}

      <section className="mb-6">
        <label className="text-sm font-medium mb-2 block">Anything the driver should know? (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={
            mode === "breakdown_recovery"
              ? "e.g. Vehicle is on the hard shoulder / height restriction"
              : "e.g. Help with loading, fragile items, access restrictions, urgent deadline"
          }
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

      {pickup && dropoff && (
        <section
          className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4"
          data-testid="asap-booking-summary"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Booking summary
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                mode === "breakdown_recovery"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
              data-testid="asap-summary-service-type"
            >
              {mode === "breakdown_recovery" ? "Vehicle Recovery" : "ASAP Transport"}
            </span>
          </div>
          <div className="divide-y divide-neutral-100">
            <SummaryRow
              label="From"
              value={pickup.town || pickup.formatted_address}
            />
            <SummaryRow
              label="To"
              value={dropoff.town || dropoff.formatted_address}
            />
            <SummaryRow
              label="Distance"
              value={
                quoteLoading
                  ? "Calculating…"
                  : quote?.distance_miles != null
                    ? `${quote.distance_miles} mi`
                    : `${Math.round(haversineMiles(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng))} mi (approx)`
              }
            />
            <SummaryRow
              label="Est. driving time"
              value={
                quoteLoading
                  ? "Calculating…"
                  : quote?.duration_minutes != null
                    ? formatDuration(quote.duration_minutes)
                    : "—"
              }
            />
            {mode === "breakdown_recovery" && vehicle.make && vehicle.model && (
              <SummaryRow
                label="Vehicle"
                value={`${vehicle.make} ${vehicle.model}${vehicle.registration ? " · " + vehicle.registration : ""}`}
              />
            )}
            <SummaryRow
              label="Fare (driver charge)"
              value={estimatedTotal ? `£${estimatedTotal.toFixed(2)}` : "—"}
            />
            <SummaryRow
              label="Booking fee (deposit, paid now)"
              value={estimatedDeposit ? `£${estimatedDeposit.toFixed(2)}` : "—"}
              strong
            />
          </div>
          <p className="text-[11px] text-neutral-500 mt-3">
            Prices are indicative. Your final fare is confirmed by the backend before payment.
          </p>
        </section>
      )}

      {err && (
        <p
          className="text-sm text-red-600 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
          data-testid="asap-error"
        >
          {err}
        </p>
      )}

      <Button
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
        className="w-full"
        data-testid="asap-submit"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {estimatedDeposit
          ? `Confirm & pay £${estimatedDeposit.toFixed(2)} deposit`
          : "Confirm & find driver"}
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

function formatDuration(mins) {
  if (mins == null) return "—";
  const m = Math.max(1, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className={strong ? "font-semibold text-neutral-900" : "text-neutral-800 text-right ml-2 max-w-[60%] truncate"}>
        {value}
      </span>
    </div>
  );
}
