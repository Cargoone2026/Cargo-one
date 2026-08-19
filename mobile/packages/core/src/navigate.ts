/**
 * @cargoone/core — Native navigation handoff.
 *
 * Web R68 opened `maps.apple.com` universal links via `window.location`.
 * Native R71 uses the far more reliable URL SCHEMES:
 *
 *   iOS      → `maps://?daddr={lat},{lng}&dirflg=d` (Apple Maps)
 *   Android  → `google.navigation:q={lat},{lng}` if Google Maps installed,
 *              falling back to `geo:{lat},{lng}?q=…` for the OS chooser
 *
 * Google Maps is NEVER auto-launched on iOS. iOS gets native Apple Maps.
 * This module is pure (no React Native imports) so it is easily unit-
 * tested; the actual `Linking.openURL(url)` call lives in the app that
 * imports this helper.
 */

export type NativePlatform = "ios" | "android" | "desktop";

export interface Destination {
  lat: number;
  lng: number;
  label?: string;
}

function isFinitePoint(d: Destination | null | undefined): d is Destination {
  return !!d && Number.isFinite(d.lat) && Number.isFinite(d.lng);
}

/**
 * Build the URL string that the calling app should hand to
 * `Linking.openURL()`. Returns null when the destination is missing.
 *
 * @param platform  react-native `Platform.OS` — `"ios"` | `"android"` |
 *                  anything else falls back to Google Maps directions in
 *                  a browser (dev / desktop preview builds).
 */
export function buildNativeNavigationUrl(
  dest: Destination | null | undefined,
  platform: NativePlatform,
): string | null {
  if (!isFinitePoint(dest)) return null;
  const { lat, lng } = dest;
  const q = dest.label ? encodeURIComponent(dest.label) : "";
  switch (platform) {
    case "ios":
      // maps:// is the DIRECT scheme for Apple Maps. iOS opens the
      // native app immediately without any Safari interstitial.
      // `dirflg=d` = driving directions.
      return `maps://?daddr=${lat},${lng}&dirflg=d${q ? `&q=${q}` : ""}`;
    case "android":
      // `google.navigation:` deep-links straight into turn-by-turn if
      // Google Maps is installed. `geo:` is the OS-chooser fallback.
      // We prefer `google.navigation` because it is a single tap into
      // navigation rather than a map preview.
      return `google.navigation:q=${lat},${lng}${q ? `&q=${q}` : ""}`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
}

/**
 * Fallback URL if the primary handoff fails to open (e.g. Google Maps
 * isn't installed on Android). Callers should try this URL when
 * `Linking.canOpenURL(primary) === false`.
 */
export function buildNavigationFallbackUrl(
  dest: Destination | null | undefined,
  platform: NativePlatform,
): string | null {
  if (!isFinitePoint(dest)) return null;
  if (platform === "android") {
    return `geo:${dest.lat},${dest.lng}?q=${dest.lat},${dest.lng}${
      dest.label ? `(${encodeURIComponent(dest.label)})` : ""
    }`;
  }
  if (platform === "ios") {
    // Universal link — will open Apple Maps if maps:// somehow failed.
    return `https://maps.apple.com/?daddr=${dest.lat},${dest.lng}&dirflg=d`;
  }
  return null;
}
