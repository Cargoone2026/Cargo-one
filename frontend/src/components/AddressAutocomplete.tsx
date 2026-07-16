import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
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

import { colors, font, radius, spacing, weight } from "@/src/theme";

export type PlaceResult = {
  formatted_address: string;
  postcode: string;
  town: string;
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
// react-native-webview does not support web; fall back to native picker there.
const GOOGLE_PICKER_ENABLED = !!GOOGLE_KEY && Platform.OS !== "web";

// UK preset towns (fallback when no Google key)
const FALLBACK_TOWNS: Record<string, { lat: number; lng: number }> = {
  London: { lat: 51.5074, lng: -0.1278 },
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Birmingham: { lat: 52.4862, lng: -1.8904 },
  Liverpool: { lat: 53.4084, lng: -2.9916 },
  Leeds: { lat: 53.8008, lng: -1.5491 },
  Bristol: { lat: 51.4545, lng: -2.5879 },
  Glasgow: { lat: 55.8642, lng: -4.2518 },
  Edinburgh: { lat: 55.9533, lng: -3.1883 },
  Cardiff: { lat: 51.4816, lng: -3.1791 },
  Newcastle: { lat: 54.9783, lng: -1.6178 },
  Sheffield: { lat: 53.3811, lng: -1.4701 },
  Nottingham: { lat: 52.9548, lng: -1.1581 },
};

/**
 * AddressAutocomplete opens a fullscreen modal that lets the user search an
 * address. Uses Google Places Autocomplete when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 * is set; otherwise shows a UK town picker + address input. The result
 * shape is identical, so callers don't need to branch.
 */
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
        <Text
          style={[styles.fieldText, !value && { color: colors.textTertiary }]}
          numberOfLines={1}
        >
          {value?.formatted_address || placeholder || "Search address"}
        </Text>
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
          <FallbackPicker
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
// Google Places WebView picker
// ---------------------------------------------------------------------------
function GooglePicker({
  apiKey, initial, onCancel, onSelect,
}: {
  apiKey: string;
  initial?: PlaceResult | null;
  onCancel: () => void;
  onSelect: (p: PlaceResult) => void;
}) {
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
<input id="search" placeholder="Search address, postcode..." />
<div id="map"></div>
<script>
  let map, marker, autocomplete;
  const post = (data) => window.ReactNativeWebView.postMessage(JSON.stringify(data));
  function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
      center: ${JSON.stringify(initial ? { lat: initial.lat, lng: initial.lng } : { lat: 54.5, lng: -2.5 })},
      zoom: ${initial ? 15 : 6},
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
      fields: ["formatted_address", "geometry", "address_components", "name"],
      componentRestrictions: { country: "gb" },
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place || !place.geometry) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      map.setCenter({ lat, lng }); map.setZoom(15);
      marker.setPosition({ lat, lng });
      let postcode = "", town = "";
      (place.address_components || []).forEach(c => {
        if (c.types.indexOf("postal_code") >= 0) postcode = c.long_name;
        if (c.types.indexOf("postal_town") >= 0) town = c.long_name;
        if (!town && c.types.indexOf("locality") >= 0) town = c.long_name;
      });
      post({
        formatted_address: place.formatted_address || place.name || "",
        postcode, town, lat, lng,
      });
    });
  }
  window.initMap = initMap;
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap"></script>
</body></html>`, [apiKey, initial]);

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
// Fallback picker (no Google key)
// ---------------------------------------------------------------------------
function FallbackPicker({
  initial, onCancel, onSelect,
}: {
  initial?: PlaceResult | null;
  onCancel: () => void;
  onSelect: (p: PlaceResult) => void;
}) {
  const [town, setTown] = useState(initial?.town || "London");
  const [street, setStreet] = useState(
    initial?.formatted_address?.split(",")[0] || "",
  );
  const [postcode, setPostcode] = useState(initial?.postcode || "");
  const inputRef = useRef<TextInput>(null);

  function confirm() {
    if (!street.trim()) return;
    const coords = FALLBACK_TOWNS[town] || FALLBACK_TOWNS.London;
    onSelect({
      formatted_address: `${street.trim()}, ${town}${postcode ? ", " + postcode : ""}`,
      postcode,
      town,
      lat: coords.lat,
      lng: coords.lng,
    });
  }

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
          <Text style={styles.modalTitle}>Enter address</Text>
          <Pressable onPress={confirm} hitSlop={12} testID="autocomplete-done">
            <Text style={[styles.cancelText, { color: street.trim() ? colors.brand : colors.textTertiary }]}>
              Done
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Town</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {Object.keys(FALLBACK_TOWNS).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTown(t)}
                style={[styles.chip, town === t && styles.chipActive]}
                testID={`fallback-town-${t}`}
              >
                <Text style={[styles.chipText, town === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Street address</Text>
          <TextInput
            ref={inputRef}
            value={street}
            onChangeText={setStreet}
            placeholder="e.g. 22 Baker Street"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            testID="fallback-street-input"
            autoFocus
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Postcode (optional)</Text>
          <TextInput
            value={postcode}
            onChangeText={setPostcode}
            placeholder="e.g. NW1 6XE"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            autoCapitalize="characters"
            testID="fallback-postcode-input"
          />

          <View style={styles.note}>
            <Ionicons name="information-circle" size={18} color={colors.info} />
            <Text style={styles.noteText}>
              Real-time Google Places search will activate once a production API key is configured.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  field: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    minHeight: 52,
  },
  fieldText: { flex: 1, fontSize: font.lg, color: colors.text },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  modalTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  cancelText: { fontSize: font.base, color: colors.brand, fontWeight: weight.medium, width: 60 },
  chipRow: { gap: spacing.sm },
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
  },
  note: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.infoBg, borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  noteText: { flex: 1, color: colors.text, fontSize: font.sm, lineHeight: 18 },
});
