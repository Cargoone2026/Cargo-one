/**
 * AvailableJobsScreen — Cargo One Driver job marketplace.
 *
 * Faithful port of the web page (frontend/src/pages/portal/driver/Jobs.jsx)
 * feature-for-feature:
 *
 *   • GET /jobs/nearby, sends lat/lng ONLY when foreground location
 *     permission is granted; otherwise the backend returns ALL eligible
 *     posted jobs — matches the web Fix 1A/1B fallback so a denied
 *     permission never leaves the driver with an empty screen.
 *   • Five radius options: 10 / 20 / 40 / 75 / 250 miles (default 75).
 *   • Eleven filter dimensions (identical keys + values):
 *       category, pricing (all|fixed|bidding), min/max price,
 *       required capabilities (multi-select), vehicle size
 *       (small_van | large_van | luton | 7_5t | recovery_3_5t |
 *       recovery_heavy | motorcycle), trip band (short|medium|long),
 *       service (all|transport|breakdown_recovery),
 *       timing (all|asap|scheduled), forklift-only, loading-help-only.
 *   • Four sort modes: nearest / newest / highest_price / distance_asc.
 *   • List ↔ Map toggle.  Map uses the same @rnmapbox/maps library
 *     already installed for both apps; access token via
 *     EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN. Selecting a pin opens a bottom
 *     sheet with an "Open job" CTA that navigates to JobDetail.
 *   • Card ↔ web parity: title, category, price, MAX/FIXED tag,
 *     pickup→dropoff row, top-4 photos strip w/ +N overflow chip,
 *     distance stats + Accept/Bid pill.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import Mapbox from "@rnmapbox/maps";
import {
  Clock,
  Compass,
  Filter,
  List as ListIcon,
  Map as MapIcon,
  Maximize2,
  Navigation as NavigationIcon,
  RefreshCcw,
  RefreshCw,
  Search,
  TrendingUp,
  X as XIcon,
} from "lucide-react-native";
import { DriverAPI, SharedAPI, type Job } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page } from "../ui";
import { useShellMenu } from "../components/AppShell";
import type { RootStackParamList } from "../App";

type Nav = NativeStackNavigationProp<RootStackParamList>;

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "");

const RADII = [10, 20, 40, 75, 250] as const;
type Radius = (typeof RADII)[number];

const SORTS = [
  { key: "nearest", label: "Nearest", Icon: NavigationIcon },
  { key: "newest", label: "Newest", Icon: Clock },
  { key: "highest_price", label: "Highest £", Icon: TrendingUp },
  { key: "distance_asc", label: "Shortest job", Icon: Maximize2 },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const VEHICLE_SIZES: [string, string][] = [
  ["all", "All"],
  ["small_van", "Small Van"],
  ["large_van", "Large Van"],
  ["luton", "Luton Van"],
  ["7_5t", "7.5T Box Truck"],
  ["recovery_3_5t", "3.5T Recovery"],
  ["recovery_heavy", "Heavy Recovery"],
  ["motorcycle", "Motorcycle Recovery"],
];

const TRIP_BANDS: [string, string][] = [
  ["all", "Any"],
  ["short", "Short (<25 mi)"],
  ["medium", "Medium (25–100 mi)"],
  ["long", "Long (>100 mi)"],
];

const SERVICE_TYPES: [string, string][] = [
  ["all", "All"],
  ["transport", "Transport"],
  ["breakdown_recovery", "Recovery"],
];

const TIMINGS: [string, string][] = [
  ["all", "All"],
  ["asap", "ASAP"],
  ["scheduled", "Scheduled"],
];

/** Field readers — the shared Job type keeps these optional, so we
 *  centralise the reads. Cast once, keep the rest of the file typed. */
type J = Job & Record<string, any>;

const priceOf = (j: J) =>
  Number(j.pricing_type === "fixed" ? j.fixed_price : j.max_budget || j.suggested_price || 0);

export function AvailableJobsScreen() {
  const nav = useNavigation<Nav>();
  const { openDrawer, showMenu } = useShellMenu();

  const [jobs, setJobs] = useState<J[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState<Radius>(75);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "unavailable">("idle");

  const [category, setCategory] = useState<string | null>(null);
  const [pricing, setPricing] = useState<"all" | "fixed" | "bidding">("all");
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [vehicleSize, setVehicleSize] = useState<string>("all");
  const [tripBand, setTripBand] = useState<string>("all");
  const [serviceType, setServiceType] = useState<string>("all");
  const [timing, setTiming] = useState<string>("all");
  const [forkliftOnly, setForkliftOnly] = useState(false);
  const [loadingHelpOnly, setLoadingHelpOnly] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedJob, setSelectedJob] = useState<J | null>(null);

  const [categoryList, setCategoryList] = useState<{ key: string; name: string }[]>([]);
  const [capabilityList, setCapabilityList] = useState<{ key: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await DriverAPI.nearbyJobs(
        driverLoc?.lat,
        driverLoc?.lng,
        radius,
      ).catch(() => [] as Job[]);
      setJobs(Array.isArray(list) ? (list as J[]) : []);
    } finally {
      setRefreshing(false);
    }
  }, [driverLoc, radius]);

  // Best-effort foreground location — silent on denial (matches web).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLocStatus("requesting");
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== "granted") {
          setLocStatus("denied");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setDriverLoc({ lat: latitude, lng: longitude });
          setLocStatus("granted");
        } else {
          setLocStatus("unavailable");
        }
      } catch {
        if (!cancelled) setLocStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Catalog data — categories + capabilities.
  useEffect(() => {
    let cancelled = false;
    Promise.all([SharedAPI.categories(), DriverAPI.capabilities()]).then(([cats, caps]) => {
      if (cancelled) return;
      setCategoryList(Array.isArray(cats) ? (cats as any[]) : []);
      setCapabilityList(Array.isArray(caps) ? caps : []);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCap = (key: string) =>
    setSelectedCaps((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const resetAll = () => {
    setCategory(null);
    setPricing("all");
    setQuery("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedCaps([]);
    setSort("newest");
    setVehicleSize("all");
    setTripBand("all");
    setServiceType("all");
    setTiming("all");
    setForkliftOnly(false);
    setLoadingHelpOnly(false);
  };

  /** Filter + sort — line-for-line port of Jobs.jsx useMemo. */
  const filtered = useMemo(() => {
    const minP = Number(minPrice) || 0;
    const maxP = Number(maxPrice) || 0;
    const qLower = query.trim().toLowerCase();
    const list = jobs.filter((j) => {
      if (category && j.category !== category) return false;
      if (pricing !== "all" && j.pricing_type !== pricing) return false;
      const price = priceOf(j);
      if (minP > 0 && price < minP) return false;
      if (maxP > 0 && price > maxP) return false;
      if (qLower) {
        const hay = `${j.title || ""} ${j.description || ""} ${j.pickup_town || ""} ${j.dropoff_town || ""} ${j.pickup_postcode || ""} ${j.dropoff_postcode || ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      if (selectedCaps.length > 0) {
        const jobCaps: string[] = j.required_capabilities || [];
        const ok = selectedCaps.every((c) => jobCaps.includes(c));
        if (!ok) return false;
      }
      if (vehicleSize !== "all") {
        const label = String(j.recommended_vehicle || j.vehicle_label || "").toLowerCase();
        const slug = label.replace(/\s+/g, "_").replace(/[.]/g, "").replace(/[^a-z0-9_]/g, "");
        const map: Record<string, (s: string) => boolean> = {
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
      if (tripBand !== "all") {
        const d = Number(j.distance_miles || 0);
        if (tripBand === "short" && d >= 25) return false;
        if (tripBand === "medium" && (d < 25 || d > 100)) return false;
        if (tripBand === "long" && d <= 100) return false;
      }
      if (serviceType !== "all" && String(j.service_type || "").toLowerCase() !== serviceType) return false;
      if (timing !== "all") {
        const jt = String(j.service_timing || "scheduled").toLowerCase();
        if (jt !== timing) return false;
      }
      if (forkliftOnly && !j.needs_forklift) return false;
      if (loadingHelpOnly && !j.needs_loading_help) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "nearest")
      sorted.sort((a, b) => (a.distance_from_driver ?? 999) - (b.distance_from_driver ?? 999));
    else if (sort === "newest")
      sorted.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    else if (sort === "highest_price") sorted.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === "distance_asc")
      sorted.sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));
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
    <Page testID="driver-jobs">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View style={styles.header}>
          {showMenu ? (
            <Pressable
              onPress={openDrawer}
              style={styles.headerMenu}
              testID="jobs-open-drawer"
              accessibilityLabel="Open menu"
            >
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>≡</Text>
            </Pressable>
          ) : null}
          <Text style={typography.h1Large}>Available Jobs</Text>
          <Text style={{ color: colors.inkMuted, fontSize: 13, marginLeft: "auto" }}>
            {filtered.length} of {jobs.length}
          </Text>
        </View>

        {/* View-mode toggle */}
        <View style={styles.viewToggle} testID="driver-jobs-viewmode">
          <ToggleTab
            active={viewMode === "list"}
            onPress={() => setViewMode("list")}
            Icon={ListIcon}
            label="List"
            testID="driver-jobs-view-list"
          />
          <ToggleTab
            active={viewMode === "map"}
            onPress={() => setViewMode("map")}
            Icon={MapIcon}
            label="Map"
            testID="driver-jobs-view-map"
          />
        </View>

        {/* Search + advanced-filter toggle + refresh */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={colors.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search title, town or postcode…"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              testID="driver-jobs-search"
              returnKeyType="search"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={8}
                testID="driver-jobs-search-clear"
                accessibilityLabel="Clear"
              >
                <XIcon size={16} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setShowAdvanced((v) => !v)}
            style={[styles.iconBtn, activeFilterCount > 0 && { backgroundColor: colors.brand }]}
            testID="driver-jobs-advanced-toggle"
            accessibilityLabel="Filters"
          >
            <Filter size={16} color={activeFilterCount > 0 ? "#FFFFFF" : colors.ink} />
            {activeFilterCount > 0 ? (
              <View style={styles.iconBadge}>
                <Text style={styles.iconBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={load}
            style={styles.iconBtn}
            testID="driver-jobs-refresh"
            accessibilityLabel="Refresh"
          >
            <RefreshCw size={16} color={colors.ink} />
          </Pressable>
        </View>

        {/* Sort chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
          testID="sort-row"
        >
          {SORTS.map((s) => {
            const active = sort === s.key;
            const SIcon = s.Icon;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                style={[styles.sortChip, active && styles.sortChipActive]}
                testID={`sort-${s.key}`}
              >
                <SIcon size={13} color={active ? "#FFFFFF" : colors.ink} strokeWidth={2.2} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#FFFFFF" : colors.ink }}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Advanced filters panel */}
        {showAdvanced ? (
          <View style={styles.advPanel} testID="advanced-filters">
            <FilterRow label="Radius">
              {RADII.map((r) => (
                <Chip key={r} active={radius === r} onPress={() => setRadius(r)} testID={`radius-${r}`}>
                  {r} mi
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Pricing">
              {(["all", "fixed", "bidding"] as const).map((p) => (
                <Chip key={p} active={pricing === p} onPress={() => setPricing(p)} testID={`pricing-filter-${p}`}>
                  {p === "all" ? "All" : p === "fixed" ? "Fixed" : "Bidding"}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Price range (£)">
              <TextInput
                value={minPrice}
                onChangeText={setMinPrice}
                placeholder="Min"
                keyboardType="numeric"
                style={styles.priceInput}
                testID="filter-min-price"
              />
              <Text style={{ color: colors.inkMuted }}>–</Text>
              <TextInput
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="Max"
                keyboardType="numeric"
                style={styles.priceInput}
                testID="filter-max-price"
              />
            </FilterRow>
            <FilterRow label="Category">
              <Chip active={category === null} onPress={() => setCategory(null)} testID="cat-all">
                All
              </Chip>
              {categoryList.map((c) => (
                <Chip
                  key={c.key}
                  active={category === c.key}
                  onPress={() => setCategory(category === c.key ? null : c.key)}
                  testID={`cat-${c.key}`}
                >
                  {c.name}
                </Chip>
              ))}
            </FilterRow>
            {capabilityList.length > 0 ? (
              <FilterRow label="Required capabilities">
                {capabilityList.map((c) => (
                  <Chip
                    key={c.key}
                    active={selectedCaps.includes(c.key)}
                    onPress={() => toggleCap(c.key)}
                    testID={`cap-${c.key}`}
                  >
                    {c.name}
                  </Chip>
                ))}
              </FilterRow>
            ) : null}
            <FilterRow label="Vehicle size">
              {VEHICLE_SIZES.map(([key, label]) => (
                <Chip
                  key={key}
                  active={vehicleSize === key}
                  onPress={() => setVehicleSize(key)}
                  testID={`vehicle-size-${key}`}
                >
                  {label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Trip length">
              {TRIP_BANDS.map(([key, label]) => (
                <Chip
                  key={key}
                  active={tripBand === key}
                  onPress={() => setTripBand(key)}
                  testID={`trip-band-${key}`}
                >
                  {label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Service">
              {SERVICE_TYPES.map(([key, label]) => (
                <Chip
                  key={key}
                  active={serviceType === key}
                  onPress={() => setServiceType(key)}
                  testID={`service-type-${key}`}
                >
                  {label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Timing">
              {TIMINGS.map(([key, label]) => (
                <Chip
                  key={key}
                  active={timing === key}
                  onPress={() => setTiming(key)}
                  testID={`timing-${key}`}
                >
                  {label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Cargo aids">
              <Chip
                active={forkliftOnly}
                onPress={() => setForkliftOnly((v) => !v)}
                testID="forklift-only"
              >
                Forklift required
              </Chip>
              <Chip
                active={loadingHelpOnly}
                onPress={() => setLoadingHelpOnly((v) => !v)}
                testID="loading-help-only"
              >
                Loading help required
              </Chip>
            </FilterRow>
            {activeFilterCount > 0 ? (
              <Pressable
                onPress={resetAll}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
                testID="reset-filters"
              >
                <RefreshCcw size={14} color={colors.brand} />
                <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "700" }}>Reset all filters</Text>
              </Pressable>
            ) : null}
            {locStatus === "denied" || locStatus === "unavailable" ? (
              <View style={styles.locBanner} testID="jobs-location-banner">
                <Text style={{ fontSize: 12, color: colors.inkMuted }}>
                  Location {locStatus === "denied" ? "denied" : "unavailable"} — showing every eligible job (no
                  radius filter). Enable Location in Settings to sort by nearest.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* LIST view */}
        {viewMode === "list" ? (
          <View style={{ paddingHorizontal: 16, marginTop: 12, gap: 12 }} testID="driver-jobs-list">
            {filtered.length === 0 ? (
              <View style={styles.emptyBox} testID="driver-jobs-empty">
                <Compass size={40} color="#9CA3AF" />
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>
                  No jobs match your filters
                </Text>
                <Text style={{ fontSize: 13, color: colors.inkMuted, textAlign: "center" }}>
                  Try expanding the radius or resetting filters.
                </Text>
              </View>
            ) : (
              filtered.map((j) => <JobCard key={j.id} job={j} onPress={() => nav.navigate("JobDetail", { jobId: j.id })} />)
            )}
          </View>
        ) : null}

        {/* MAP view */}
        {viewMode === "map" ? (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }} testID="driver-jobs-map">
            <JobsMap
              driverLoc={driverLoc}
              jobs={filtered}
              onPin={(j) => setSelectedJob(j)}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom sheet for the tapped map pin */}
      {viewMode === "map" && selectedJob ? (
        <MapJobBottomSheet
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onOpen={() => {
            const id = selectedJob.id;
            setSelectedJob(null);
            nav.navigate("JobDetail", { jobId: id });
          }}
        />
      ) : null}
    </Page>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */

function ToggleTab({
  active,
  onPress,
  Icon,
  label,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  Icon: any;
  label: string;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleTab, active && styles.toggleTabActive]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Icon size={14} color={active ? "#FFFFFF" : colors.inkMuted} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#FFFFFF" : colors.inkMuted }}>{label}</Text>
    </Pressable>
  );
}

function Chip({
  active,
  onPress,
  children,
  testID,
}: {
  active?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      testID={testID}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#FFFFFF" : colors.ink }}>{children}</Text>
    </Pressable>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.filterRowLabel}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>{children}</View>
    </View>
  );
}

function JobCard({ job, onPress }: { job: J; onPress: () => void }) {
  const isFixed = job.pricing_type === "fixed";
  const price = isFixed ? job.fixed_price : (job.max_budget || job.suggested_price);
  const photos: string[] = Array.isArray(job.photos) ? job.photos : [];
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      testID={`driver-job-${job.id}`}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={styles.cardCategory} numberOfLines={1}>
            {String(job.category || "").replace(/_/g, " ")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.cardPrice}>£{Number(price || 0).toFixed(0)}</Text>
          <Text style={styles.cardPriceTag}>{isFixed ? "FIXED" : "MAX"}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <View style={styles.dotGreen} />
        <Text style={styles.cardRoute} numberOfLines={1}>
          {job.pickup_town} → {job.dropoff_town}
        </Text>
      </View>

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 10 }}
          testID={`driver-job-photos-strip-${job.id}`}
        >
          {photos.slice(0, 4).map((p, i) => (
            <Image key={`${job.id}-${i}`} source={{ uri: p }} style={styles.photoThumb} />
          ))}
          {photos.length > 4 ? (
            <View style={styles.photoOverflow}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.inkMuted }}>
                +{photos.length - 4}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      <View style={styles.acceptanceRow}>
        {job.recommended_vehicle ? (
          <Text style={styles.acceptanceText}>Suitable: {job.recommended_vehicle}</Text>
        ) : null}
        {job.needs_forklift ? <Text style={styles.acceptanceText}>· Forklift</Text> : null}
        {job.needs_loading_help ? <Text style={styles.acceptanceText}>· Loading help</Text> : null}
      </View>

      <View style={styles.cardFooter}>
        {job.distance_miles != null ? (
          <View style={styles.miniChip}>
            <Text style={styles.miniChipText}>{Number(job.distance_miles).toFixed(0)} mi job</Text>
          </View>
        ) : null}
        {job.distance_from_driver != null ? (
          <View style={styles.miniChip}>
            <Text style={styles.miniChipText}>{Number(job.distance_from_driver).toFixed(0)} mi away</Text>
          </View>
        ) : null}
        <View style={[styles.acceptTag, !isFixed && { backgroundColor: colors.brand }]}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: isFixed ? colors.ink : "#FFFFFF" }}>
            {isFixed ? "Accept" : "Bid"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function JobsMap({
  driverLoc,
  jobs,
  onPin,
}: {
  driverLoc: { lat: number; lng: number } | null;
  jobs: J[];
  onPin: (j: J) => void;
}) {
  const pinnable = useMemo(
    () => jobs.filter((j) => Number.isFinite(j.pickup_lat) && Number.isFinite(j.pickup_lng)),
    [jobs],
  );
  const centre: [number, number] = driverLoc
    ? [driverLoc.lng, driverLoc.lat]
    : pinnable[0]
    ? [Number(pinnable[0].pickup_lng), Number(pinnable[0].pickup_lat)]
    : [-0.1278, 51.5074]; // London fallback

  return (
    <View style={styles.mapWrap}>
      <Mapbox.MapView style={StyleSheet.absoluteFillObject} styleURL={Mapbox.StyleURL.Street}>
        <Mapbox.Camera zoomLevel={9} centerCoordinate={centre} animationDuration={0} />
        {driverLoc ? (
          <Mapbox.PointAnnotation id="driver" coordinate={[driverLoc.lng, driverLoc.lat]}>
            <View style={styles.driverPin}>
              <View style={styles.driverPinDot} />
            </View>
          </Mapbox.PointAnnotation>
        ) : null}
        {pinnable.map((j) => (
          <Mapbox.PointAnnotation
            key={j.id}
            id={`pin-${j.id}`}
            coordinate={[Number(j.pickup_lng), Number(j.pickup_lat)]}
            onSelected={() => onPin(j)}
          >
            <View style={styles.jobPin}>
              <Text style={styles.jobPinText}>£</Text>
            </View>
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>
      {jobs.length === 0 ? (
        <View style={styles.mapEmpty} pointerEvents="none">
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkMuted }}>
            No eligible jobs in this filter
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MapJobBottomSheet({
  job,
  onClose,
  onOpen,
}: {
  job: J;
  onClose: () => void;
  onOpen: () => void;
}) {
  const price = job.pricing_type === "fixed" ? job.fixed_price : (job.suggested_price || job.max_budget);
  const priceLabel = job.pricing_type === "fixed" ? "Earn" : "Max bid";
  return (
    <Pressable style={styles.sheetScrim} onPress={onClose} testID="driver-jobs-map-sheet">
      <Pressable style={styles.sheetCard} onPress={() => {}}>
        <Text style={styles.sheetKicker}>
          {job.service_timing === "asap" ? "ASAP" : "Scheduled"}
          {" · "}
          {String(job.service_type || "") === "breakdown_recovery" ? "Recovery" : "Transport"}
          {" · "}
          {job.pricing_type === "fixed" ? "Fixed" : "Bidding"}
        </Text>
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {job.title || `${job.pickup_town} → ${job.dropoff_town}`}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetMini}>{priceLabel}</Text>
            <Text style={styles.sheetPrice}>£{Number(price || 0).toFixed(0)}</Text>
          </View>
          <Pressable onPress={onOpen} style={styles.sheetCta} testID="driver-jobs-map-sheet-open">
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>Open job</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerMenu: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F4F4F4",
    alignItems: "center", justifyContent: "center",
  },
  viewToggle: {
    flexDirection: "row",
    gap: 4,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "#F4F4F4",
  },
  toggleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toggleTabActive: { backgroundColor: "#111111" },

  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    padding: 0,
  },
  iconBtn: {
    width: 44, height: 44,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    alignItems: "center", justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    top: -4, right: -4,
    minWidth: 16, height: 16,
    borderRadius: 999,
    backgroundColor: colors.ink,
    paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center",
  },
  iconBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },

  sortRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortChipActive: { backgroundColor: "#111111" },

  advPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
  },
  filterRowLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.inkMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#111111", borderColor: "#111111" },
  priceInput: {
    width: 80,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    fontSize: 13,
    color: colors.ink,
  },
  locBanner: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },

  emptyBox: {
    alignItems: "center",
    padding: 24,
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: "#F9FAFB",
  },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  cardCategory: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
    textTransform: "capitalize",
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  cardPriceTag: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.inkMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 2,
  },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16A34A" },
  cardRoute: { fontSize: 14, color: colors.ink, flex: 1 },
  photoThumb: {
    width: 56, height: 56,
    borderRadius: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#F4F4F4",
  },
  photoOverflow: {
    width: 56, height: 56,
    borderRadius: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#F4F4F4",
    alignItems: "center", justifyContent: "center",
  },
  acceptanceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  acceptanceText: { fontSize: 12, color: colors.inkMuted },
  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  miniChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F4F4F4",
  },
  miniChipText: { fontSize: 11, fontWeight: "600", color: colors.ink },
  acceptTag: {
    marginLeft: "auto",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F4F4F4",
  },

  mapWrap: {
    height: 520,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  mapEmpty: {
    position: "absolute",
    top: 20, alignSelf: "center",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  driverPin: {
    width: 20, height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(37,99,235,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  driverPinDot: {
    width: 12, height: 12,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    borderWidth: 2, borderColor: "#FFFFFF",
  },
  jobPin: {
    width: 32, height: 32,
    borderRadius: 999,
    backgroundColor: colors.brand,
    borderWidth: 2, borderColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  jobPinText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  sheetScrim: {
    position: "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetKicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.brand,
    textTransform: "uppercase",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 4,
  },
  sheetMini: { fontSize: 11, fontWeight: "700", color: colors.inkMuted, letterSpacing: 0.6, textTransform: "uppercase" },
  sheetPrice: { fontSize: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.3, marginTop: 2 },
  sheetCta: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
});
