import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Navigation,
  Clock,
  TrendingUp,
  Maximize2,
  X as XIcon,
  RefreshCw,
  Compass,
  RefreshCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCapabilities, useCategories } from "@/hooks/useCatalog";
import { AcceptanceInfo } from "@/components/ui-portal/AcceptanceInfo";
import { DriverLiveMap } from "@/components/ui-portal/DriverLiveMap";
import { List as ListIcon, Map as MapIcon } from "lucide-react";

const RADII = [10, 20, 40, 75, 250];
const SORTS = [
  { key: "nearest", label: "Nearest", Icon: Navigation },
  { key: "newest", label: "Newest", Icon: Clock },
  { key: "highest_price", label: "Highest £", Icon: TrendingUp },
  { key: "distance_asc", label: "Shortest job", Icon: Maximize2 },
];

export default function DriverJobs() {
  const { data: catalogCategories } = useCategories();
  const { data: caps } = useCapabilities();
  const [jobs, setJobs] = useState([]);
  const [radius, setRadius] = useState(75);
  const [driverLoc, setDriverLoc] = useState(null); // { lat, lng } when browser geolocation is granted
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(null);
  const [pricing, setPricing] = useState("all");
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedCaps, setSelectedCaps] = useState([]);
  const [sort, setSort] = useState("nearest");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // list | map
  const [selectedJob, setSelectedJob] = useState(null); // map bottom-sheet
  // R20 — extra filter dimensions requested by ops:
  // vehicle size, trip length band, service type, timing, cargo aids.
  const [vehicleSize, setVehicleSize] = useState("all"); // all | small_van | large_van | luton | 7_5t | recovery_3_5t | recovery_heavy | motorcycle
  const [tripBand, setTripBand] = useState("all");       // all | short | medium | long
  const [serviceType, setServiceType] = useState("all"); // all | transport | breakdown_recovery
  const [timing, setTiming] = useState("all");           // all | asap | scheduled
  const [forkliftOnly, setForkliftOnly] = useState(false);
  const [loadingHelpOnly, setLoadingHelpOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fix 1A/1B: only send lat/lng when the browser granted geolocation.
      // No permission → backend returns ALL eligible posted jobs (no radius
      // filter). This preserves visibility even when the driver denies or
      // the API is unavailable — matches the P0 requirement.
      let path = "/jobs/nearby";
      if (driverLoc && Number.isFinite(driverLoc.lat) && Number.isFinite(driverLoc.lng)) {
        path += `?lat=${driverLoc.lat}&lng=${driverLoc.lng}&radius=${radius}`;
      }
      const list = await api(path).catch(() => []);
      setJobs(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [radius, driverLoc]);

  // Best-effort browser geolocation. Failure/denial is intentionally silent
  // and leaves `driverLoc` null → unfiltered fetch above.
  useEffect(() => {
    if (!navigator?.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { latitude, longitude } = pos.coords || {};
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setDriverLoc({ lat: latitude, lng: longitude });
        }
      },
      () => {
        /* denied / timeout — leave driverLoc null → unfiltered */
      },
      { timeout: 4000, maximumAge: 5 * 60 * 1000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCap = (key) =>
    setSelectedCaps((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const resetAll = () => {
    setCategory(null);
    setPricing("all");
    setQuery("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedCaps([]);
    setSort("nearest");
    setVehicleSize("all");
    setTripBand("all");
    setServiceType("all");
    setTiming("all");
    setForkliftOnly(false);
    setLoadingHelpOnly(false);
  };

  const filtered = useMemo(() => {
    const minP = Number(minPrice) || 0;
    const maxP = Number(maxPrice) || 0;
    const qLower = query.trim().toLowerCase();
    const list = jobs.filter((j) => {
      if (category && j.category !== category) return false;
      if (pricing !== "all" && j.pricing_type !== pricing) return false;
      const price = Number(
        j.pricing_type === "fixed"
          ? j.fixed_price
          : j.max_budget || j.suggested_price || 0,
      );
      if (minP > 0 && price < minP) return false;
      if (maxP > 0 && price > maxP) return false;
      if (qLower) {
        const hay = `${j.title || ""} ${j.description || ""} ${j.pickup_town || ""} ${j.dropoff_town || ""} ${j.pickup_postcode || ""} ${j.dropoff_postcode || ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      if (selectedCaps.length > 0) {
        const jobCaps = j.required_capabilities || [];
        const ok = selectedCaps.every((c) => jobCaps.includes(c));
        if (!ok) return false;
      }
      // R20 — vehicle size (matches `recommended_vehicle` slug)
      if (vehicleSize !== "all") {
        const label = String(j.recommended_vehicle || j.vehicle_label || "").toLowerCase();
        const slug = label.replace(/\s+/g, "_").replace(/[.]/g, "").replace(/[^a-z0-9_]/g, "");
        // slug examples: small_van, large_van, luton_van, 75t_box_truck,
        // 35t_recovery_truck, motorcycle_recovery, heavy_recovery
        const map = {
          small_van: (s) => s.includes("small_van"),
          large_van: (s) => s.includes("large_van"),
          luton: (s) => s.includes("luton"),
          "7_5t": (s) => s.includes("75t") || s.includes("7_5t"),
          recovery_3_5t: (s) => s.includes("35t_recovery") || s.includes("3_5t_recovery"),
          recovery_heavy: (s) => s.includes("heavy_recovery"),
          motorcycle: (s) => s.includes("motorcycle"),
        };
        const fn = map[vehicleSize];
        if (fn && !fn(slug)) return false;
      }
      // R20 — trip length band
      if (tripBand !== "all") {
        const d = Number(j.distance_miles || 0);
        if (tripBand === "short" && d >= 25) return false;
        if (tripBand === "medium" && (d < 25 || d > 100)) return false;
        if (tripBand === "long" && d <= 100) return false;
      }
      // R20 — service type (transport vs recovery)
      if (serviceType !== "all" && (j.service_type || "").toLowerCase() !== serviceType) return false;
      // R20 — timing (ASAP vs scheduled)
      if (timing !== "all") {
        const jt = (j.service_timing || "scheduled").toLowerCase();
        if (jt !== timing) return false;
      }
      // R20 — cargo aids
      if (forkliftOnly && !j.needs_forklift) return false;
      if (loadingHelpOnly && !j.needs_loading_help) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "nearest") sorted.sort((a, b) => (a.distance_from_driver ?? 999) - (b.distance_from_driver ?? 999));
    else if (sort === "newest") sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    else if (sort === "highest_price") {
      const price = (j) => Number(j.pricing_type === "fixed" ? j.fixed_price : j.max_budget || j.suggested_price || 0);
      sorted.sort((a, b) => price(b) - price(a));
    } else if (sort === "distance_asc") sorted.sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));
    return sorted;
  }, [jobs, category, pricing, minPrice, maxPrice, query, selectedCaps, sort, vehicleSize, tripBand, serviceType, timing, forkliftOnly, loadingHelpOnly]);

  const activeFilterCount = [
    category ? 1 : 0,
    pricing !== "all" ? 1 : 0,
    minPrice ? 1 : 0,
    maxPrice ? 1 : 0,
    selectedCaps.length,
    vehicleSize !== "all" ? 1 : 0,
    tripBand !== "all" ? 1 : 0,
    serviceType !== "all" ? 1 : 0,
    timing !== "all" ? 1 : 0,
    forkliftOnly ? 1 : 0,
    loadingHelpOnly ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-jobs">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">Available Jobs</h1>
        <span className="text-[13px] text-[#6B7280]">
          {filtered.length} of {jobs.length}
        </span>
      </header>

      {/* R19 — List / Map toggle. Both views consume the SAME `filtered`
          array so eligibility + capability filters (from useCapabilities,
          category, pricing, radius, min/max price) apply identically. */}
      <div className="mx-4 mt-3 flex gap-1 rounded-full bg-[#F4F4F4] p-1 md:mx-8" data-testid="driver-jobs-viewmode">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          data-testid="driver-jobs-view-list"
          aria-pressed={viewMode === "list"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition-colors ${
            viewMode === "list" ? "bg-[#111111] text-white" : "text-[#6B7280]"
          }`}
        >
          <ListIcon className="h-4 w-4" /> List
        </button>
        <button
          type="button"
          onClick={() => setViewMode("map")}
          data-testid="driver-jobs-view-map"
          aria-pressed={viewMode === "map"}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition-colors ${
            viewMode === "map" ? "bg-[#111111] text-white" : "text-[#6B7280]"
          }`}
        >
          <MapIcon className="h-4 w-4" /> Map
        </button>
      </div>

      <div className="mx-4 mt-3 flex items-center gap-2 md:mx-8">
        <div className="flex flex-1 items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2">
          <Search className="h-4 w-4 text-[#6B7280]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, town or postcode…"
            data-testid="driver-jobs-search"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear"
              data-testid="driver-jobs-search-clear"
            >
              <XIcon className="h-4 w-4 text-[#9CA3AF]" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          data-testid="driver-jobs-advanced-toggle"
          className={`relative flex h-11 w-11 items-center justify-center rounded-[12px] ${
            activeFilterCount > 0 ? "bg-[#D62828]" : "bg-[#F4F4F4]"
          }`}
          aria-label="Filters"
        >
          <Filter
            className={`h-4 w-4 ${activeFilterCount > 0 ? "text-white" : "text-[#111111]"}`}
          />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#111111] px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={load}
          aria-label="Refresh"
          data-testid="driver-jobs-refresh"
          className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <RefreshCw className={`h-4 w-4 text-[#111111] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Sort chips */}
      <div className="mx-4 mt-3 flex gap-2 overflow-x-auto pb-1 md:mx-8" data-testid="sort-row">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
            data-testid={`sort-${s.key}`}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              sort === s.key ? "bg-[#111111] text-white" : "bg-[#F4F4F4] text-[#111111]"
            }`}
          >
            <s.Icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {showAdvanced && (
        <div className="mx-4 mt-3 space-y-3 rounded-[12px] bg-[#F9FAFB] p-4 md:mx-8" data-testid="advanced-filters">
          <FilterRow label="Radius">
            {RADII.map((r) => (
              <Chip key={r} active={radius === r} onClick={() => setRadius(r)} testID={`radius-${r}`}>
                {r} mi
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Pricing">
            {["all", "fixed", "bidding"].map((p) => (
              <Chip key={p} active={pricing === p} onClick={() => setPricing(p)} testID={`pricing-filter-${p}`}>
                {p === "all" ? "All" : p === "fixed" ? "Fixed" : "Bidding"}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Price range (£)">
            <input
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              inputMode="numeric"
              data-testid="filter-min-price"
              className="w-24 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[14px] outline-none focus:border-[#111111]"
            />
            <span className="text-[#6B7280]">–</span>
            <input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              inputMode="numeric"
              data-testid="filter-max-price"
              className="w-24 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[14px] outline-none focus:border-[#111111]"
            />
          </FilterRow>
          <FilterRow label="Category">
            <Chip active={category === null} onClick={() => setCategory(null)} testID="cat-all">
              All
            </Chip>
            {catalogCategories.map((c) => (
              <Chip
                key={c.key}
                active={category === c.key}
                onClick={() => setCategory(category === c.key ? null : c.key)}
                testID={`cat-${c.key}`}
              >
                {c.name}
              </Chip>
            ))}
          </FilterRow>
          {caps.length > 0 && (
            <FilterRow label="Required capabilities">
              {caps.map((c) => (
                <Chip
                  key={c.key}
                  active={selectedCaps.includes(c.key)}
                  onClick={() => toggleCap(c.key)}
                  testID={`cap-${c.key}`}
                >
                  {c.name}
                </Chip>
              ))}
            </FilterRow>
          )}
          <FilterRow label="Vehicle size">
            {[
              ["all", "All"],
              ["small_van", "Small Van"],
              ["large_van", "Large Van"],
              ["luton", "Luton Van"],
              ["7_5t", "7.5T Box Truck"],
              ["recovery_3_5t", "3.5T Recovery"],
              ["recovery_heavy", "Heavy Recovery"],
              ["motorcycle", "Motorcycle Recovery"],
            ].map(([key, label]) => (
              <Chip
                key={key}
                active={vehicleSize === key}
                onClick={() => setVehicleSize(key)}
                testID={`vehicle-size-${key}`}
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Trip length">
            {[
              ["all", "Any"],
              ["short", "Short (<25 mi)"],
              ["medium", "Medium (25–100 mi)"],
              ["long", "Long (>100 mi)"],
            ].map(([key, label]) => (
              <Chip
                key={key}
                active={tripBand === key}
                onClick={() => setTripBand(key)}
                testID={`trip-band-${key}`}
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Service">
            {[
              ["all", "All"],
              ["transport", "Transport"],
              ["breakdown_recovery", "Recovery"],
            ].map(([key, label]) => (
              <Chip
                key={key}
                active={serviceType === key}
                onClick={() => setServiceType(key)}
                testID={`service-type-${key}`}
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Timing">
            {[
              ["all", "All"],
              ["asap", "ASAP"],
              ["scheduled", "Scheduled"],
            ].map(([key, label]) => (
              <Chip
                key={key}
                active={timing === key}
                onClick={() => setTiming(key)}
                testID={`timing-${key}`}
              >
                {label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Cargo aids">
            <Chip
              active={forkliftOnly}
              onClick={() => setForkliftOnly((v) => !v)}
              testID="forklift-only"
            >
              Forklift required
            </Chip>
            <Chip
              active={loadingHelpOnly}
              onClick={() => setLoadingHelpOnly((v) => !v)}
              testID="loading-help-only"
            >
              Loading help required
            </Chip>
          </FilterRow>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetAll}
              data-testid="reset-filters"
              className="inline-flex items-center gap-1 text-[13px] font-bold text-[#D62828] hover:underline"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reset all filters
            </button>
          )}
        </div>
      )}

      {/* List */}
      {viewMode === "list" && (
      <ul className="mx-4 mt-3 space-y-3 md:mx-8" data-testid="driver-jobs-list">
        {filtered.length === 0 ? (
          <li
            className="flex flex-col items-center gap-2 py-12 text-center"
            data-testid="driver-jobs-empty"
          >
            <Compass className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[15px] font-semibold text-[#111111]">
              No jobs match your filters
            </p>
            <p className="text-[13px] text-[#6B7280]">
              Try expanding the radius or resetting filters.
            </p>
          </li>
        ) : (
          filtered.map((j) => (
            <li key={j.id}>
              <Link
                to={`/driver/job/${j.id}`}
                data-testid={`driver-job-${j.id}`}
                className="block rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-[#111111]">
                      {j.title}
                    </p>
                    <p className="text-[12px] capitalize text-[#6B7280]">
                      {(j.category || "").replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[22px] font-bold tracking-tight text-[#111111]">
                      £{j.pricing_type === "fixed" ? j.fixed_price : j.max_budget || j.suggested_price}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#6B7280]">
                      {j.pricing_type === "fixed" ? "FIXED" : "MAX"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[14px]">
                  <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                  <span className="truncate text-[#111111]">{j.pickup_town}</span>
                  <span className="text-[#9CA3AF]">→</span>
                  <span className="truncate text-[#111111]">{j.dropoff_town}</span>
                </div>
                {/* Round 3 — surface customer photos on the offer card so
                    drivers can gauge load size before opening the detail. */}
                {Array.isArray(j.photos) && j.photos.length > 0 && (
                  <div
                    className="mt-3 flex items-center gap-2 overflow-x-auto pb-1"
                    data-testid={`driver-job-photos-strip-${j.id}`}
                  >
                    {j.photos.slice(0, 4).map((p, i) => (
                      <img
                        key={i}
                        src={p}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover border border-[#E5E7EB]"
                      />
                    ))}
                    {j.photos.length > 4 && (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F4F4F4] text-[12px] font-semibold text-[#6B7280]">
                        +{j.photos.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {/* Round 7 — Suitable vehicle + transport item / recovery
                    details must be visible BEFORE the driver taps Accept. */}
                <div className="mt-3">
                  <AcceptanceInfo
                    job={j}
                    dense
                    testIdPrefix={`driver-job-accept-${j.id}`}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#F3F4F6] pt-2">
                  <Chip mini>{j.distance_miles} mi job</Chip>
                  <Chip mini>{j.distance_from_driver} mi away</Chip>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold ${
                      j.pricing_type === "bidding"
                        ? "bg-[#D62828] text-white"
                        : "bg-[#F4F4F4] text-[#111111]"
                    }`}
                  >
                    {j.pricing_type === "fixed" ? "Accept" : "Bid"}
                  </span>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
      )}

      {/* Map view — uses the SAME `filtered` dataset so eligibility
          filters, radius, price min/max and capability rules produce
          the identical job set as the List. Selecting a pin opens a
          mobile-friendly bottom sheet with the full preview + View Job. */}
      {viewMode === "map" && (
        <div className="mx-4 mt-3 md:mx-8" data-testid="driver-jobs-map">
          <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-[#E5E7EB]">
            <DriverLiveMap
              lat={driverLoc?.lat}
              lng={driverLoc?.lng}
              offers={filtered
                .filter((j) => Number.isFinite(j.pickup_lat) && Number.isFinite(j.pickup_lng))
                .map((j) => ({
                  ...j,
                  job_id: j.id,
                  id: j.id,
                }))
              }
              onOfferClick={(j) => setSelectedJob(j)}
              className="h-full"
              showSweep={false}
            />
            {filtered.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#6B7280] shadow">
                  No eligible jobs in this filter
                </div>
              </div>
            )}
          </div>
          {selectedJob ? (
            <MapJobBottomSheet
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Bottom-sheet preview of a job marker. Shows enough to decide but
    respects existing privacy — pickup town only, not full address. */
function MapJobBottomSheet({ job, onClose }) {
  const price = job.pricing_type === "fixed" ? job.fixed_price : (job.suggested_price || job.max_budget);
  const priceLabel = job.pricing_type === "fixed" ? "Earn" : "Max bid";
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
      onClick={onClose}
      data-testid="driver-jobs-map-sheet"
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#D62828]">
              {job.service_timing === "asap" ? "ASAP" : "Scheduled"}
              {" · "}
              {job.service_type === "breakdown_recovery" ? "Recovery" : "Transport"}
              {" · "}
              {job.pricing_type === "fixed" ? "Fixed" : "Bidding"}
            </p>
            <h3 className="mt-0.5 truncate text-[17px] font-bold text-[#111111]">
              {job.title || `${job.pickup_town} → ${job.dropoff_town}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="driver-jobs-map-sheet-close"
            className="rounded-full p-1 hover:bg-[#F4F4F4]"
          >
            <XIcon className="h-4 w-4 text-[#6B7280]" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[14px] text-[#111111]">
          <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
          <span className="truncate">{job.pickup_town}</span>
          <span className="text-[#9CA3AF]">→</span>
          <span className="truncate">{job.dropoff_town}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[#6B7280]">
          <span>{job.distance_miles} mi job</span>
          <span>·</span>
          <span>{job.distance_from_driver} mi away</span>
          <span className="ml-auto rounded-full bg-[#F4F4F4] px-2 py-0.5 text-[11px] font-bold text-[#111111]">
            {priceLabel} £{Number(price || 0).toFixed(2)}
          </span>
        </div>
        <div className="mt-3">
          <AcceptanceInfo job={job} dense testIdPrefix={`driver-jobs-map-sheet-${job.id}`} />
        </div>
        <Link
          to={`/driver/job/${job.id}`}
          data-testid="driver-jobs-map-sheet-view"
          className="mt-4 flex w-full items-center justify-center rounded-full bg-[#111111] px-4 py-3 text-[14px] font-semibold text-white hover:bg-[#D62828]"
        >
          View Job
        </Link>
      </div>
    </div>
  );
}

function Chip({ children, active, onClick, testID, mini }) {
  if (mini) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F4F4] px-3 py-1 text-[12px] font-medium text-[#6B7280]">
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap ${
        active ? "bg-[#111111] text-white" : "bg-white text-[#111111] border border-[#E5E7EB] hover:border-[#111111]"
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
