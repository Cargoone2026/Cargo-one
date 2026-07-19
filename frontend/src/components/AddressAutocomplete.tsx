import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import {
  DEFAULT_MAP_CENTER,
  SUPPORTED_ISO2,
  SUPPORTED_MARKETS,
  marketName,
} from "@/src/config/markets";
import { colors, font, radius, spacing, weight } from "@/src/theme";

/**
 * Full international address / place result used throughout Cargo One.
 * `country_code` (ISO2) is the discriminator used by the backend to
 * classify routes as domestic-UK, domestic-other, international or
 * unsupported.
 */
export type PlaceResult = {
  formatted_address: string;
  address_line?: string;
  postcode: string;        // includes Eircode / codigo postal / PLZ etc.
  town: string;
  region?: string;         // county / state / province
  country?: string;        // display name (e.g. "United Kingdom")
  country_code?: string;   // ISO 3166-1 alpha-2 (e.g. "GB", "IE", "FR")
  place_id?: string;       // Google Place ID when available
  lat: number;
  lng: number;
};

type Props = {
  label: string;
  value?: PlaceResult | null;
  placeholder?: string;
  testID?: string;
  onSelect: (p: PlaceResult) => void;
};

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
// react-native-webview does not support web; on web we use the manual picker.
const GOOGLE_PICKER_ENABLED = !!GOOGLE_KEY && Platform.OS !== "web";

export function AddressAutocomplete({ label, value, placeholder, onSelect, testID }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.field}
        testID={testID}
      >
        <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.fieldText, !value && { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {value?.formatted_address || placeholder || "Search address, postcode or place"}
          </Text>
          {value?.country_code ? (
            <Text style={styles.fieldCountry}>{marketName(value.country_code)}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        {GOOGLE_PICKER_ENABLED ? (
          <GooglePicker
            apiKey={GOOGLE_KEY}
            initial={value}
            onCancel={() => setOpen(false)}
            onSelect={(p) => { onSelect(p); setOpen(false); }}
          />
        ) : (
          <ManualPicker
            initial={value}
            onCancel={() => setOpen(false)}
            onSelect={(p) => { onSelect(p); setOpen(false); }}
          />
        )}
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Google Places WebView picker — Europe-ready (no GB-only restriction)
// ---------------------------------------------------------------------------
function GooglePicker({
  apiKey, initial, onCancel, onSelect,
}: {
  apiKey: string;
  initial?: PlaceResult | null;
  onCancel: () => void;
  onSelect: (p: PlaceResult) => void;
}) {
  // Build the country list once. Google supports a `country` array of up to 5
  // ISO2 codes (as of 2024) — if we exceed that we omit the restriction and
  // rely on regional bias instead.
  const countryClause = SUPPORTED_ISO2.length <= 5
    ? `componentRestrictions: { country: ${JSON.stringify(SUPPORTED_ISO2.map((c) => c.toLowerCase()))} },`
    : `// componentRestrictions omitted (>5 markets) — using regional bias instead`;

  const html = useMemo(() => `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
<style>
  html,body{margin:0;padding:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;}
  #search{position:absolute;top:12px;left:12px;right:12px;z-index:10;background:#fff;
    border:1px solid #E5E7EB;border-radius:12px;padding:14px 16px;font-size:16px;
    box-shadow:0 6px 20px rgba(0,0,0,0.12);outline:none;color:#111;}
  #map{height:100%;width:100%;}
  .pac-container{border-radius:12px;margin-top:6px;box-shadow:0 8px 24px rgba(0,0,0,0.15);border:none;}
  .pac-item{padding:12px 16px;border-top:1px solid #F3F4F6;}
  .pac-item:first-child{border-top:none;}
</style>
</head><body>
<input id="search" placeholder="Search address, postcode, Eircode or place…" autocomplete="off" />
<div id="map"></div>
<script>
  let map, marker, autocomplete;
  const post = (data) => window.ReactNativeWebView.postMessage(JSON.stringify(data));
  function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
      center: ${JSON.stringify(initial ? { lat: initial.lat, lng: initial.lng } : DEFAULT_MAP_CENTER)},
      zoom: ${initial ? 15 : 5},
      disableDefaultUI: true, gestureHandling: "greedy",
    });
    marker = new google.maps.Marker({
      map, ${initial ? `position: ${JSON.stringify({ lat: initial.lat, lng: initial.lng })},` : ""}
      icon: {
        path: "M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z",
        fillColor: "#D62828", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3,
        scale: 1.2, anchor: new google.maps.Point(12, 32),
      },
    });
    const input = document.getElementById("search");
    autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ["place_id", "formatted_address", "geometry", "address_components", "name"],
      ${countryClause}
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place || !place.geometry) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      map.setCenter({ lat, lng }); map.setZoom(15);
      marker.setPosition({ lat, lng });
      let postcode = "", town = "", region = "", country = "", country_code = "", address_line = "";
      let route = "", street_number = "";
      (place.address_components || []).forEach(c => {
        const t = c.types || [];
        if (t.indexOf("postal_code") >= 0) postcode = c.long_name;
        if (t.indexOf("postal_town") >= 0) town = c.long_name;
        if (!town && t.indexOf("locality") >= 0) town = c.long_name;
        if (!town && t.indexOf("administrative_area_level_2") >= 0) town = c.long_name;
        if (t.indexOf("administrative_area_level_1") >= 0) region = c.long_name;
        if (t.indexOf("country") >= 0) { country = c.long_name; country_code = c.short_name; }
        if (t.indexOf("route") >= 0) route = c.long_name;
        if (t.indexOf("street_number") >= 0) street_number = c.long_name;
      });
      address_line = [street_number, route].filter(Boolean).join(" ").trim();
      post({
        place_id: place.place_id || "",
        formatted_address: place.formatted_address || place.name || "",
        address_line, postcode, town, region, country, country_code,
        lat, lng,
      });
    });
  }
  window.initMap = initMap;
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap"></script>
</body></html>`, [apiKey, initial, countryClause]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const p = JSON.parse(e.nativeEvent.data);
      onSelect(p);
    } catch {
      // ignore
    }
  }, [onSelect]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "bottom"]}>
      <View style={styles.modalHeader}>
        <Pressable onPress={onCancel} hitSlop={12} testID="autocomplete-cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.modalTitle}>Search address</Text>
        <View style={{ width: 60 }} />
      </View>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1 }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Manual picker — used on web and when no Google key is configured.
//
// UX: one primary search field, backend lookup (which will proxy to Google
// server-side once the key is configured). Manual entry is available via
// an "Enter address manually" toggle for offline/edge cases.
// ---------------------------------------------------------------------------
type BackendSuggestion = {
  formatted_address: string;
  address_line?: string;
  postcode?: string;
  town?: string;
  region?: string;
  country?: string;
  country_code?: string;
  place_id?: string;
  lat?: number;
  lng?: number;
  source?: string;
};

function ManualPicker({
  initial, onCancel, onSelect,
}: {
  initial?: PlaceResult | null;
  onCancel: () => void;
  onSelect: (p: PlaceResult) => void;
}) {
  const [query, setQuery] = useState(initial?.formatted_address || "");
  const [suggestions, setSuggestions] = useState<BackendSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<"search" | "manual">("search");

  // Manual fields
  const [addressLine, setAddressLine] = useState(initial?.address_line || "");
  const [town, setTown] = useState(initial?.town || "");
  const [postcode, setPostcode] = useState(initial?.postcode || "");
  const [country, setCountry] = useState(initial?.country_code || "GB");
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<any>(null);
  const abortRef = useRef<any>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (abortRef.current) abortRef.current.aborted = true;
    const guard = { aborted: false } as { aborted: boolean };
    abortRef.current = guard;
    try {
      // Import lazily to avoid coupling — the api client handles auth headers.
      const { api } = await import("@/src/api/client");
      const res = await api<{ suggestions: BackendSuggestion[]; source: string }>(
        `/geo/autocomplete?q=${encodeURIComponent(q)}`,
        { auth: false },
      );
      if (!guard.aborted) setSuggestions(res.suggestions || []);
    } catch {
      if (!guard.aborted) setSuggestions([]);
    } finally {
      if (!guard.aborted) setSearching(false);
    }
  }, []);

  const onChangeQuery = useCallback((v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v), 250);
  }, [runSearch]);

  const pickSuggestion = useCallback((s: BackendSuggestion) => {
    onSelect({
      formatted_address: s.formatted_address,
      address_line: s.address_line || "",
      postcode: s.postcode || "",
      town: s.town || "",
      region: s.region || "",
      country: s.country || "",
      country_code: s.country_code || "",
      place_id: s.place_id || "",
      lat: Number(s.lat) || 0,
      lng: Number(s.lng) || 0,
    });
  }, [onSelect]);

  const confirmManual = useCallback(() => {
    if (!addressLine.trim() && !town.trim()) return;
    const displayCountry = marketName(country);
    const formatted = [addressLine.trim(), town.trim(), postcode.trim(), displayCountry]
      .filter(Boolean)
      .join(", ");
    onSelect({
      formatted_address: formatted,
      address_line: addressLine.trim(),
      postcode: postcode.trim(),
      town: town.trim(),
      country: displayCountry,
      country_code: country,
      // Manual entry has no coordinates; backend estimator will treat these as
      // an "unresolved" address and return an international-review state.
      lat: 0,
      lng: 0,
    });
  }, [addressLine, town, postcode, country, onSelect]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onCancel} hitSlop={12} testID="autocomplete-cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {mode === "search" ? "Search address" : "Enter address"}
          </Text>
          {mode === "manual" ? (
            <Pressable
              onPress={confirmManual}
              hitSlop={12}
              testID="autocomplete-done"
              disabled={!addressLine.trim() && !town.trim()}
            >
              <Text
                style={[
                  styles.cancelText,
                  { color: (addressLine.trim() || town.trim()) ? colors.brand : colors.textTertiary },
                ]}
              >
                Done
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {mode === "search" ? (
          <View style={{ flex: 1 }}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={onChangeQuery}
                placeholder="e.g. SW1A 1AA, D02 X285, Dublin, Berlin…"
                placeholderTextColor={colors.textTertiary}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
                testID="address-search-input"
              />
              {query.length > 0 && (
                <Pressable onPress={() => onChangeQuery("")} testID="address-search-clear">
                  <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>

            {searching && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.brand} />
                <Text style={styles.loadingText}>Searching…</Text>
              </View>
            )}

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
              {suggestions.length > 0 && suggestions.map((s, i) => (
                <Pressable
                  key={`${s.place_id || s.formatted_address}-${i}`}
                  onPress={() => pickSuggestion(s)}
                  style={styles.suggestionRow}
                  testID={`address-suggestion-${i}`}
                >
                  <Ionicons name="location" size={18} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggTitle} numberOfLines={1}>{s.formatted_address}</Text>
                    <Text style={styles.suggSub} numberOfLines={1}>
                      {[s.town, s.region, marketName(s.country_code || "")].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </Pressable>
              ))}

              {!searching && query.trim().length >= 2 && suggestions.length === 0 && (
                <View style={styles.emptyBox}>
                  <Ionicons name="location-outline" size={28} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No matches yet</Text>
                  <Text style={styles.emptySub}>
                    Live autocomplete activates once a production Google Places key
                    is configured. Meanwhile you can enter the address manually below.
                  </Text>
                </View>
              )}

              <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>Try searching</Text>
                <View style={styles.chipRow}>
                  {["SW1A 1AA", "BT1 5GS", "D02 X285", "Dublin", "Belfast", "Paris"].map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => onChangeQuery(h)}
                      style={styles.hintChip}
                      testID={`address-hint-${h}`}
                    >
                      <Text style={styles.hintChipText}>{h}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={() => setMode("manual")}
                style={styles.manualBtn}
                testID="address-mode-manual"
              >
                <Ionicons name="create-outline" size={18} color={colors.brand} />
                <Text style={styles.manualBtnText}>Enter address manually</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => setMode("search")}
              style={styles.backLink}
              testID="address-mode-search"
            >
              <Ionicons name="arrow-back" size={16} color={colors.brand} />
              <Text style={styles.backLinkText}>Back to search</Text>
            </Pressable>

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Country</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {SUPPORTED_MARKETS.map((m) => (
                <Pressable
                  key={m.iso2}
                  onPress={() => setCountry(m.iso2)}
                  style={[styles.chip, country === m.iso2 && styles.chipActive]}
                  testID={`manual-country-${m.iso2}`}
                >
                  <Text style={[styles.chipText, country === m.iso2 && styles.chipTextActive]}>
                    {m.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Address line</Text>
            <TextInput
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="e.g. 22 Baker Street"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              testID="manual-address-line"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Town / city</Text>
            <TextInput
              value={town}
              onChangeText={setTown}
              placeholder="e.g. London, Belfast, Dublin"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              testID="manual-town"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
              {SUPPORTED_MARKETS.find((m) => m.iso2 === country)?.postalCodeLabel || "Postcode"}
            </Text>
            <TextInput
              value={postcode}
              onChangeText={setPostcode}
              placeholder={country === "IE" ? "e.g. D02 X285" : country === "GB" ? "e.g. SW1A 1AA" : "Postal code"}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCapitalize="characters"
              testID="manual-postcode"
            />

            <View style={styles.note}>
              <Ionicons name="information-circle" size={18} color={colors.info} />
              <Text style={styles.noteText}>
                For UK, Northern Ireland, Republic of Ireland and Europe. Cross-border routes are
                supported architecturally; pricing for non-UK routes will be reviewed by our team.
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// Fix: import postal_code_label from backend model — actually the frontend
// markets.ts uses `postalCodeLabel`. We already imported SUPPORTED_MARKETS
// above. The extends declaration below is intentionally empty — postalCodeLabel
// is already on the Market type.
export {};

const styles = StyleSheet.create({
  label: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    minHeight: 52,
  },
  fieldText: { fontSize: font.lg, color: colors.text },
  fieldCountry: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  modalTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  cancelText: { fontSize: font.base, color: colors.brand, fontWeight: weight.medium, width: 60 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    margin: spacing.xl, paddingHorizontal: spacing.md, paddingVertical: Platform.OS === "ios" ? 12 : 6,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
  },
  searchInput: {
    flex: 1, color: colors.text, fontSize: font.base, padding: 0,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {}),
  },
  loadingRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  loadingText: { color: colors.textSecondary, fontSize: font.sm },
  suggestionRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  suggTitle: { fontSize: font.base, color: colors.text, fontWeight: weight.semibold },
  suggSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  emptyBox: {
    alignItems: "center", padding: spacing.xxl, gap: spacing.sm,
  },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  emptySub: { fontSize: font.base, color: colors.textSecondary, textAlign: "center", maxWidth: 340 },
  hintBox: { padding: spacing.xl, gap: spacing.sm },
  hintTitle: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.bold,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  hintChip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.bgSecondary,
    borderRadius: radius.pill,
  },
  hintChipText: { color: colors.text, fontSize: font.sm, fontWeight: weight.medium },
  manualBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    marginHorizontal: spacing.xl, marginTop: spacing.md,
    paddingVertical: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.brand,
  },
  manualBtnText: { color: colors.brand, fontWeight: weight.bold, fontSize: font.base },
  backLink: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start",
  },
  backLinkText: { color: colors.brand, fontWeight: weight.semibold, fontSize: font.base },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: font.base, fontWeight: weight.medium },
  chipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    fontSize: font.lg, color: colors.text,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {}),
  },
  note: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.infoBg, borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  noteText: { flex: 1, color: colors.text, fontSize: font.sm, lineHeight: 18 },
});
