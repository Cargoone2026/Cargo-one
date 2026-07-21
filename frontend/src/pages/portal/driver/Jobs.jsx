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
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(null);
  const [pricing, setPricing] = useState("all");
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedCaps, setSelectedCaps] = useState([]);
  const [sort, setSort] = useState("nearest");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api(`/jobs/nearby?radius=${radius}`).catch(() => []);
      setJobs(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [radius]);

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
  }, [jobs, category, pricing, minPrice, maxPrice, query, selectedCaps, sort]);

  const activeFilterCount = [
    category ? 1 : 0,
    pricing !== "all" ? 1 : 0,
    minPrice ? 1 : 0,
    maxPrice ? 1 : 0,
    selectedCaps.length,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-jobs">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">Available Jobs</h1>
        <span className="text-[13px] text-[#6B7280]">
          {filtered.length} of {jobs.length}
        </span>
      </header>

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
      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
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
