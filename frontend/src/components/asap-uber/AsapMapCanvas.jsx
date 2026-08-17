import React from "react";
import { DriverLiveMap } from "@/components/ui-portal/DriverLiveMap";

/**
 * AsapMapCanvas — shared full-screen ASAP map surface.
 *
 * The visual foundation for the new Uber-style ASAP experience. Renders
 * a full-bleed live map beneath the top status pill, floating controls,
 * and bottom sheet. Delegates to `DriverLiveMap`, which itself dispatches
 * between Mapbox GL (preferred, when REACT_APP_MAPBOX_TOKEN is set) and
 * the Google Maps fallback for iOS Safari / WebKit environments where
 * Mapbox is known to hang (R27).
 *
 * Props (driver-side today; extends naturally for customer-side later):
 *   viewer        — { lat, lng } of the *viewer* to draw as the central
 *                   dark dot with optional radar sweep. Driver's current
 *                   GPS in Live Mode; customer's pickup or driver's live
 *                   position on the customer tracking screen.
 *   offers        — [{ job_id, pickup_lat, pickup_lng, service_type,
 *                     pricing_type, ... }] — job pins shown on the map.
 *                   Empty array is fine; map still renders with sweep.
 *   onOfferClick  — (offer) => void. Fired when a job pin is tapped so
 *                   the bottom sheet can scroll to / highlight the card.
 *   showSweep     — Draws the pulsing orange dispatch radius around the
 *                   viewer. Off during pickup/dropoff navigation later.
 *   className     — Pass-through to the root positioning container.
 *
 * The component is `absolute inset-0` so it fills the nearest positioned
 * ancestor. The parent screen should be `relative` with an explicit
 * height (e.g. `h-[calc(100dvh-72px)]` to account for the mobile bottom
 * tab bar).
 */
export function AsapMapCanvas({
  viewer,
  offers = [],
  onOfferClick,
  showSweep = true,
  className = "",
  "data-testid": testId = "asap-map-canvas",
}) {
  const hasViewer =
    viewer && Number.isFinite(viewer.lat) && Number.isFinite(viewer.lng);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      data-testid={testId}
    >
      {hasViewer ? (
        <DriverLiveMap
          lat={viewer.lat}
          lng={viewer.lng}
          offers={offers}
          onOfferClick={onOfferClick}
          showSweep={showSweep}
          className="!h-full !w-full !rounded-none"
        />
      ) : (
        // Neutral placeholder while GPS is being acquired. Same visual
        // language as the classic Live loader so no jarring transition.
        <div
          className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100"
          data-testid={`${testId}-locating`}
        >
          <div className="absolute inset-0 grid place-items-center">
            <p className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur-sm">
              Locating you…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AsapMapCanvas;
