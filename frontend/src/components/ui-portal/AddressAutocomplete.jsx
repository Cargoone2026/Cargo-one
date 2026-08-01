import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, ChevronRight, X, Search } from "lucide-react";
import { api } from "@/lib/api";
import { SUPPORTED_MARKETS, marketName } from "@/theme";
import { Button } from "./Button";
import { Input } from "./Input";

/**
 * AddressAutocomplete — web port of the Expo AddressAutocomplete.
 *
 * Data contract (PlaceResult) matches the Expo/backend expectation:
 *   { formatted_address, address_line, postcode, town, region,
 *     country, country_code, place_id, lat, lng }
 *
 * Security posture (Stage 2A-i):
 *  - Calls the SERVER-SIDE proxy `/api/geo/autocomplete` — Google key,
 *    when present, lives in the backend env only. If no key is set, the
 *    backend returns `{source:"manual"}` and this component falls back
 *    to a manual entry form (postcode + town + country).
 *  - We NEVER read GOOGLE_MAPS_API_KEY from `process.env` in the browser.
 *  - Structure is preserved for a later Google Places / autocomplete
 *    upgrade after cargoone.co.uk is attached with a restricted key.
 *
 * onSelect receives a PlaceResult when the user picks a suggestion or
 * commits the manual form.
 */
export function AddressAutocomplete({
  label,
  value,
  placeholder,
  onSelect,
  testID,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3" data-testid={testID}>
      <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-3 text-left hover:border-[#111111]"
        data-testid={testID ? `${testID}-open` : "address-open"}
      >
        <MapPin className="h-5 w-5 text-[#6B7280]" />
        <span className="flex-1 min-w-0">
          <span
            className={`block truncate text-[15px] ${
              value ? "text-[#111111]" : "text-[#9CA3AF]"
            }`}
          >
            {value?.formatted_address ||
              placeholder ||
              "Search address, postcode or place"}
          </span>
          {value?.country_code ? (
            <span className="mt-0.5 block text-[12px] text-[#6B7280]">
              {marketName(value.country_code)}
            </span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
      </button>

      {open ? (
        <AddressPickerModal
          initial={value}
          onClose={() => setOpen(false)}
          onCommit={(place) => {
            onSelect(place);
            setOpen(false);
          }}
          testID={testID}
        />
      ) : null}
    </div>
  );
}

function AddressPickerModal({ initial, onClose, onCommit, testID }) {
  const [query, setQuery] = useState(initial?.formatted_address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(initial ? "review" : "search");
  const [form, setForm] = useState({
    formatted_address: initial?.formatted_address || "",
    address_line: initial?.address_line || "",
    postcode: initial?.postcode || "",
    town: initial?.town || "",
    region: initial?.region || "",
    country_code: initial?.country_code || "GB",
    lat: initial?.lat ?? 0,
    lng: initial?.lng ?? 0,
  });
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api(
          `/geo/autocomplete?q=${encodeURIComponent(query.trim())}`,
        );
        setSuggestions(res?.suggestions || []);
        setSource(res?.source || "manual");
      } catch {
        setSuggestions([]);
        setSource("manual");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  const pickSuggestion = useCallback(async (s) => {
    // Phase 1 (Maps): resolve the selected place_id into real
    // coordinates + address components via the server-side
    // `/api/geo/details` proxy. The Google key stays backend-only.
    // If details lookup fails (network hiccup, quota, key issue),
    // we degrade to the previous behaviour — pre-fill formatted_address
    // + town from the autocomplete result and let the user complete
    // postcode/etc. by hand in the review step. This preserves the
    // manual-entry safety net rather than blocking the flow.
    setForm((f) => ({
      ...f,
      formatted_address: s.formatted_address || query,
      town: s.town || f.town,
    }));
    setMode("review");
    if (!s?.place_id) return;
    try {
      const d = await api(
        `/geo/details?place_id=${encodeURIComponent(s.place_id)}`,
      );
      if (d && d.source === "google") {
        setForm((f) => ({
          ...f,
          formatted_address: d.formatted_address || f.formatted_address,
          address_line: d.address_line || f.address_line,
          postcode: d.postcode || f.postcode,
          town: d.town || f.town,
          region: d.region || f.region,
          country_code: d.country_code || f.country_code,
          lat: d.lat || f.lat,
          lng: d.lng || f.lng,
        }));
      }
    } catch {
      // silent — manual review form remains fully usable
    }
  }, [query]);

  // The review form used to require a postcode + town outright. That broke
  // two production flows:
  //   (a) "Use my current location" — reverse geocoding for GPS coords
  //       often returns no postcode component, especially outside urban UK.
  //   (b) Rural / new-build addresses where Google Places doesn't emit a
  //       postcode in the details response.
  // Both are still perfectly valid pickup/dropoff locations because we
  // have a real lat/lng and formatted_address. We now accept EITHER a
  // (postcode + town) manual review OR a valid coordinate pair — that
  // matches what the backend actually needs (`pickup_lat`/`pickup_lng`).
  const hasCoords =
    Number.isFinite(form.lat) &&
    Number.isFinite(form.lng) &&
    !(form.lat === 0 && form.lng === 0);
  // Manual review commits synthesise formatted_address from
  // `address_line + town + postcode`, so the raw form field being blank
  // is fine as long as those three inputs are populated.
  const hasComposable =
    form.address_line.trim().length > 0 &&
    form.town.trim().length > 0 &&
    form.postcode.trim().length > 0;
  const canCommit =
    (form.formatted_address.trim().length > 0 || hasComposable) &&
    (hasCoords ||
      (form.postcode.trim().length > 0 && form.town.trim().length > 0)) &&
    form.country_code;

  const commit = () => {
    if (!canCommit) return;
    const country =
      SUPPORTED_MARKETS.find((m) => m.iso2 === form.country_code)?.name ||
      form.country_code;
    onCommit({
      ...form,
      country,
      formatted_address:
        form.formatted_address ||
        `${form.address_line}, ${form.town}, ${form.postcode}`.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      data-testid={testID ? `${testID}-modal` : "address-modal"}
    >
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden bg-white sm:max-w-[560px] sm:rounded-[20px]">
        <header className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex-1">
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#D62828]">
              PICK ADDRESS
            </p>
            <h2 className="text-[18px] font-bold text-[#111111]">
              {mode === "search" ? "Search address" : "Confirm details"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="address-close"
            className="rounded-full p-2 hover:bg-[#F4F4F4]"
          >
            <X className="h-5 w-5 text-[#111111]" />
          </button>
        </header>

        {mode === "search" ? (
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-[#E5E7EB] px-4 py-3">
              <Input
                icon={<Search className="h-4 w-4 text-[#6B7280]" />}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search address, postcode or place"
                testID="address-search-input"
              />
              {source === "manual" ? (
                <p className="mt-2 text-[12px] text-[#6B7280]">
                  Autocomplete is not yet configured for this environment —
                  you can enter the address manually below.
                </p>
              ) : null}
            </div>
            <ul className="divide-y divide-[#F3F4F6]">
              {loading ? (
                <li className="px-4 py-4 text-[13px] text-[#6B7280]">
                  Searching…
                </li>
              ) : null}
              {!loading && suggestions.length === 0 && query.trim().length >= 2 ? (
                <li className="px-4 py-4 text-[13px] text-[#6B7280]">
                  No suggestions. Try a fuller address or enter details manually.
                </li>
              ) : null}
              {suggestions.map((s) => (
                <li key={s.place_id || s.formatted_address}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    data-testid={`address-suggestion-${s.place_id || s.formatted_address}`}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#F4F4F4]"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" />
                    <span className="flex-1">
                      <span className="block text-[14px] font-medium text-[#111111]">
                        {s.formatted_address}
                      </span>
                      {s.town ? (
                        <span className="block text-[12px] text-[#6B7280]">
                          {s.town}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3">
              <Button
                title="Enter address manually"
                variant="ghost"
                onClick={() => setMode("review")}
                testID="address-manual-btn"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <Input
              label="Address line"
              value={form.address_line}
              onChange={(e) =>
                setForm((f) => ({ ...f, address_line: e.target.value }))
              }
              placeholder="Street, unit, building"
              testID="address-line"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Postcode"
                value={form.postcode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postcode: e.target.value }))
                }
                placeholder={
                  SUPPORTED_MARKETS.find((m) => m.iso2 === form.country_code)
                    ?.postalCodeLabel || "Postcode"
                }
                testID="address-postcode"
              />
              <Input
                label="Town / City"
                value={form.town}
                onChange={(e) =>
                  setForm((f) => ({ ...f, town: e.target.value }))
                }
                placeholder="e.g. London"
                testID="address-town"
              />
            </div>
            <Input
              label="Region / County (optional)"
              value={form.region}
              onChange={(e) =>
                setForm((f) => ({ ...f, region: e.target.value }))
              }
              placeholder="e.g. Greater London"
              testID="address-region"
            />
            <label className="mb-3 block">
              <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                Country
              </span>
              <select
                value={form.country_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country_code: e.target.value }))
                }
                data-testid="address-country"
                className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-[15px] text-[#111111] outline-none focus:border-[#111111]"
              >
                {SUPPORTED_MARKETS.map((m) => (
                  <option key={m.iso2} value={m.iso2}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Full address (as it will appear on paperwork)"
              value={form.formatted_address}
              onChange={(e) =>
                setForm((f) => ({ ...f, formatted_address: e.target.value }))
              }
              placeholder="Auto-composed when blank"
              testID="address-formatted"
            />
            <div className="mt-3 flex gap-2">
              <Button
                title="Back to search"
                variant="ghost"
                fullWidth={false}
                onClick={() => setMode("search")}
                testID="address-back"
              />
              <Button
                title="Save address"
                variant="primary"
                disabled={!canCommit}
                onClick={commit}
                testID="address-save"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
