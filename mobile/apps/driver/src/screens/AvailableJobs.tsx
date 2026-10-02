/**
 * CargoOne Driver — Available Jobs.
 *
 * Faithful mobile adaptation of /driver/jobs
 * (frontend/src/pages/portal/driver/Jobs.jsx).
 *
 * Phase 3 scope:
 *   • Real data via DriverAPI.nearbyJobs() + DriverAPI.capabilities()
 *   • Search by title/town/postcode
 *   • Sort chips: Nearest / Newest / Highest £ / Shortest job
 *   • Pricing filter: All / Fixed / Bidding (chip row)
 *   • Loading, error, and empty states; pull-to-refresh; refresh button
 *   • Job card: title/category, price + MAX/FIXED label, pickup → dropoff
 *     with route dot, distances, Accept|Bid chip, photo strip when present
 *
 * Deferred (needs native deps outside the current Phase 2C baseline):
 *   • Map view        → requires @rnmapbox/maps (excluded)
 *   • Geolocation     → requires expo-location (excluded)
 *   • Advanced filter sheet (vehicle size / trip band / service / timing /
 *     cargo aids / capability chips / min-max price). Backend data is
 *     available; left for a dedicated filters phase so this screen stays
 *     focused and polished.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { DriverAPI, type Job } from "@cargoone/core";
import {
  Page, PageHeader, Section, Icon, IconButton, Card, Caption,
  EmptyState, PrimaryButton, colors, radius, space, typography,
} from "../ui";

type Sort = "nearest" | "newest" | "highest_price" | "distance_asc";
type Pricing = "all" | "fixed" | "bidding";

const SORTS: { key: Sort; label: string; icon: React.ComponentProps<typeof Icon>["name"] }[] = [
  { key: "nearest",       label: "Nearest",       icon: "navigation" },
  { key: "newest",        label: "Newest",        icon: "clock" },
  { key: "highest_price", label: "Highest £",     icon: "trending-up" },
  { key: "distance_asc",  label: "Shortest job",  icon: "maximize-2" },
];

const PRICINGS: { key: Pricing; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "fixed",   label: "Fixed" },
  { key: "bidding", label: "Bidding" },
];

export default function AvailableJobsScreen() {
  const nav = useNavigation<any>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [pricing, setPricing] = useState<Pricing>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      // No geolocation in mobile Phase 3 — backend returns ALL eligible
      // posted jobs when lat/lng are omitted (confirmed in Jobs.jsx:62).
      const list = await DriverAPI.nearbyJobs();
      setJobs(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || "Couldn't load available jobs.");
    }
  }, []);

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = jobs.filter((j) => {
      if (pricing !== "all" && j.pricing_type !== pricing) return false;
      if (q) {
        const hay = `${j.title || ""} ${j.description || ""} ${j.pickup_town || ""} ${j.dropoff_town || ""} ${(j as any).pickup_postcode || ""} ${(j as any).dropoff_postcode || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...list];
    if (sort === "nearest") {
      sorted.sort((a, b) => ((a as any).distance_from_driver ?? 1e9) - ((b as any).distance_from_driver ?? 1e9));
    } else if (sort === "newest") {
      sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    } else if (sort === "highest_price") {
      const price = (j: Job) =>
        Number(j.pricing_type === "fixed" ? j.fixed_price : (j as any).max_budget || (j as any).suggested_price || 0);
      sorted.sort((a, b) => price(b) - price(a));
    } else if (sort === "distance_asc") {
      sorted.sort((a, b) => (a.distance_miles ?? 1e9) - (b.distance_miles ?? 1e9));
    }
    return sorted;
  }, [jobs, pricing, query, sort]);

  if (loading) {
    return (
      <Page testID="driver-available-jobs-loading">
        <PageHeader title="Available Jobs" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </Page>
    );
  }

  return (
    <Page
      testID="driver-available-jobs"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
      }
    >
      <PageHeader
        title="Available Jobs"
        subtitle={`${filtered.length} of ${jobs.length}`}
        right={
          <IconButton
            testID="driver-available-refresh"
            accessibilityLabel="Refresh"
            onPress={onRefresh}
          >
            <Icon name="refresh-cw" size={20} />
          </IconButton>
        }
      />

      {/* Search */}
      <Section>
        <View style={styles.searchRow}>
          <Icon name="search" size={18} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search title, town or postcode…"
            placeholderTextColor={colors.inkFaint}
            style={styles.searchInput}
            testID="driver-jobs-search"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} testID="driver-jobs-search-clear">
              <Icon name="x" size={16} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>
      </Section>

      {/* Sort chips */}
      <ChipRow testID="driver-jobs-sort-row">
        {SORTS.map((s) => (
          <Chip
            key={s.key}
            active={sort === s.key}
            onPress={() => setSort(s.key)}
            testID={`driver-jobs-sort-${s.key}`}
            icon={s.icon}
          >
            {s.label}
          </Chip>
        ))}
      </ChipRow>

      {/* Pricing filter */}
      <ChipRow testID="driver-jobs-pricing-row">
        {PRICINGS.map((p) => (
          <Chip
            key={p.key}
            active={pricing === p.key}
            onPress={() => setPricing(p.key)}
            testID={`driver-jobs-pricing-${p.key}`}
          >
            {p.label}
          </Chip>
        ))}
      </ChipRow>

      {/* Error */}
      {error ? (
        <Section>
          <View style={styles.errorBanner} testID="driver-available-jobs-error">
            <Icon name="alert-triangle" size={16} color={colors.error} />
            <Text style={{ flex: 1, color: colors.error, fontSize: 13 }}>{error}</Text>
            <Pressable onPress={onRefresh} hitSlop={8}>
              <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "700" }}>Retry</Text>
            </Pressable>
          </View>
        </Section>
      ) : null}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          testID="driver-available-jobs-empty"
          glyph="compass"
          title={query || pricing !== "all" ? "No jobs match your filters" : "No jobs posted right now"}
          body={query || pricing !== "all"
            ? "Clear filters to see every eligible job."
            : "Pull to refresh — new jobs appear here as customers post them."
          }
          action={query || pricing !== "all" ? (
            <PrimaryButton
              title="Clear filters"
              variant="secondary"
              onPress={() => { setQuery(""); setPricing("all"); }}
              testID="driver-jobs-clear-filters"
            />
          ) : null}
        />
      ) : (
        <Section>
          {filtered.map((j) => (
            <JobCard key={j.id} job={j} onPress={() => nav.navigate("JobDetail", { jobId: j.id })} />
          ))}
        </Section>
      )}
    </Page>
  );
}

/* ----------------------------- Job card ---------------------------- */

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const isFixed = job.pricing_type === "fixed";
  const priceValue = isFixed ? job.fixed_price : (job as any).max_budget ?? (job as any).suggested_price ?? 0;
  const priceLabel = isFixed ? "FIXED" : "MAX";
  const ctaLabel = isFixed ? "Accept" : "Bid";
  const photos = Array.isArray((job as any).photos) ? ((job as any).photos as string[]) : [];
  return (
    <Card onPress={onPress} testID={`driver-job-${job.id}`} style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={typography.cardTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={[typography.caption, { marginTop: 2, textTransform: "capitalize" }]} numberOfLines={1}>
            {(job.category || "").replace(/_/g, " ")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={typography.priceBig}>£{Number(priceValue || 0).toFixed(0)}</Text>
          <Text style={typography.micro}>{priceLabel}</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.greenDot} />
        <Text style={styles.routeTown} numberOfLines={1}>{job.pickup_town || "—"}</Text>
        <Text style={styles.routeArrow}>→</Text>
        <Text style={styles.routeTown} numberOfLines={1}>{job.dropoff_town || "—"}</Text>
      </View>

      {photos.length > 0 ? (
        <View style={styles.photoStrip} testID={`driver-job-photos-${job.id}`}>
          {photos.slice(0, 4).map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.photo} />
          ))}
          {photos.length > 4 ? (
            <View style={[styles.photo, styles.photoMore]}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.inkMuted }}>
                +{photos.length - 4}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        {typeof job.distance_miles === "number" ? (
          <MetaChip>{job.distance_miles} mi job</MetaChip>
        ) : null}
        {typeof (job as any).distance_from_driver === "number" ? (
          <MetaChip>{(job as any).distance_from_driver} mi away</MetaChip>
        ) : null}
        <View style={{ flex: 1 }} />
        <View style={[styles.cta, isFixed ? styles.ctaFixed : styles.ctaBid]}>
          <Text style={isFixed ? styles.ctaFixedText : styles.ctaBidText}>{ctaLabel}</Text>
        </View>
      </View>
    </Card>
  );
}

/* --------------------------- Chip helpers --------------------------- */

function ChipRow({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.chipRow} testID={testID}>
      {children}
    </View>
  );
}

function Chip({
  children, active, onPress, testID, icon,
}: {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
  icon?: React.ComponentProps<typeof Icon>["name"];
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        pressed && !active ? { backgroundColor: colors.bgSecondary } : null,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={14} color={active ? colors.inkInverse : colors.ink} />
      ) : null}
      <Text style={active ? styles.chipActiveText : styles.chipInactiveText}>{children}</Text>
    </Pressable>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{children}</Text>
    </View>
  );
}

/* ------------------------------ Styles ------------------------------ */

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },

  searchRow: {
    flexDirection: "row", alignItems: "center", gap: space[2],
    borderRadius: radius.base, backgroundColor: colors.bgSecondary,
    paddingHorizontal: 14, paddingVertical: space[3],
  },
  searchInput: {
    flex: 1, color: colors.ink, fontSize: 14,
    padding: 0, margin: 0,
  },

  chipRow: {
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill,
  },
  chipInactive: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.ink },
  chipInactiveText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  chipActiveText: { color: colors.inkInverse, fontSize: 13, fontWeight: "700" },

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: space[2],
    borderRadius: radius.base,
    backgroundColor: colors.errorBg,
    borderWidth: 1, borderColor: colors.error,
    padding: space[3],
  },

  routeRow: {
    flexDirection: "row", alignItems: "center", gap: space[2],
    marginTop: 2,
  },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  routeArrow: { color: colors.inkFaint, fontSize: 14 },
  routeTown: { fontSize: 14, color: colors.ink, flexShrink: 1 },

  photoStrip: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  photo: {
    width: 56, height: 56, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  photoMore: { alignItems: "center", justifyContent: "center" },

  metaRow: {
    flexDirection: "row", alignItems: "center", gap: space[2],
    borderTopWidth: 1, borderTopColor: colors.hairline,
    paddingTop: space[2], marginTop: space[1], flexWrap: "wrap",
  },
  metaChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.bgSecondary,
  },
  metaChipText: { fontSize: 12, color: colors.inkMuted, fontWeight: "500" },
  cta: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill,
  },
  ctaFixed: { backgroundColor: colors.bgSecondary },
  ctaFixedText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  ctaBid: { backgroundColor: colors.brand },
  ctaBidText: { color: colors.inkInverse, fontSize: 12, fontWeight: "700" },
});

export { AvailableJobsScreen };
