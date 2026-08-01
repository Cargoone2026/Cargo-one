import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Package,
  Sparkles,
  Megaphone,
  Tag,
  Navigation,
  Clock,
  PoundSterling,
  Plane,
  Truck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCategories, useVehicles, requestRecommendation } from "@/hooks/useCatalog";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { AddressAutocomplete } from "@/components/ui-portal/AddressAutocomplete";
import { PhotoUpload } from "@/components/ui-portal/PhotoUpload";
import { RouteMap } from "@/components/ui-portal/RouteMap";

const STEP_COUNT = 5;
const NOT_SURE_KEY = "__not_sure__";

function volumeFromDims(l, w, h) {
  const ln = Number(l), wn = Number(w), hn = Number(h);
  if (ln > 0 && wn > 0 && hn > 0) return Number((ln * wn * hn).toFixed(2));
  return null;
}
function fmtDur(mins) {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function CustomerPostJob() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: categories, loading: catLoading } = useCategories();
  const { data: vehicles, loading: vehLoading } = useVehicles();

  const [step, setStep] = useState(1);
  const [categoryKey, setCategoryKey] = useState(params.get("category") || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [quote, setQuote] = useState(null);

  const [weightKg, setWeightKg] = useState("");
  const [lengthM, setLengthM] = useState("");
  const [widthM, setWidthM] = useState("");
  const [heightM, setHeightM] = useState("");
  const [itemCount, setItemCount] = useState("");
  const [needsForklift, setNeedsForklift] = useState(false);
  const [needsLoadingHelp, setNeedsLoadingHelp] = useState(false);
  const [collectionDate, setCollectionDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const [vehicleKey, setVehicleKey] = useState("");
  const [recs, setRecs] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState(null);

  const [pricingType, setPricingType] = useState("bidding");
  const [fixedPrice, setFixedPrice] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [feePreview, setFeePreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.key === categoryKey) || null,
    [categories, categoryKey],
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.key === vehicleKey) || null,
    [vehicles, vehicleKey],
  );

  useEffect(() => {
    if (!categoryKey && categories.length > 0) setCategoryKey(categories[0].key);
  }, [categories, categoryKey]);

  // Live quote — matches the Expo dependency shape exactly
  useEffect(() => {
    if (!pickup || !dropoff || !categoryKey) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const parts = [
          `pickup_lat=${pickup.lat}`,
          `pickup_lng=${pickup.lng}`,
          `dropoff_lat=${dropoff.lat}`,
          `dropoff_lng=${dropoff.lng}`,
          `category=${encodeURIComponent(categoryKey)}`,
        ];
        if (pickup.country_code) parts.push(`pickup_country_code=${pickup.country_code}`);
        if (dropoff.country_code) parts.push(`dropoff_country_code=${dropoff.country_code}`);
        if (weightKg) parts.push(`weight_kg=${weightKg}`);
        const vol = volumeFromDims(lengthM, widthM, heightM);
        if (vol) parts.push(`volume_m3=${vol}`);
        const q = await api(`/quote/estimate?${parts.join("&")}`);
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, categoryKey, weightKg, lengthM, widthM, heightM]);

  const previewCharge = useMemo(() => {
    if (pricingType === "fixed" && fixedPrice) return Number(fixedPrice);
    if (pricingType === "bidding" && maxBudget) return Number(maxBudget);
    if (quote?.suggested_price) return quote.suggested_price;
    return 0;
  }, [pricingType, fixedPrice, maxBudget, quote]);

  useEffect(() => {
    if (step !== 5 || previewCharge <= 0) {
      setFeePreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await api(
          `/booking-fees/preview?driver_charge=${encodeURIComponent(previewCharge)}`,
        );
        if (!cancelled) setFeePreview(r);
      } catch {
        if (!cancelled) setFeePreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, previewCharge]);

  const requestRec = useCallback(async () => {
    if (!selectedCategory) return;
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await requestRecommendation({
        category_key: selectedCategory.key,
        weight_kg: weightKg ? Number(weightKg) : null,
        volume_m3: volumeFromDims(lengthM, widthM, heightM),
        dimensions_l_m: lengthM ? Number(lengthM) : null,
        dimensions_w_m: widthM ? Number(widthM) : null,
        dimensions_h_m: heightM ? Number(heightM) : null,
        item_count: itemCount ? Number(itemCount) : null,
        needs_forklift: needsForklift,
        needs_loading_help: needsLoadingHelp,
      });
      setRecs(res.recommendations || []);
    } catch (e) {
      setRecError(e?.message || "Could not fetch recommendations");
    } finally {
      setRecLoading(false);
    }
  }, [selectedCategory, weightKg, lengthM, widthM, heightM, itemCount, needsForklift, needsLoadingHelp]);

  useEffect(() => {
    if (step === 4 && vehicleKey === NOT_SURE_KEY) requestRec();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, vehicleKey, needsForklift, needsLoadingHelp]);

  const canNext1 = !!categoryKey && title.trim().length > 0;
  const canNext2 = !!pickup && !!dropoff;
  const canNext3 = !!collectionDate && !!deliveryDate;
  const canNext4 = !!vehicleKey && (vehicleKey !== NOT_SURE_KEY || !!recs);
  const canSubmit = pricingType === "fixed" ? !!fixedPrice && Number(fixedPrice) > 0 : true;

  const effectiveVehicleKey =
    vehicleKey === NOT_SURE_KEY
      ? recs?.[0]?.key || selectedCategory?.default_vehicles?.[0] || ""
      : vehicleKey;

  async function submit() {
    setErr(null);
    if (!pickup || !dropoff) return setErr("Please choose pickup and delivery addresses");
    if (!selectedCategory) return setErr("Please choose a service category");
    setLoading(true);
    try {
      const body = {
        title: title.trim(),
        category: selectedCategory.key,
        description: description.trim(),
        photos,
        pickup_address: pickup.formatted_address,
        pickup_town: pickup.town || pickup.formatted_address.split(",").pop()?.trim() || "",
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_postcode: pickup.postcode || null,
        pickup_region: pickup.region || null,
        pickup_country: pickup.country || null,
        pickup_country_code: pickup.country_code || null,
        pickup_place_id: pickup.place_id || null,
        dropoff_address: dropoff.formatted_address,
        dropoff_town: dropoff.town || dropoff.formatted_address.split(",").pop()?.trim() || "",
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_postcode: dropoff.postcode || null,
        dropoff_region: dropoff.region || null,
        dropoff_country: dropoff.country || null,
        dropoff_country_code: dropoff.country_code || null,
        dropoff_place_id: dropoff.place_id || null,
        weight_kg: weightKg ? Number(weightKg) : null,
        dimensions: [lengthM, widthM, heightM].filter(Boolean).join("×") || null,
        collection_date: collectionDate,
        delivery_date: deliveryDate,
        pricing_type: pricingType,
        fixed_price: pricingType === "fixed" ? Number(fixedPrice) : null,
        max_budget: maxBudget ? Number(maxBudget) : null,
        vehicle_required: effectiveVehicleKey || null,
      };
      const job = await api("/jobs", { method: "POST", body });
      navigate(`/customer/job/${job.id}`, { replace: true });
    } catch (e) {
      setErr(e?.message || "Failed to post job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white" data-testid="customer-post-job">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-6 md:px-8">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate(-1))}
          data-testid="post-job-back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[22px] font-bold tracking-tight text-[#111111]">
          Post a Job
        </h1>
        <span className="rounded-full bg-[#F4F4F4] px-3 py-1 text-[12px] font-semibold text-[#6B7280]">
          Step {step}/{STEP_COUNT}
        </span>
      </header>

      {/* Progress bar */}
      <div className="mx-4 mt-3 h-1 rounded-full bg-[#F4F4F4] md:mx-8">
        <div
          className="h-1 rounded-full bg-[#D62828] transition-all"
          style={{ width: `${(step / STEP_COUNT) * 100}%` }}
        />
      </div>

      {/* Body */}
      <div className="mx-auto max-w-[720px] px-4 pt-4 pb-32 md:px-8">
        {step === 1 && (
          <section data-testid="postjob-step-1">
            <h2 className="text-[24px] font-bold text-[#111111]">
              What are you shipping?
            </h2>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              Pick a service category and give it a title.
            </p>
            {catLoading ? (
              <p className="mt-4 text-[13px] text-[#6B7280]">Loading categories…</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {categories.map((c) => {
                  const active = c.key === categoryKey;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategoryKey(c.key)}
                      data-testid={`postjob-cat-${c.key}`}
                      className={`flex flex-col items-start gap-2 rounded-[12px] border p-3 text-left transition-colors ${
                        active
                          ? "border-[#111111] bg-[#111111] text-white"
                          : "border-[#E5E7EB] bg-white hover:border-[#111111]"
                      }`}
                    >
                      <Package className="h-5 w-5" />
                      <span className="text-[14px] font-semibold">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-6 space-y-3">
              <Input
                label="Job title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 3-seater sofa delivery"
                testID="postjob-title-input"
              />
              <label className="block">
                <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                  Description
                </span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details, notes, or special requirements"
                  data-testid="postjob-desc-input"
                  className="w-full resize-none rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] text-[#111111] outline-none focus:border-[#111111]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                  Photos <span className="font-normal text-[#6B7280]">(optional)</span>
                </span>
                <PhotoUpload value={photos} onChange={setPhotos} testId="postjob-photos" />
              </label>
            </div>
          </section>
        )}

        {step === 2 && (
          <section data-testid="postjob-step-2">
            <h2 className="text-[24px] font-bold text-[#111111]">Route</h2>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              Search pickup and delivery addresses.
            </p>
            <div className="mt-4">
              <AddressAutocomplete
                label="Pickup address"
                value={pickup}
                placeholder="Search for pickup address"
                onSelect={setPickup}
                testID="pickup-address-picker"
              />
              <AddressAutocomplete
                label="Delivery address"
                value={dropoff}
                placeholder="Search for delivery address"
                onSelect={setDropoff}
                testID="dropoff-address-picker"
              />
            </div>
            {pickup && dropoff && (
              <div className="mt-4 space-y-3" data-testid="route-preview">
                <RouteMap
                  pickup={{ lat: pickup.lat, lng: pickup.lng, label: "Pickup" }}
                  dropoff={{ lat: dropoff.lat, lng: dropoff.lng, label: "Dropoff" }}
                  height={180}
                  summary={
                    quote && !quote.requires_manual_review
                      ? {
                          pickupTown: pickup?.town || pickup?.name,
                          dropoffTown: dropoff?.town || dropoff?.name,
                          distanceMiles: quote.distance_miles,
                          durationMinutes: quote.duration_minutes,
                        }
                      : {
                          pickupTown: pickup?.town || pickup?.name,
                          dropoffTown: dropoff?.town || dropoff?.name,
                        }
                  }
                />
                {quote?.requires_manual_review ? (
                  <div
                    className="flex items-start gap-3 rounded-[12px] border border-[#F59E0B] bg-[#FFFBEB] p-3"
                    data-testid="intl-route-banner"
                  >
                    <Plane className="mt-0.5 h-5 w-5 text-[#B45309]" />
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-[#78350F]">
                        International route: {quote.origin_country} →{" "}
                        {quote.destination_country}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#78350F]">
                        {quote.manual_review_message ||
                          "Our team will provide a bespoke quote within one business day."}
                      </p>
                    </div>
                  </div>
                ) : null}
                {quote && !quote.requires_manual_review ? (
                  <div className="grid grid-cols-3 gap-2">
                    <QuoteStat
                      Icon={Navigation}
                      label="Distance"
                      value={`${quote.distance_miles} mi`}
                    />
                    <QuoteStat
                      Icon={Clock}
                      label="Est. time"
                      value={fmtDur(quote.duration_minutes)}
                    />
                    <QuoteStat
                      Icon={PoundSterling}
                      label="Suggested"
                      value={`£${quote.suggested_price}`}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section data-testid="postjob-step-3">
            <h2 className="text-[24px] font-bold text-[#111111]">Details</h2>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              These help us match you to the right vehicle & price.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Input
                label="Weight (kg)"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 250"
                inputMode="numeric"
                testID="postjob-weight-input"
              />
              <Input
                label="Item count"
                value={itemCount}
                onChange={(e) => setItemCount(e.target.value)}
                placeholder="e.g. 3"
                inputMode="numeric"
                testID="postjob-item-count"
              />
            </div>
            <p className="mt-2 mb-1 text-[13px] font-semibold text-[#111111]">
              Approximate dimensions (m)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Length" value={lengthM} onChange={(e) => setLengthM(e.target.value)} placeholder="1.2" inputMode="decimal" testID="postjob-length" />
              <Input label="Width" value={widthM} onChange={(e) => setWidthM(e.target.value)} placeholder="0.8" inputMode="decimal" testID="postjob-width" />
              <Input label="Height" value={heightM} onChange={(e) => setHeightM(e.target.value)} placeholder="0.9" inputMode="decimal" testID="postjob-height" />
            </div>
            <div className="mt-3 space-y-2">
              <Toggle
                label="Forklift or loading equipment available at pickup / drop-off?"
                value={needsForklift}
                onChange={setNeedsForklift}
                testID="postjob-forklift"
              />
              <Toggle
                label="Loading assistance required (e.g. tail lift, extra hands)?"
                value={needsLoadingHelp}
                onChange={setNeedsLoadingHelp}
                testID="postjob-loading-help"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Input
                label="Collection date"
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                testID="postjob-collection-date"
              />
              <Input
                label="Delivery date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                testID="postjob-delivery-date"
              />
            </div>
          </section>
        )}

        {step === 4 && (
          <section data-testid="postjob-step-4">
            <h2 className="text-[24px] font-bold text-[#111111]">
              Which vehicle do you need?
            </h2>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              Choose one, or let our engine recommend the right vehicle.
            </p>
            {vehLoading ? (
              <p className="mt-4 text-[13px] text-[#6B7280]">Loading vehicles…</p>
            ) : (
              <div className="mt-4 space-y-2">
                <VehicleCard
                  active={vehicleKey === NOT_SURE_KEY}
                  onPress={() => setVehicleKey(NOT_SURE_KEY)}
                  name="Not Sure — Recommend for me"
                  description="We'll suggest 2–4 suitable vehicles based on your load."
                  Icon={Sparkles}
                  highlight
                  testID="veh-not-sure"
                />
                {vehicles.map((v) => (
                  <VehicleCard
                    key={v.key}
                    active={vehicleKey === v.key}
                    onPress={() => setVehicleKey(v.key)}
                    name={v.name}
                    description={v.description}
                    Icon={Truck}
                    testID={`veh-${v.key}`}
                  />
                ))}
              </div>
            )}
            {vehicleKey === NOT_SURE_KEY && (
              <div className="mt-4 rounded-[12px] border border-[#E5E7EB] bg-[#FFF7ED] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#D62828]" />
                  <p className="text-[15px] font-semibold text-[#111111]">
                    Recommended for your load
                  </p>
                </div>
                {recLoading ? (
                  <p className="text-[13px] text-[#6B7280]">Analysing your load…</p>
                ) : recError ? (
                  <p className="text-[13px] text-[#DC2626]">{recError}</p>
                ) : recs && recs.length > 0 ? (
                  <ul className="space-y-2">
                    {recs.map((r) => (
                      <li
                        key={r.key}
                        className={`flex items-start gap-3 rounded-[10px] border p-3 ${
                          r.is_best_match
                            ? "border-[#D62828] bg-white"
                            : "border-[#E5E7EB] bg-white"
                        }`}
                      >
                        <Truck className="mt-0.5 h-5 w-5 text-[#D62828]" />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-semibold text-[#111111]">
                              {r.name}
                            </p>
                            <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.6px] text-[#B01F1F]">
                              {r.recommendation_label}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[12px] text-[#6B7280]">
                            {r.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-[#6B7280]">
                    No suggestions available.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {step === 5 && (
          <section data-testid="postjob-step-5">
            <h2 className="text-[24px] font-bold text-[#111111]">
              Pricing &amp; Review
            </h2>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              Choose how you want to price, then review your job.
            </p>
            <div className="mt-4 flex rounded-full bg-[#F4F4F4] p-1">
              <PriceTab
                active={pricingType === "bidding"}
                onClick={() => setPricingType("bidding")}
                Icon={Megaphone}
                label="Open to Bids"
                testID="pricing-bidding-tab"
              />
              <PriceTab
                active={pricingType === "fixed"}
                onClick={() => setPricingType("fixed")}
                Icon={Tag}
                label="Fixed Price"
                testID="pricing-fixed-tab"
              />
            </div>
            <div className="mt-3">
              {pricingType === "fixed" ? (
                <Input
                  label="Driver charge (£)"
                  value={fixedPrice}
                  onChange={(e) => setFixedPrice(e.target.value)}
                  placeholder={quote?.suggested_price ? String(quote.suggested_price) : "e.g. 150"}
                  inputMode="decimal"
                  testID="postjob-fixed-price"
                />
              ) : (
                <Input
                  label="Max driver charge (£, optional)"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder={quote?.suggested_price ? String(quote.suggested_price) : "e.g. 250"}
                  inputMode="decimal"
                  testID="postjob-max-budget"
                />
              )}
            </div>

            <div
              className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
              data-testid="postjob-summary"
            >
              <p className="mb-3 text-[13px] font-bold uppercase tracking-[1.2px] text-[#6B7280]">
                Quote Summary
              </p>
              <SummaryRow label="Service" value={selectedCategory?.name || "—"} />
              <SummaryRow
                label="Vehicle"
                value={
                  vehicleKey === NOT_SURE_KEY
                    ? recs && recs[0]
                      ? `${recs[0].name} (recommended)`
                      : "Recommend for me"
                    : selectedVehicle?.name || "—"
                }
              />
              <SummaryRow
                label="Distance"
                value={quote ? `${quote.distance_miles} miles` : "—"}
              />
              <SummaryRow
                label="Journey time"
                value={quote ? fmtDur(quote.duration_minutes) : "—"}
              />
              <div className="my-2 border-t border-[#F3F4F6]" />
              <SummaryRow
                label="Driver charge"
                value={previewCharge ? `£${previewCharge.toFixed(2)}` : "—"}
                emphasise
              />
              <SummaryRow
                label="Cargo One booking fee"
                value={feePreview ? `£${feePreview.booking_fee.toFixed(2)}` : "£—"}
                testID="postjob-summary-booking-fee"
              />
              <div className="my-2 border-t border-[#F3F4F6]" />
              <SummaryRow
                label="Total booking price"
                value={feePreview ? `£${feePreview.customer_total.toFixed(2)}` : "£—"}
                emphasise
                big
                testID="postjob-summary-total"
              />
              <p className="mt-3 text-[12px] leading-relaxed text-[#6B7280]">
                Only the Cargo One booking fee is charged now via Stripe. The
                driver charge is paid directly on delivery.
              </p>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-[#FFF7ED] p-3">
              {pricingType === "bidding" ? (
                <Megaphone className="h-5 w-5 text-[#D62828]" />
              ) : (
                <Tag className="h-5 w-5 text-[#D62828]" />
              )}
              <p className="flex-1 text-[13px] text-[#111111]">
                {pricingType === "bidding"
                  ? "Drivers will now submit bids for this delivery."
                  : "The first suitable driver can accept this delivery."}
              </p>
            </div>
            {err ? (
              <p className="mt-2 text-[13px] text-[#DC2626]" data-testid="postjob-error">
                {err}
              </p>
            ) : null}
          </section>
        )}
      </div>

      {/* Footer CTA */}
      <div className="fixed inset-x-0 bottom-16 border-t border-[#E5E7EB] bg-white/95 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto max-w-[720px] px-4 py-3 md:px-8">
          {step < STEP_COUNT ? (
            <Button
              title="Continue"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                step === 1 ? !canNext1
                  : step === 2 ? !canNext2
                  : step === 3 ? !canNext3
                  : !canNext4
              }
              testID="postjob-next-button"
            />
          ) : (
            <Button
              title="Post Job"
              onClick={submit}
              loading={loading}
              disabled={!canSubmit}
              testID="postjob-submit-button"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteStat({ Icon, label, value }) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-3 text-center">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#F4F4F4]">
        <Icon className="h-4 w-4 text-[#111111]" />
      </div>
      <p className="text-[14px] font-bold text-[#111111]">{value}</p>
      <p className="text-[11px] text-[#6B7280]">{label}</p>
    </div>
  );
}

function Toggle({ label, value, onChange, testID }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      data-testid={testID}
      className={`flex w-full items-center justify-between gap-3 rounded-[12px] border px-3 py-3 text-left transition-colors ${
        value ? "border-[#111111] bg-[#111111]" : "border-[#E5E7EB] bg-white"
      }`}
    >
      <span
        className={`text-[13px] font-medium ${value ? "text-white" : "text-[#111111]"}`}
      >
        {label}
      </span>
      <span
        className={`inline-flex h-6 w-10 items-center rounded-full p-0.5 ${
          value ? "bg-[#D62828]" : "bg-[#E5E7EB]"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function VehicleCard({ active, onPress, name, description, Icon, highlight, testID }) {
  return (
    <button
      type="button"
      onClick={onPress}
      data-testid={testID}
      className={`flex w-full items-start gap-3 rounded-[12px] border p-3 text-left transition-colors ${
        active
          ? "border-[#D62828] bg-white shadow-sm"
          : highlight
          ? "border-dashed border-[#D62828] bg-[#FFF7ED] hover:bg-white"
          : "border-[#E5E7EB] bg-white hover:border-[#111111]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
          active ? "bg-[#D62828] text-white" : "bg-[#F4F4F4] text-[#D62828]"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={`block text-[14px] font-semibold ${
            active ? "text-[#D62828]" : "text-[#111111]"
          }`}
        >
          {name}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[12px] text-[#6B7280]">
          {description}
        </span>
      </span>
    </button>
  );
}

function PriceTab({ active, onClick, Icon, label, testID }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold transition-colors ${
        active ? "bg-[#111111] text-white" : "text-[#6B7280] hover:text-[#111111]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SummaryRow({ label, value, emphasise, big, testID }) {
  return (
    <div className="flex items-center justify-between py-1" data-testid={testID}>
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span
        className={`text-right ${
          big
            ? "text-[20px] font-bold text-[#D62828]"
            : emphasise
            ? "text-[15px] font-bold text-[#111111]"
            : "text-[14px] text-[#111111]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
