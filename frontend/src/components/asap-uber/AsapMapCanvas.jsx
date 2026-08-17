import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DriverLiveMap } from "@/components/ui-portal/DriverLiveMap";
import { MapboxMap } from "@/components/ui-portal/MapboxMap";
import RouteMapGoogle from "@/components/ui-portal/RouteMapGoogle";
import { fetchMapboxRoute, straightLine } from "@/lib/mapboxDirections";

/**
 * AsapMapCanvas — shared full-screen ASAP map surface.
 *
 * The visual foundation for the map-first ASAP experience. Full-bleed
 * live map behind the top status pill, floating controls, and bottom
 * sheet. Two modes today:
 *
 *   mode="driver" (default) — driver ASAP Live Mode
 *     Delegates to DriverLiveMap which itself dispatches between Mapbox
 *     GL (preferred) and the Google Maps fallback for iOS Safari /
 *     WebKit environments where Mapbox is known to hang (R27).
 *     Props consumed: `viewer`, `offers`, `onOfferClick`, `showSweep`.
 *
 *   mode="customer" — customer ASAP live tracking
 *     Renders pickup + dropoff markers, the real-road Mapbox Directions
 *     polyline (falls back to a great-circle straight line if the
 *     Directions API is unavailable), an optional driver marker with
 *     heading, and an optional breadcrumb trail. On any fatal Mapbox
 *     error we fall back to RouteMapGoogle without disturbing the
 *     surrounding UI (bottom sheet + top pill keep working).
 *     Props consumed: `pickup`, `dropoff`, `driver`, `trail`,
 *                      `showSweep` (softens the pickup pin while
 *                      searching for a driver), `sweepColor`.
 *
 * Native (iOS/Android) can later reimplement this component using the
 * native Mapbox SDK without changing anything above it — the driver
 * `Live.jsx` and customer `Dispatch.jsx` screens are agnostic.
 */

const MAP_GREEN = "#16A34A"; // pickup
const MAP_RED = "#D62828";   // dropoff
const MAP_BLUE = "#2563EB";  // driver
const ACCENT = "#EA580C";    // CargoOne accent (searching sweep)

function validPt(p) {
  return p
    && Number.isFinite(p.lat)
    && Number.isFinite(p.lng)
    && !(p.lat === 0 && p.lng === 0);
}

function CustomerMap({ pickup, dropoff, driver, trail, showSweep, sweepColor, recenterSignal, testId }) {
  const [useGoogle, setUseGoogle] = useState(!process.env.REACT_APP_MAPBOX_TOKEN);
  const [routeCoords, setRouteCoords] = useState(null);

  const hasPickup = validPt(pickup);
  const hasDropoff = validPt(dropoff);
  const hasDriver = validPt(driver);

  useEffect(() => {
    let cancelled = false;
    if (!hasPickup || !hasDropoff) { setRouteCoords(null); return () => {}; }
    (async () => {
      const r = await fetchMapboxRoute(pickup, dropoff);
      if (cancelled) return;
      if (r?.coordinates?.length) setRouteCoords(r.coordinates);
      else setRouteCoords(straightLine(pickup, dropoff));
    })();
    return () => { cancelled = true; };
  }, [pickup, dropoff, hasPickup, hasDropoff]);

  const markers = useMemo(() => {
    const out = [];
    if (hasPickup) {
      out.push({ id: "pickup", lng: pickup.lng, lat: pickup.lat,
                    color: MAP_GREEN, label: "P",
                    testId: `${testId}-marker-pickup` });
    }
    if (hasDropoff) {
      out.push({ id: "dropoff", lng: dropoff.lng, lat: dropoff.lat,
                    color: MAP_RED, label: "D",
                    testId: `${testId}-marker-dropoff` });
    }
    if (hasDriver) {
      out.push({ id: "driver", lng: driver.lng, lat: driver.lat,
                    color: MAP_BLUE, label: "•", size: 28,
                    testId: `${testId}-marker-driver` });
    }
    return out;
  }, [pickup, dropoff, driver, hasPickup, hasDropoff, hasDriver, testId]);

  const trailCoords = useMemo(() => {
    if (!Array.isArray(trail) || trail.length < 2) return null;
    return trail.filter(validPt).map((p) => [p.lng, p.lat]);
  }, [trail]);

  const sweep = useMemo(() => {
    if (!showSweep || !hasPickup) return null;
    return { lat: pickup.lat, lng: pickup.lng, color: sweepColor || ACCENT, radiusMeters: 800 };
  }, [showSweep, hasPickup, pickup, sweepColor]);

  const handleFatal = useCallback((e) => {
    // eslint-disable-next-line no-console
    console.warn("[AsapMapCanvas] Mapbox unavailable, falling back to Google:", e?.message || e);
    setUseGoogle(true);
  }, []);

  if (useGoogle) {
    // RouteMapGoogle owns its own height via inline style prop, so wrap
    // it in an absolute-positioned container that fills the parent.
    return (
      <div className="absolute inset-0" data-testid={`${testId}-google-fallback`}>
        <RouteMapGoogle
          pickup={hasPickup ? pickup : null}
          dropoff={hasDropoff ? dropoff : null}
          driver={hasDriver ? driver : null}
          trail={trail}
          height={typeof window !== "undefined" ? window.innerHeight : 800}
          testID={testId}
        />
      </div>
    );
  }

  return (
    <MapboxMap
      markers={markers}
      routeCoordinates={routeCoords}
      trailCoordinates={trailCoords}
      sweep={sweep}
      fitBounds
      recenterSignal={recenterSignal}
      className="!h-full !w-full !rounded-none border-none"
      data-testid={testId}
      onError={handleFatal}
    />
  );
}

/**
 * Props (superset for both modes; unused props for the active mode are
 * ignored so consumers can pass more than needed without harm):
 *   mode          — "driver" (default) | "customer"
 *
 *   Driver mode:
 *     viewer        — { lat, lng } for the central driver dot
 *     offers        — [{ job_id, pickup_lat, pickup_lng, service_type, ... }]
 *     onOfferClick  — (offer) => void
 *     showSweep     — draws the pulsing dispatch-radius sweep
 *
 *   Customer mode:
 *     pickup        — { lat, lng } — always required for a useful render
 *     dropoff       — { lat, lng }
 *     driver        — { lat, lng } — live driver position, optional
 *     trail         — [{ lat, lng }] — recent breadcrumbs, optional
 *     showSweep     — draws a soft pulse around the pickup while
 *                     searching for a driver
 *     sweepColor    — CSS colour (defaults to CargoOne accent)
 *
 * `data-testid` (optional) — root testid; a `-locating` variant is used
 * for the "acquiring coordinates" state.
 */
export function AsapMapCanvas({
  mode = "driver",
  viewer,
  offers = [],
  onOfferClick,
  pickup,
  dropoff,
  driver,
  trail,
  showSweep = true,
  sweepColor,
  recenterSignal = 0,
  className = "",
  "data-testid": testId = "asap-map-canvas",
}) {
  const isCustomer = mode === "customer";

  const hasCustomerPoints = validPt(pickup) || validPt(dropoff);
  const hasDriverViewer = viewer && Number.isFinite(viewer.lat) && Number.isFinite(viewer.lng);

  const showLocatingPlaceholder = isCustomer
    ? !hasCustomerPoints
    : !hasDriverViewer;

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      data-testid={testId}
    >
      {showLocatingPlaceholder ? (
        <div
          className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100"
          data-testid={`${testId}-locating`}
        >
          <div className="absolute inset-0 grid place-items-center">
            <p className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur-sm">
              {isCustomer ? "Preparing your route…" : "Locating you…"}
            </p>
          </div>
        </div>
      ) : isCustomer ? (
        <CustomerMap
          pickup={pickup}
          dropoff={dropoff}
          driver={driver}
          trail={trail}
          showSweep={showSweep}
          sweepColor={sweepColor}
          recenterSignal={recenterSignal}
          testId={testId}
        />
      ) : (
        <DriverLiveMap
          lat={viewer.lat}
          lng={viewer.lng}
          offers={offers}
          onOfferClick={onOfferClick}
          showSweep={showSweep}
          recenterSignal={recenterSignal}
          className="!h-full !w-full !rounded-none"
        />
      )}
    </div>
  );
}

export default AsapMapCanvas;
