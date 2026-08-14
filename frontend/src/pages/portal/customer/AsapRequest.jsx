import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, MapPin, Truck, Zap, ShieldCheck, AlertTriangle,
  Locate, Loader2, Check, Sparkles, Car, Package,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { AddressAutocomplete } from "@/components/ui-portal/AddressAutocomplete";
import { RouteMap } from "@/components/ui-portal/RouteMap";
import { PhotoUpload } from "@/components/ui-portal/PhotoUpload";

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
  // Round 15+ — optional "Booking details" for ASAP transport so the driver
  // knows if the load needs a forklift or extra hands, and can size the van
  // properly. All fields are optional; empty → falls back to the default
  // hardcoded 20kg used by the ASAP price quote. Recovery mode is untouched
  // because vehicle_details already covers what the driver needs.
  const [needsForklift, setNeedsForklift] = useState(false);
  const [needsLoadingHelp, setNeedsLoadingHelp] = useState(false);
  const [asapWeightKg, setAsapWeightKg] = useState("");
  const [asapItemCount, setAsapItemCount] = useState("");
  const [asapLengthM, setAsapLengthM] = useState("");
  const [asapWidthM, setAsapWidthM] = useState("");
  const [asapHeightM, setAsapHeightM] = useState("");
  const [photos, setPhotos] = useState([]); // Round 3 — multi-photo attachment for BOTH transport + recovery
  // R26.2 — Customer-picked ASAP TRANSPORT vehicle class. Empty string
  // means "auto-recommend" and the engine will pick the smallest suitable
  // class. When set, the backend validates the choice against the load
  // and returns a `vehicle_too_small` error if unsuitable.
  const [transportVehicleKey, setTransportVehicleKey] = useState("");
  const [transportVehicles, setTransportVehicles] = useState([]);
  // R30 — Recovery vehicle picker parallels the R29 transport card grid.
  // Empty key = engine auto-picks from broken-vehicle info (make/model/weight).
  const [recoveryVehicleKey, setRecoveryVehicleKey] = useState("");
  const [recoveryVehicles, setRecoveryVehicles] = useState([]);
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
  // Round 3 — pull the AUTHORITATIVE booking-fee band from the backend so the
  // summary line matches Stripe Checkout + the confirmation page exactly.
  const [feePreview, setFeePreview] = useState(null);
  const feeAbortRef = useRef(null);

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

  // R26.2 — Fetch the authoritative ASAP vehicle catalog once on mount so
  // the customer-facing picker shows the exact 20 transport classes the
  // pricing engine knows about. Falls back silently to a small built-in
  // list if the endpoint isn't reachable (preview only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cat = await api("/asap/vehicles");
        if (cancelled) return;
        if (Array.isArray(cat?.transport)) setTransportVehicles(cat.transport);
        if (Array.isArray(cat?.recovery)) setRecoveryVehicles(cat.recovery);
      } catch {
        if (!cancelled) { setTransportVehicles([]); setRecoveryVehicles([]); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // R25 — SINGLE SOURCE OF TRUTH.
  // The server's `/api/pricing/quote` engine (via `POST /pricing/quote`,
  // called upstream in the quote effect below) is the ONLY price the
  // customer ever sees or pays. This memo just extracts the fields — it
  // NEVER recomputes. The prior client-side max(30, distance*1.5*mult)
  // formula produced totals that diverged from what actually got charged
  // and has been deleted (R25 pricing audit finding #3).
  const { estimatedTotal, estimatedDeposit, feePercent } = useMemo(() => {
    if (!pickup || !dropoff || !quote?.driver_charge) {
      return { estimatedTotal: 0, estimatedDeposit: 0, feePercent: null };
    }
    return {
      estimatedTotal: Number(quote.driver_charge),
      // The engine returns `booking_fee_preview` (already band-aware);
      // fall back to /booking-fee-bands/preview only if the field is
      // missing (older backends). Both use identical band logic.
      estimatedDeposit: Number(
        quote.booking_fee_preview ??
          (feePreview?.driver_charge === quote.driver_charge ? feePreview.booking_fee : 0),
      ),
      feePercent: quote.booking_fee_percent ?? feePreview?.booking_fee_percent ?? null,
    };
  }, [pickup, dropoff, quote, feePreview]);

  // Refresh authoritative booking-fee preview whenever the driver charge
  // changes. Debounced (300 ms) and abortable so quick edits don't spam
  // the backend or cause out-of-order responses.
  useEffect(() => {
    if (!estimatedTotal) { setFeePreview(null); return undefined; }
    if (feeAbortRef.current) feeAbortRef.current.abort?.();
    const ac = new AbortController();
    feeAbortRef.current = ac;
    const t = setTimeout(async () => {
      try {
        const res = await api(`/booking-fee-bands/preview?driver_charge=${estimatedTotal}`,
          { signal: ac.signal });
        if (!ac.signal.aborted) setFeePreview({ ...res, driver_charge: estimatedTotal });
      } catch (e) {
        if (!ac.signal.aborted) {
          // Non-fatal — the summary just keeps the 10% floor estimate.
        }
      }
    }, 300);
    return () => { clearTimeout(t); ac.abort(); };
  }, [estimatedTotal]);

  // R25 — Fetch the authoritative quote from `/pricing/quote` whenever
  // any priced input changes. This endpoint is the single source of
  // truth. Debounced 350 ms; aborts on unmount + on input churn so
  // out-of-order responses can never overwrite a fresher price.
  useEffect(() => {
    if (!pickup || !dropoff) { setQuote(null); return undefined; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const cat = mode === "breakdown_recovery"
          ? "cars_vehicles"
          : (transportCategory === "furniture"        ? "furniture_delivery" :
             transportCategory === "pallets"          ? "freight_haulage"    :
             transportCategory === "machinery"        ? "freight_haulage"    :
             transportCategory                        ? transportCategory    :
             "package_delivery");
        const q = await api("/asap/quote", {
          method: "POST",
          body: {
            pickup_lat: pickup.lat,
            pickup_lng: pickup.lng,
            dropoff_lat: dropoff.lat,
            dropoff_lng: dropoff.lng,
            // R26.1 — forward country codes so the international ASAP
            // guardrail can fire when autocomplete resolves a non-UK
            // address. When absent, backend falls back to domestic_uk.
            pickup_country_code: pickup.country_code || null,
            dropoff_country_code: dropoff.country_code || null,
            service_type: mode,
            urgency: "asap",
            // R26.2 / R30 — customer-picked vehicle class for both modes.
            // Empty = engine auto-recommends based on load (transport)
            // or broken-vehicle info (recovery).
            requested_vehicle_key: mode === "transport"
              ? (transportVehicleKey || null)
              : (recoveryVehicleKey || null),
            vehicle_class: mode === "breakdown_recovery"
              ? (vehicle?.weight_class || vehicle?.type || null)
              : null,
            weight_kg: mode === "transport" && asapWeightKg ? Number(asapWeightKg) : null,
            volume_m3: mode === "transport" && asapLengthM && asapWidthM && asapHeightM
              ? Number(asapLengthM) * Number(asapWidthM) * Number(asapHeightM)
              : null,
            item_count: mode === "transport" && asapItemCount ? Number(asapItemCount) : null,
            loading_help: mode === "transport" ? Boolean(needsLoadingHelp) : false,
            // R26.2 — a tail-lift is required IF the customer either
            // opted in via the checkbox OR picked a Tail-Lift vehicle
            // class (Luton Tail Lift / 3.5T Rigid TL / 7.5T Rigid TL).
            tail_lift_needed: mode === "transport"
              ? (Boolean(needsForklift) || (transportVehicleKey || "").endsWith("_tail_lift"))
              : false,
          },
        });
        // R26.1 — international ASAP is blocked from instant pricing.
        // Show a friendly manual-review notice instead of a broken quote.
        if (q && q.requires_manual_review) {
          if (!cancelled) {
            setQuote(null);
            setErr(q.manual_review_message
              || "This route requires operator confirmation. Please book as a Scheduled or Fixed-price job.");
          }
          return;
        }
        // Clear any previous error (e.g. vehicle-too-small) now that we
        // received a valid priced quote.
        if (!cancelled) setErr(null);
        // Map new ASAP-engine response into the existing shape the summary
        // card expects. driver_charge is authoritative; booking_fee comes
        // straight from the engine (existing bands, applied once).
        if (!cancelled) setQuote({
          ...q,
          suggested_price: q.driver_charge,      // legacy alias
          booking_fee_preview: q.booking_fee,
          booking_fee_percent: q.booking_fee_percent,
          customer_total_preview: q.customer_total,
        });
      } catch (e) {
        if (!cancelled) {
          // Surface pricing-engine validation errors (e.g. impossible
          // weight/dims, or "vehicle too small for your load") directly
          // to the customer. Prefer the parsed `.message` field over the
          // raw JSON blob so the banner reads like plain English.
          let raw = e?.message || "";
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              raw = parsed.message || parsed.detail?.message || parsed.detail || raw;
            }
          } catch { /* not JSON — leave raw as-is */ }
          if (/weight|dimensions|volume|distance|capacity|item|too small|recommend/i.test(String(raw))) {
            setErr(String(raw));
          }
          setQuote(null);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pickup, dropoff, mode, transportCategory, transportVehicleKey, recoveryVehicleKey, asapWeightKg,
      asapLengthM, asapWidthM, asapHeightM, asapItemCount,
      needsForklift, needsLoadingHelp, vehicle]);

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
      // R25 — DO NOT compute a client-side price. The server's
      // create_job endpoint now calls services.pricing.calculate_quote
      // and overwrites any client-supplied fixed_price so historical
      // haversine-only leakage is impossible. The `estimatedTotal` shown
      // to the user in the summary card is the same authoritative value
      // (fetched via /pricing/quote above); we send it back so the
      // server can log any client/server disagreement, but the server
      // always wins.
      const suggested = Number(quote?.driver_charge ?? estimatedTotal ?? 0);

      const created = await api("/jobs", {
        method: "POST",
        body: {
          title: mode === "breakdown_recovery"
            ? "ASAP Vehicle Recovery"
            : `ASAP Delivery — ${(transportCategory || "General").replace(/_/g, " ")}`,
          category: mode === "breakdown_recovery"
            ? "recovery"
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
          // Round 17 — pass through the customer's actual weight when they
          // supplied one, otherwise send NULL so JobExtras hides the "kg"
          // chip and _derive_suitable_vehicle falls back to the transport
          // category (transport) or vehicle_details.type (recovery) which is
          // already guaranteed to be set on the ASAP flow. This removes the
          // misleading 20 kg / 1500 kg hard-coded fallback. Price is NOT
          // affected — the backend weight-multiplier only kicks in above 500
          // kg (see server.py::_quote_math) and ASAP ships a client-computed
          // fixed_price anyway.
          weight_kg: mode === "breakdown_recovery"
            ? null
            : (asapWeightKg ? Number(asapWeightKg) : null),
          // Round 15+ — persist optional booking-details on ASAP transport
          // jobs so JobExtras renders the full chip row (forklift / loading
          // help / weight / items / L·W·H) on the driver's offer card and
          // the customer's booking detail. Recovery mode leaves these null.
          needs_forklift: mode === "transport" ? needsForklift : false,
          needs_loading_help: mode === "transport" ? needsLoadingHelp : false,
          item_count: mode === "transport" && asapItemCount ? Number(asapItemCount) : null,
          dimensions_l_m: mode === "transport" && asapLengthM ? Number(asapLengthM) : null,
          dimensions_w_m: mode === "transport" && asapWidthM ? Number(asapWidthM) : null,
          dimensions_h_m: mode === "transport" && asapHeightM ? Number(asapHeightM) : null,
          volume_m3: mode === "transport" && asapLengthM && asapWidthM && asapHeightM
            ? Number(asapLengthM) * Number(asapWidthM) * Number(asapHeightM)
            : null,
          collection_date: new Date().toISOString(),
          delivery_date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          pricing_type: "fixed",
          fixed_price: suggested,
          // R26.2 — persist the customer's ASAP transport vehicle pick
          // so the /jobs pricing path uses the same class the quote
          // screen showed, and downstream (driver offer, admin, snapshot)
          // all agree.
          requested_vehicle_key: mode === "transport"
            ? (transportVehicleKey || null)
            : null,
          photos: photos && photos.length ? photos : undefined,
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
  }, [mode, note, vehicle, pickup, dropoff, navigate, photos, transportCategory, transportDescription, transportVehicleKey, asapWeightKg, asapItemCount, asapLengthM, asapWidthM, asapHeightM, needsForklift, needsLoadingHelp, quote, estimatedTotal]);

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

      {mode === "breakdown_recovery" && (
        <section className="mb-6" data-testid="asap-recovery-vehicle-picker">
          <label className="text-sm font-medium mb-2 block">
            Which recovery vehicle do you need?
          </label>
          <VehicleCardGrid
            selectedKey={recoveryVehicleKey}
            onSelect={setRecoveryVehicleKey}
            vehicles={recoveryVehicles}
            fallback={RECOVERY_FALLBACK}
          />
          {recoveryVehicleKey && quote?.resolved_vehicle_key
            && quote.resolved_vehicle_key !== recoveryVehicleKey && (
              <p className="mt-2 text-[11px] text-amber-600" data-testid="asap-recovery-vehicle-note">
                Priced as <b>{quote.resolved_vehicle_key.replace(/_/g, " ")}</b> — the engine may
                have adjusted your choice.
              </p>
            )}
          <p className="mt-2 text-[11px] text-neutral-500">
            Leave on "Recommend for me" and we'll match your vehicle's weight and condition to the
            right recovery class automatically.
          </p>
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

      {mode === "transport" && (
        <section className="mb-6" data-testid="asap-vehicle-picker">
          <label className="text-sm font-medium mb-2 block">
            Which vehicle do you need?
          </label>
          <VehicleCardGrid
            selectedKey={transportVehicleKey}
            onSelect={setTransportVehicleKey}
            vehicles={transportVehicles}
          />
          {transportVehicleKey && quote?.resolved_vehicle_key
            && quote.resolved_vehicle_key !== transportVehicleKey && (
              <p className="mt-2 text-[11px] text-amber-600" data-testid="asap-vehicle-note">
                Priced as <b>{quote.resolved_vehicle_key.replace(/_/g, " ")}</b> — the engine may
                have adjusted your choice.
              </p>
            )}
          <p className="mt-2 text-[11px] text-neutral-500">
            Tail-lift vehicles are separate classes — pick a "Tail Lift" variant if you need one.
            Leave on "Recommend" and we'll size to your load below.
          </p>
        </section>
      )}

      {mode === "transport" && (
        <section className="mb-6" data-testid="asap-loading-details">
          <details className="rounded-2xl border border-neutral-200 bg-white p-3">
            <summary
              className="cursor-pointer text-sm font-medium text-neutral-800"
              data-testid="asap-loading-details-toggle"
            >
              Loading details (optional)
              <span className="ml-2 text-[11px] text-neutral-500">
                Forklift · loading help · weight · items · dimensions
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={needsForklift}
                  onChange={(e) => setNeedsForklift(e.target.checked)}
                  data-testid="asap-forklift"
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Forklift / loading equipment required
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={needsLoadingHelp}
                  onChange={(e) => setNeedsLoadingHelp(e.target.checked)}
                  data-testid="asap-loading-help"
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Loading assistance (tail lift / extra hands)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  value={asapWeightKg}
                  onChange={(e) => setAsapWeightKg(e.target.value)}
                  placeholder="Weight (kg)"
                  data-testid="asap-weight"
                />
                <Input
                  type="number"
                  min="0"
                  value={asapItemCount}
                  onChange={(e) => setAsapItemCount(e.target.value)}
                  placeholder="Number of items"
                  data-testid="asap-item-count"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={asapLengthM}
                  onChange={(e) => setAsapLengthM(e.target.value)}
                  placeholder="Length (m)"
                  data-testid="asap-length"
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={asapWidthM}
                  onChange={(e) => setAsapWidthM(e.target.value)}
                  placeholder="Width (m)"
                  data-testid="asap-width"
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={asapHeightM}
                  onChange={(e) => setAsapHeightM(e.target.value)}
                  placeholder="Height (m)"
                  data-testid="asap-height"
                />
              </div>
              <p className="text-[11px] text-neutral-500">
                Sharing these upfront helps the driver bring the right van and equipment first time.
              </p>
            </div>
          </details>
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

      {/* Round 3 — photo uploads for BOTH ASAP transport and ASAP recovery.
         Drivers see these on the offer card and job detail so they can
         judge access, load size or vehicle condition before claiming. */}
      <section className="mb-6" data-testid="asap-photos-section">
        <label className="text-sm font-medium mb-1 block">
          {mode === "breakdown_recovery"
            ? "Photos of the vehicle (optional)"
            : "Photos of the item (optional)"}
        </label>
        <p className="text-xs text-neutral-500 mb-2">
          {mode === "breakdown_recovery"
            ? "Add up to 4 photos so the recovery driver can see the vehicle's position and access."
            : "Add up to 4 photos so the driver can see the load, packaging and access."}
        </p>
        <PhotoUpload value={photos} onChange={setPhotos} testId="asap-photos" />
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
            <div className="my-2 border-t border-neutral-200" />
            {/* R28 — ASAP summary now matches the normal-job (PostJob) pricing
               presentation. Show the total job price as the emphasised
               headline, with the booking fee (paid-now portion) underneath.
               Deliberately omit the standalone "Fare (driver charge)" line
               — customers only care about the total price + the amount they
               pay today. */}
            <SummaryRow
              label="Total job price"
              value={
                estimatedTotal
                  ? `£${(Number(quote?.customer_total ?? (estimatedTotal + estimatedDeposit))).toFixed(2)}`
                  : "—"
              }
              strong
              big
            />
            <SummaryRow
              label={feePercent != null
                ? `Booking fee (${Number(feePercent).toFixed(0)}%, paid now)`
                : "Booking fee (deposit, paid now)"}
              value={estimatedDeposit ? `£${estimatedDeposit.toFixed(2)}` : "—"}
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

function SummaryRow({ label, value, strong = false, big = false }) {
  return (
    <div className={`flex items-baseline justify-between ${big ? "py-2" : "py-1"} ${big ? "text-base" : "text-sm"}`}>
      <span className={big ? "font-semibold text-neutral-900" : "text-neutral-500"}>{label}</span>
      <span className={
        big
          ? "font-bold text-neutral-900 text-xl"
          : strong
            ? "font-semibold text-neutral-900"
            : "text-neutral-800 text-right ml-2 max-w-[60%] truncate"
      }>
        {value}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * R29 — Vehicle Card Grid picker
 *
 * Replaces the plain `<select>` dropdown with a scannable 2-column card grid
 * of transport vehicles. Each card shows an icon, label, indicative payload
 * & internal dimensions, tail-lift badge, and price hint (min £ · £/mi).
 *
 * `VEHICLE_SPECS` is a client-side display-only metadata map — the backend
 * pricing engine remains the single source of truth for actual charges.
 * ──────────────────────────────────────────────────────────────────────── */

// Static per-vehicle display metadata. Payload / dims are indicative — the
// dispatcher and driver confirm the actual load fits. Numbers align to
// standard UK commercial vehicle specs; not to be interpreted as SLA.
const VEHICLE_SPECS = {
  car:                    { icon: Car,     payload: "≤ 150 kg",  dims: "boot space" },
  small_van:              { icon: Package, payload: "≤ 500 kg",  dims: "1.8 × 1.2 × 1.1 m" },
  lwb_van:                { icon: Truck,   payload: "≤ 1000 kg", dims: "3.2 × 1.8 × 1.9 m" },
  elwb_van:               { icon: Truck,   payload: "≤ 1200 kg", dims: "4.0 × 1.8 × 2.1 m" },
  pickup:                 { icon: Truck,   payload: "≤ 1000 kg", dims: "open bed" },
  luton:                  { icon: Truck,   payload: "≤ 1000 kg", dims: "4.0 × 2.0 × 2.2 m" },
  luton_tail_lift:        { icon: Truck,   payload: "≤ 1000 kg", dims: "4.0 × 2.0 × 2.2 m + tail lift" },
  "3_5t_rigid":           { icon: Truck,   payload: "≤ 1200 kg", dims: "4.3 × 2.0 × 2.2 m" },
  "3_5t_rigid_tail_lift": { icon: Truck,   payload: "≤ 1200 kg", dims: "4.3 × 2.0 × 2.2 m + tail lift" },
  "5t_rigid":             { icon: Truck,   payload: "≤ 2500 kg", dims: "5.0 × 2.2 × 2.3 m" },
  "7_5t_rigid":           { icon: Truck,   payload: "≤ 3500 kg", dims: "6.0 × 2.4 × 2.4 m" },
  "7_5t_rigid_tail_lift": { icon: Truck,   payload: "≤ 3500 kg", dims: "6.0 × 2.4 × 2.4 m + tail lift" },
  "10_18t_rigid":         { icon: Truck,   payload: "≤ 10 t",    dims: "7.5 × 2.4 × 2.6 m" },
  "26t_rigid":            { icon: Truck,   payload: "≤ 16 t",    dims: "9.0 × 2.5 × 2.7 m" },
  "32t_rigid":            { icon: Truck,   payload: "≤ 20 t",    dims: "9.0 × 2.5 × 2.7 m" },
  multi_axle_rigid:       { icon: Truck,   payload: "≤ 26 t",    dims: "extra axle for weight/stability" },
  tractor_unit:           { icon: Truck,   payload: "trailer-fed", dims: "hitch only — needs trailer" },
  semi_trailer:           { icon: Truck,   payload: "≤ 26 t",    dims: "13.6 × 2.5 × 2.7 m" },
  articulated_hgv:        { icon: Truck,   payload: "≤ 26 t",    dims: "13.6 × 2.5 × 2.7 m (44 t GVW)" },
  heavy_haul_combo:       { icon: Truck,   payload: "abnormal",  dims: "STGO / escort · manual review" },
  // ── Recovery vehicles (R30) — payload here = max recoverable vehicle
  //    weight; dims = distinguishing recovery equipment.
  light_recovery_van:          { icon: Truck, payload: "cars ≤ 1.5 t",        dims: "spec lift / dolly" },
  pickup_recovery:             { icon: Truck, payload: "cars ≤ 1.5 t",        dims: "flat-bed pickup" },
  "3_5t_recovery":             { icon: Truck, payload: "cars ≤ 3.5 t",        dims: "3.5T flat-bed / spec lift" },
  "5_7_5t_recovery":           { icon: Truck, payload: "vans ≤ 5–7.5 t",      dims: "5–7.5T flat-bed" },
  "10_18t_recovery":           { icon: Truck, payload: "vans / LGV ≤ 10–18 t", dims: "large flat-bed" },
  "26t_recovery":              { icon: Truck, payload: "HGV ≤ 26 t",           dims: "heavy flat-bed" },
  "32t_recovery":              { icon: Truck, payload: "HGV ≤ 32 t",           dims: "heavy underlift + jib" },
  heavy_recovery:              { icon: Truck, payload: "HGV ≤ 40 t",           dims: "heavy underlift + jib" },
  heavy_6x4_8x4_recovery:      { icon: Truck, payload: "HGV ≤ 44 t",           dims: "6×4 / 8×4 · winch capable" },
  heavy_tractor_recovery:      { icon: Truck, payload: "artic tractor units",  dims: "5th-wheel underlift" },
  heavy_articulated_recovery:  { icon: Truck, payload: "full artic ≤ 44 t",    dims: "artic + trailer combo" },
  stgo_heavy_recovery:         { icon: Truck, payload: "abnormal / STGO",      dims: "escort · manual review" },
};

// Fallback lists used only when /asap/vehicles hasn't responded yet.
const TRANSPORT_FALLBACK = [
  { key: "car",                    label: "Car" },
  { key: "small_van",              label: "Small Van" },
  { key: "lwb_van",                label: "LWB Van" },
  { key: "elwb_van",               label: "ELWB Van" },
  { key: "pickup",                 label: "Pickup" },
  { key: "luton",                  label: "Luton" },
  { key: "luton_tail_lift",        label: "Luton Tail Lift" },
  { key: "3_5t_rigid",             label: "3.5T Rigid" },
  { key: "3_5t_rigid_tail_lift",   label: "3.5T Rigid Tail Lift" },
  { key: "5t_rigid",               label: "5T Rigid" },
  { key: "7_5t_rigid",             label: "7.5T Rigid" },
  { key: "7_5t_rigid_tail_lift",   label: "7.5T Rigid Tail Lift" },
  { key: "10_18t_rigid",           label: "10–18T Rigid" },
  { key: "26t_rigid",              label: "26T Rigid" },
  { key: "32t_rigid",              label: "32T Rigid" },
  { key: "multi_axle_rigid",       label: "Other Multi-Axle Rigid" },
  { key: "tractor_unit",           label: "Tractor Unit" },
  { key: "semi_trailer",           label: "Semi-Trailer" },
  { key: "articulated_hgv",        label: "Articulated HGV" },
  { key: "heavy_haul_combo",       label: "Heavy-Haul Combination" },
];
const RECOVERY_FALLBACK = [
  { key: "light_recovery_van",         label: "Light Recovery Van" },
  { key: "pickup_recovery",            label: "Pickup Recovery" },
  { key: "3_5t_recovery",              label: "3.5T Recovery" },
  { key: "5_7_5t_recovery",            label: "5–7.5T Recovery" },
  { key: "10_18t_recovery",            label: "10–18T Recovery" },
  { key: "26t_recovery",               label: "26T Recovery" },
  { key: "32t_recovery",               label: "32T Recovery" },
  { key: "heavy_recovery",             label: "Heavy Recovery" },
  { key: "heavy_6x4_8x4_recovery",     label: "Heavy 6×4 / 8×4 Recovery" },
  { key: "heavy_tractor_recovery",     label: "Heavy Tractor Recovery" },
  { key: "heavy_articulated_recovery", label: "Heavy Articulated Recovery" },
  { key: "stgo_heavy_recovery",        label: "STGO Heavy Recovery Combination" },
];

function VehicleCardGrid({ selectedKey, onSelect, vehicles, fallback = TRANSPORT_FALLBACK }) {
  const list = vehicles && vehicles.length ? vehicles : fallback;
  return (
    <div
      className="grid grid-cols-2 gap-2"
      role="radiogroup"
      aria-label="Vehicle class"
      data-testid="asap-vehicle-grid"
    >
      {/* Recommend-for-me card — always first, always available. */}
      <VehicleCard
        selected={!selectedKey}
        onClick={() => onSelect("")}
        icon={Sparkles}
        label="Recommend for me"
        payload="Based on your load"
        dims="We'll pick the smallest fit"
        highlight
        testKey="__recommend"
      />
      {list.map((v) => {
        const spec = VEHICLE_SPECS[v.key] || {};
        const Icon = spec.icon || Truck;
        return (
          <VehicleCard
            key={v.key}
            selected={selectedKey === v.key}
            onClick={() => onSelect(v.key)}
            icon={Icon}
            label={v.label}
            payload={spec.payload || ""}
            dims={spec.dims || ""}
            tailLift={v.tail_lift || (typeof v.key === "string" && v.key.endsWith("_tail_lift"))}
            manualReview={v.requires_manual_review}
            priceHint={
              v.minimum_charge != null && v.per_mile != null
                ? `from £${Number(v.minimum_charge).toFixed(0)} · £${Number(v.per_mile).toFixed(2)}/mi`
                : null
            }
            testKey={v.key}
          />
        );
      })}
    </div>
  );
}

function VehicleCard({
  selected, onClick, icon: Icon, label, payload, dims,
  tailLift = false, manualReview = false, priceHint = null,
  highlight = false, testKey,
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={`asap-vehicle-card-${testKey}`}
      className={[
        "group relative flex flex-col items-start rounded-2xl border p-3 text-left transition",
        selected
          ? "border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900"
          : "border-neutral-200 bg-white hover:border-neutral-300",
        highlight && !selected ? "bg-amber-50 border-amber-200" : "",
      ].filter(Boolean).join(" ")}
    >
      {selected ? (
        <span
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white"
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
      ) : null}
      <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[13px] font-semibold leading-tight text-neutral-900">{label}</div>
      {payload ? (
        <div className="mt-0.5 text-[11px] font-medium text-neutral-700">{payload}</div>
      ) : null}
      {dims ? (
        <div className="text-[11px] leading-tight text-neutral-500">{dims}</div>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {tailLift ? (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            Tail lift
          </span>
        ) : null}
        {manualReview ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            Manual review
          </span>
        ) : null}
      </div>
      {priceHint ? (
        <div className="mt-1 text-[10px] font-medium text-neutral-500">{priceHint}</div>
      ) : null}
    </button>
  );
}
