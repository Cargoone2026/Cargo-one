// R68 — Cargo navigation abstraction.
//
// Provides a single hook + button that opens the platform's best-available
// navigation handoff for a destination. On WEB we open the Apple / Google
// Maps deep-link in a new tab (works on iOS Safari, Android Chrome, and
// desktop). On future native builds this helper is intended to be swapped
// out for the platform navigation SDK (Mapbox Navigation on iOS/Android)
// without touching the calling screens.
//
// Public API:
//   useCargoNavigation() → { navigate({ lat, lng, label? }), available }
//   <CargoNavigateButton destination={{lat,lng,label?}} ... />

import React, { useCallback } from "react";
import { Navigation2 } from "lucide-react";

function isFinitePoint(p) {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

function detectPlatform() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Build a navigation intent URL. Kept pure so unit tests can assert it
 * without a live browser.
 */
export function buildNavigationUrl({ lat, lng, label }, platform) {
  if (!isFinitePoint({ lat, lng })) return null;
  const q = encodeURIComponent(label ? `${label}` : "");
  switch (platform) {
    case "ios":
      // Apple Maps universal link — iOS opens the native app when installed,
      // otherwise the web preview. `dirflg=d` requests driving directions
      // explicitly which improves native-app auto-launch reliability on
      // recent iOS builds.
      return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d${label ? `&q=${q}` : ""}`;
    case "android":
      // geo: scheme is honoured by every Android navigation app and prompts
      // the user to pick between installed providers.
      return `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${q})` : ""}`;
    default:
      // Desktop / unknown — Google Maps directions.
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
        label ? `&destination_place_id=${q}` : ""
      }`;
  }
}

export function useCargoNavigation() {
  const navigate = useCallback((destination) => {
    if (!isFinitePoint(destination)) return { ok: false, reason: "no-destination" };
    const platform = detectPlatform();
    const url = buildNavigationUrl(destination, platform);
    if (!url) return { ok: false, reason: "invalid-destination" };
    try {
      // R69 — iOS + Android must hand off to the native mapping app rather
      // than open another web tab. Using `window.location.href` on those
      // platforms lets the OS intercept `https://maps.apple.com/…` /
      // `geo:` URLs and jump straight into Apple Maps / the Android
      // maps chooser — no interstitial Safari tab. Desktop keeps the
      // "new tab" behaviour so the CargoOne page isn't unloaded.
      if (platform === "ios" || platform === "android") {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return { ok: true, url, platform };
    } catch (e) {
      return { ok: false, reason: e?.message || "open-failed" };
    }
  }, []);

  return { navigate, available: typeof window !== "undefined" };
}

/**
 * <CargoNavigateButton destination={{lat, lng, label}} ... />
 *
 * A big, prominent Navigate CTA modelled on the reference car-navigation
 * card. Disabled + visually muted when no destination coordinates are
 * available so drivers don't tap an empty button.
 */
export function CargoNavigateButton({
  destination,
  disabled = false,
  variant = "primary",
  className = "",
  size = "lg",
  label = "Navigate",
  onNavigated,
  "data-testid": testId = "cargo-navigate-button",
}) {
  const { navigate } = useCargoNavigation();
  const has = isFinitePoint(destination);
  const isDisabled = disabled || !has;

  const onClick = () => {
    if (isDisabled) return;
    const result = navigate(destination);
    if (typeof onNavigated === "function") onNavigated(result);
  };

  const sizeCls = size === "sm" ? "h-10 px-4 text-[14px]" : "h-12 px-6 text-[15px]";
  const variantCls =
    variant === "primary"
      ? "bg-[#D62828] text-white hover:bg-[#B01F1F] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
      : "border-2 border-[#111111] bg-white text-[#111111] hover:bg-[#F4F4F4] disabled:border-[#E5E7EB] disabled:text-[#9CA3AF]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={has ? `${label} — open turn-by-turn directions in your maps app` : `${label} — destination not available`}
      data-testid={testId}
      className={`flex w-full items-center justify-center gap-2 rounded-full font-bold transition-colors ${sizeCls} ${variantCls} ${className}`}
    >
      <Navigation2 className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export default CargoNavigateButton;
