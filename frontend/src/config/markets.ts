/**
 * Cargo One market / geography configuration.
 *
 * Single source of truth for which countries the platform supports at
 * launch and which of them are "domestic" for pricing purposes. Adding a
 * country requires only appending it to SUPPORTED_MARKETS (and, if it
 * shares a UK domestic pricing table, LAUNCH_DOMESTIC_ISO_CODES).
 *
 * This file replaces the previous UK-only assumptions (London/Manchester/
 * Birmingham preset chips + componentRestrictions.country="gb").
 */

export type Market = {
  iso2: string;          // ISO-3166-1 alpha-2 (e.g. "GB")
  iso3: string;          // ISO-3166-1 alpha-3 (e.g. "GBR")
  name: string;          // Display name
  currency: string;      // ISO 4217
  callingCode: string;   // e.g. "+44"
  postalCodeLabel: string; // "Postcode" | "Eircode" | "ZIP" ...
  /**
   * Whether this market currently has full pricing rules configured.
   * When false, we accept the address but return a "manual-review /
   * international quote" state instead of a silent UK price.
   */
  pricingConfigured: boolean;
};

export const SUPPORTED_MARKETS: Market[] = [
  { iso2: "GB", iso3: "GBR", name: "United Kingdom",     currency: "GBP", callingCode: "+44",  postalCodeLabel: "Postcode", pricingConfigured: true  },
  // Northern Ireland is part of the UK — GB covers it in Google Places. We surface
  // it separately in the UI so drivers/customers understand NI is supported.
  { iso2: "IE", iso3: "IRL", name: "Republic of Ireland", currency: "EUR", callingCode: "+353", postalCodeLabel: "Eircode",  pricingConfigured: false },
  // Europe-ready. Add pricingConfigured=true once we have route rules per country.
  { iso2: "FR", iso3: "FRA", name: "France",             currency: "EUR", callingCode: "+33",  postalCodeLabel: "Code postal", pricingConfigured: false },
  { iso2: "DE", iso3: "DEU", name: "Germany",            currency: "EUR", callingCode: "+49",  postalCodeLabel: "PLZ",       pricingConfigured: false },
  { iso2: "NL", iso3: "NLD", name: "Netherlands",        currency: "EUR", callingCode: "+31",  postalCodeLabel: "Postcode",  pricingConfigured: false },
  { iso2: "BE", iso3: "BEL", name: "Belgium",            currency: "EUR", callingCode: "+32",  postalCodeLabel: "Postcode",  pricingConfigured: false },
  { iso2: "ES", iso3: "ESP", name: "Spain",              currency: "EUR", callingCode: "+34",  postalCodeLabel: "Código postal", pricingConfigured: false },
  { iso2: "IT", iso3: "ITA", name: "Italy",              currency: "EUR", callingCode: "+39",  postalCodeLabel: "CAP",       pricingConfigured: false },
  { iso2: "PT", iso3: "PRT", name: "Portugal",           currency: "EUR", callingCode: "+351", postalCodeLabel: "Código postal", pricingConfigured: false },
  { iso2: "AT", iso3: "AUT", name: "Austria",            currency: "EUR", callingCode: "+43",  postalCodeLabel: "PLZ",       pricingConfigured: false },
  { iso2: "PL", iso3: "POL", name: "Poland",             currency: "EUR", callingCode: "+48",  postalCodeLabel: "Kod pocztowy", pricingConfigured: false },
  { iso2: "SE", iso3: "SWE", name: "Sweden",             currency: "SEK", callingCode: "+46",  postalCodeLabel: "Postnummer", pricingConfigured: false },
  { iso2: "DK", iso3: "DNK", name: "Denmark",            currency: "DKK", callingCode: "+45",  postalCodeLabel: "Postnummer", pricingConfigured: false },
  { iso2: "NO", iso3: "NOR", name: "Norway",             currency: "NOK", callingCode: "+47",  postalCodeLabel: "Postnummer", pricingConfigured: false },
  { iso2: "CH", iso3: "CHE", name: "Switzerland",        currency: "CHF", callingCode: "+41",  postalCodeLabel: "PLZ",       pricingConfigured: false },
  { iso2: "LU", iso3: "LUX", name: "Luxembourg",         currency: "EUR", callingCode: "+352", postalCodeLabel: "Code postal", pricingConfigured: false },
];

/** ISO2 codes passed to Google Places for autocomplete country restriction. */
export const SUPPORTED_ISO2 = SUPPORTED_MARKETS.map((m) => m.iso2);

/**
 * Countries whose routes we currently treat as "UK-domestic pricing":
 * only GB itself. GB↔IE is intentionally NOT in this list — those routes
 * are correctly classified as international and returned as "manual
 * review" until an IE pricing rule is configured.
 */
export const LAUNCH_DOMESTIC_ISO_CODES: string[] = ["GB"];

/**
 * Regional bias sent to Google Places / Geocoding — biases results
 * towards this box without hard-restricting them. Covers UK + Ireland +
 * western Europe.
 */
export const REGIONAL_BIAS_BOUNDS = {
  sw: { lat: 35.0, lng: -12.0 },  // approx SW of Portugal
  ne: { lat: 60.0, lng: 25.0 },   // approx NE of Scandinavia
};

export const DEFAULT_MAP_CENTER = { lat: 54.0, lng: -3.0 }; // roughly UK + Ireland

/** Look up display name for an ISO2. Falls back to the code itself. */
export function marketName(iso2?: string | null): string {
  if (!iso2) return "";
  const m = SUPPORTED_MARKETS.find((x) => x.iso2.toUpperCase() === iso2.toUpperCase());
  return m?.name || iso2.toUpperCase();
}

export function isSupportedCountry(iso2?: string | null): boolean {
  if (!iso2) return false;
  return SUPPORTED_MARKETS.some((m) => m.iso2 === iso2.toUpperCase());
}

/**
 * Given origin + destination ISO2 codes, classify the route:
 *   - domestic_uk: both GB, pricing available
 *   - domestic_other: same non-GB country (or matching supported market)
 *   - international: origin != destination
 *   - unsupported: at least one country outside supported list
 */
export type RouteClass = "domestic_uk" | "domestic_other" | "international" | "unsupported";

export function classifyRoute(origin?: string | null, dest?: string | null): RouteClass {
  const o = (origin || "").toUpperCase();
  const d = (dest || "").toUpperCase();
  if (!isSupportedCountry(o) || !isSupportedCountry(d)) return "unsupported";
  if (o === "GB" && d === "GB") return "domestic_uk";
  if (o === d) return "domestic_other";
  return "international";
}
