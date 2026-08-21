/**
 * AddressAutocomplete — native equivalent of frontend
 * components/ui-portal/AddressAutocomplete.jsx.
 *
 * Uses the same server-side `/api/geo/autocomplete` and
 * `/api/geo/details` proxy so the Google key never touches the client.
 * When the backend has no key configured, `source === "manual"` and the
 * user falls through to a manual address form.
 *
 * Returned PlaceResult matches the exact shape the backend expects:
 *   { formatted_address, address_line, postcode, town, region,
 *     country, country_code, place_id, lat, lng }
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { MapPin, ChevronRight, Search, X } from "lucide-react-native";
import { SharedAPI, GeoSuggestion } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Input, Label, Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";

export interface PlaceResult {
  formatted_address: string;
  address_line?: string;
  postcode?: string;
  town?: string;
  region?: string;
  country?: string;
  country_code?: string;
  place_id?: string;
  lat: number;
  lng: number;
}

const MARKETS: { iso2: string; name: string; postalLabel: string }[] = [
  { iso2: "GB", name: "United Kingdom", postalLabel: "Postcode" },
  { iso2: "IE", name: "Ireland", postalLabel: "Eircode" },
  { iso2: "FR", name: "France", postalLabel: "Code postal" },
  { iso2: "DE", name: "Germany", postalLabel: "PLZ" },
  { iso2: "NL", name: "Netherlands", postalLabel: "Postcode" },
];

export function AddressAutocomplete({
  label,
  value,
  placeholder,
  onSelect,
  testID,
}: {
  label: string;
  value: PlaceResult | null;
  placeholder?: string;
  onSelect: (place: PlaceResult) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 12 }} testID={testID}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        testID={testID ? `${testID}-open` : "address-open"}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: radius.base,
            borderWidth: 1,
            borderColor: pressed ? colors.ink : colors.border,
            backgroundColor: colors.bg,
            paddingHorizontal: 12,
            paddingVertical: 12,
          },
        ]}
      >
        <MapPin size={20} color={colors.inkMuted} />
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 15, color: value ? colors.ink : colors.inkFaint }}
            numberOfLines={1}
          >
            {value?.formatted_address || placeholder || "Search address, postcode or place"}
          </Text>
          {value?.country_code ? (
            <Text style={[typography.small, { marginTop: 2 }]}>
              {MARKETS.find((m) => m.iso2 === value.country_code)?.name || value.country_code}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={colors.inkFaint} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <AddressPickerModal
          initial={value}
          onClose={() => setOpen(false)}
          onCommit={(place) => {
            onSelect(place);
            setOpen(false);
          }}
        />
      </Modal>
    </View>
  );
}

function AddressPickerModal({
  initial,
  onClose,
  onCommit,
}: {
  initial: PlaceResult | null;
  onClose: () => void;
  onCommit: (place: PlaceResult) => void;
}) {
  const [query, setQuery] = useState(initial?.formatted_address || "");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [source, setSource] = useState<"google" | "manual">("manual");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"search" | "review">(initial ? "review" : "search");
  const [form, setForm] = useState<PlaceResult>({
    formatted_address: initial?.formatted_address || "",
    address_line: initial?.address_line || "",
    postcode: initial?.postcode || "",
    town: initial?.town || "",
    region: initial?.region || "",
    country_code: initial?.country_code || "GB",
    country: initial?.country || "United Kingdom",
    place_id: initial?.place_id || "",
    lat: initial?.lat ?? 0,
    lng: initial?.lng ?? 0,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await SharedAPI.geoAutocomplete(query.trim());
        setSuggestions(res.suggestions || []);
        setSource(res.source || "manual");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const pickSuggestion = useCallback(
    async (s: GeoSuggestion) => {
      setForm((f) => ({
        ...f,
        formatted_address: s.formatted_address || query,
        town: s.town || f.town,
      }));
      setMode("review");
      if (!s.place_id) return;
      try {
        const d = await SharedAPI.geoDetails(s.place_id);
        if (d && d.source === "google") {
          setForm((f) => ({
            ...f,
            formatted_address: d.formatted_address || f.formatted_address,
            address_line: d.address_line || f.address_line,
            postcode: d.postcode || f.postcode,
            town: d.town || f.town,
            region: d.region || f.region,
            country_code: d.country_code || f.country_code,
            country: d.country || f.country,
            lat: d.lat ?? f.lat,
            lng: d.lng ?? f.lng,
          }));
        }
      } catch {
        /* keep manual review usable */
      }
    },
    [query],
  );

  const hasCoords = Number.isFinite(form.lat) && Number.isFinite(form.lng) && !(form.lat === 0 && form.lng === 0);
  const hasComposable =
    (form.address_line || "").trim().length > 0 &&
    (form.town || "").trim().length > 0 &&
    (form.postcode || "").trim().length > 0;
  const canCommit =
    ((form.formatted_address || "").trim().length > 0 || hasComposable) &&
    (hasCoords || ((form.postcode || "").trim().length > 0 && (form.town || "").trim().length > 0)) &&
    !!form.country_code;

  const commit = () => {
    if (!canCommit) return;
    const marketName =
      MARKETS.find((m) => m.iso2 === form.country_code)?.name || form.country_code || "";
    onCommit({
      ...form,
      country: form.country || marketName,
      formatted_address:
        form.formatted_address ||
        `${form.address_line || ""}, ${form.town || ""}, ${form.postcode || ""}`
          .trim()
          .replace(/^,\s*|,\s*$/g, ""),
    });
  };

  return (
    <Page bg={colors.bg}>
      <PageHeader
        title={mode === "search" ? "Search address" : "Confirm details"}
        subtitle="Pick address"
        right={
          <Pressable onPress={onClose} testID="address-close" hitSlop={8}>
            <X size={22} color={colors.ink} />
          </Pressable>
        }
      />
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {mode === "search" ? (
          <>
            <View style={styles.searchBox}>
              <Search size={16} color={colors.inkMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Search address, postcode or place"
                placeholderTextColor={colors.inkFaint}
                style={{ flex: 1, fontSize: 15, color: colors.ink }}
                testID="address-search-input"
              />
            </View>
            {source === "manual" ? (
              <Text style={[typography.small, { marginTop: 8 }]}>
                Autocomplete is not yet configured for this environment — you can enter the address manually below.
              </Text>
            ) : null}
            <FlatList
              data={suggestions}
              keyExtractor={(s, i) => s.place_id || `${s.formatted_address}-${i}`}
              ListEmptyComponent={
                loading ? (
                  <Text style={[typography.caption, { padding: 16 }]}>Searching…</Text>
                ) : query.trim().length >= 2 ? (
                  <Text style={[typography.caption, { padding: 16 }]}>
                    No suggestions. Try a fuller address or enter details manually.
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pickSuggestion(item)}
                  testID={`address-suggestion-${item.place_id || item.formatted_address}`}
                  style={({ pressed }) => [
                    styles.suggestion,
                    pressed && { backgroundColor: colors.bgSecondary },
                  ]}
                >
                  <MapPin size={16} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: colors.ink, fontWeight: "500" }}>
                      {item.formatted_address}
                    </Text>
                    {item.town ? <Text style={typography.small}>{item.town}</Text> : null}
                  </View>
                </Pressable>
              )}
            />
            <View style={{ paddingVertical: 12 }}>
              <SecondaryButton
                title="Enter address manually"
                onPress={() => setMode("review")}
                testID="address-manual-btn"
              />
            </View>
          </>
        ) : (
          <View>
            <Label>Address line</Label>
            <Input
              value={form.address_line}
              onChangeText={(v) => setForm((f) => ({ ...f, address_line: v }))}
              placeholder="Street, unit, building"
              testID="address-line"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Label>Postcode</Label>
                <Input
                  value={form.postcode}
                  onChangeText={(v) => setForm((f) => ({ ...f, postcode: v }))}
                  placeholder={MARKETS.find((m) => m.iso2 === form.country_code)?.postalLabel || "Postcode"}
                  testID="address-postcode"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label>Town / City</Label>
                <Input
                  value={form.town}
                  onChangeText={(v) => setForm((f) => ({ ...f, town: v }))}
                  placeholder="e.g. London"
                  testID="address-town"
                />
              </View>
            </View>
            <Label>Region (optional)</Label>
            <Input
              value={form.region}
              onChangeText={(v) => setForm((f) => ({ ...f, region: v }))}
              placeholder="e.g. Greater London"
              testID="address-region"
            />
            <Label>Country</Label>
            <View style={styles.marketRow}>
              {MARKETS.map((m) => {
                const active = form.country_code === m.iso2;
                return (
                  <Pressable
                    key={m.iso2}
                    onPress={() =>
                      setForm((f) => ({ ...f, country_code: m.iso2, country: m.name }))
                    }
                    testID={`address-country-${m.iso2}`}
                    style={[styles.marketChip, active && styles.marketChipActive]}
                  >
                    <Text style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "600" }}>
                      {m.iso2}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Label>Full address (auto-composed when blank)</Label>
            <Input
              value={form.formatted_address}
              onChangeText={(v) => setForm((f) => ({ ...f, formatted_address: v }))}
              testID="address-formatted"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton title="Back to search" onPress={() => setMode("search")} testID="address-back" />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Save address"
                  onPress={commit}
                  disabled={!canCommit}
                  testID="address-save"
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </Page>
  );
}

const styles = {
  searchBox: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  suggestion: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  marketRow: { flexDirection: "row" as const, gap: 6, marginBottom: 12 },
  marketChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  marketChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
};
