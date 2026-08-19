import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Clock, Ship, Coins } from "lucide-react";
import { MapboxMap } from "./MapboxMap";
import { fetchMapboxRoute, straightLine } from "../../lib/mapboxDirections";

/**
 * RouteMapMapbox — same visual contract as the legacy RouteMap
 * (Google implementation), but rendered via Mapbox GL.
 *
 * Prop contract preserved BYTE-FOR-BYTE:
 *   pickup   { lat, lng, label? }
 *   dropoff  { lat, lng, label? }
 *   driver?  { lat, lng }        optional live driver marker (blue)
 *   trail?   [{ lat, lng }]      optional breadcrumb polyline
 *   height   number (px)         defaults 220
 *   testID   string
 *   summary? { pickupTown?, dropoffTown?, distanceMiles?, durationMinutes?,
 *              tollsGbp?, ferryGbp?, requiresManualReview? }
 *
 * COMMERCIAL LIFECYCLE:
 *   distance / duration in the summary strip come from the backend
 *   pricing_snapshot (Google Distance Matrix). This component never
 *   overrides them.
 */

const MARKER_GREEN = "#16A34A"; // pickup
const MARKER_RED   = "#D62828"; // dropoff
const MARKER_BLUE  = "#2563EB"; // driver

const validPt = (p) =>
  p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  !(p.lat === 0 && p.lng === 0);

function fmtDistanceMiles(m) {
  if (m == null || !Number.isFinite(Number(m))) return null;
  const n = Number(m);
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} mi`;
}
function fmtDuration(mins) {
  if (mins == null || !Number.isFinite(Number(mins))) return null;
  const m = Math.round(Number(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}

export function RouteMapMapbox({
  pickup,
  dropoff,
  driver = null,
  trail = null,
  height = 220,
  testID = "route-map",
  summary = null,
  onFatalError = null,   // R27 — dispatcher hooks this to fall back to Google
}) {
  const [routeCoords, setRouteCoords] = useState(null);
  const [mapError, setMapError] = useState(null);

  const validPickup  = validPt(pickup);
  const validDropoff = validPt(dropoff);
  const validDriver  = validPt(driver);

  // Fetch a real road polyline (Mapbox Directions) whenever pickup/dropoff
  // change. Cached inside `mapboxDirections.js` so re-renders don't rehit.
  // R68 — key on PRIMITIVES to eliminate any residual render-loop risk
  // when a parent passes freshly-created point objects on every tracking
  // poll.
  const pickupKey = validPickup ? `${pickup.lat},${pickup.lng}` : null;
  const dropoffKey = validDropoff ? `${dropoff.lat},${dropoff.lng}` : null;
  useEffect(() => {
    let cancelled = false;
    if (!pickupKey || !dropoffKey) { setRouteCoords(null); return () => {}; }
    (async () => {
      const r = await fetchMapboxRoute(pickup, dropoff);
      if (cancelled) return;
      if (r?.coordinates?.length) setRouteCoords(r.coordinates);
      else setRouteCoords(straightLine(pickup, dropoff));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupKey, dropoffKey]);

  const driverKey = validDriver ? `${driver.lat},${driver.lng}` : null;
  // Markers list — keyed on primitive coordinates to prevent identity
  // churn from parent tracking polls.
  const markers = useMemo(() => {
    const out = [];
    if (validPickup) {
      out.push({ id: "pickup", lng: pickup.lng, lat: pickup.lat,
                    color: MARKER_GREEN, label: "P",
                    testId: `${testID}-marker-pickup` });
    }
    if (validDropoff) {
      out.push({ id: "dropoff", lng: dropoff.lng, lat: dropoff.lat,
                    color: MARKER_RED, label: "D",
                    testId: `${testID}-marker-dropoff` });
    }
    if (validDriver) {
      out.push({ id: "driver", lng: driver.lng, lat: driver.lat,
                    color: MARKER_BLUE, label: "•", size: 28,
                    testId: `${testID}-marker-driver` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupKey, dropoffKey, driverKey, testID]);

  const trailCoords = useMemo(() => {
    if (!Array.isArray(trail) || trail.length < 2) return null;
    return trail
      .filter(validPt)
      .map((p) => [p.lng, p.lat]);
  }, [trail]);

  // Fatal Mapbox error → bubble to dispatcher so it can fall back to Google.
  useEffect(() => {
    if (mapError && onFatalError) onFatalError(mapError);
  }, [mapError, onFatalError]);

  // Nothing to plot? Show the same skeleton the Google version showed.
  if (!validPickup && !validDropoff) {
    return (
      <div
        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 grid place-items-center text-[13px] text-neutral-500"
        style={{ height }}
        data-testid={`${testID}-empty`}
      >
        Route will appear here once pickup and dropoff are set.
      </div>
    );
  }

  const distanceLabel = fmtDistanceMiles(summary?.distanceMiles);
  const durationLabel = fmtDuration(summary?.durationMinutes);

  return (
    <div className="w-full" data-testid={testID}>
      {summary && (
        <div
          className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-neutral-700"
          data-testid={`${testID}-summary`}
        >
          {summary.pickupTown && summary.dropoffTown && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4 text-neutral-500" />
              <b>{summary.pickupTown}</b>
              <span className="mx-1 text-neutral-400">→</span>
              <b>{summary.dropoffTown}</b>
            </span>
          )}
          {distanceLabel && (
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-4 w-4 text-neutral-500" />
              {distanceLabel}
            </span>
          )}
          {durationLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4 text-neutral-500" />
              {durationLabel}
            </span>
          )}
          {summary.ferryGbp != null && (
            <span className="inline-flex items-center gap-1 text-blue-700">
              <Ship className="h-4 w-4" />£{Number(summary.ferryGbp).toFixed(2)} ferry
            </span>
          )}
          {summary.tollsGbp != null && (
            <span className="inline-flex items-center gap-1 text-blue-700">
              <Coins className="h-4 w-4" />£{Number(summary.tollsGbp).toFixed(2)} tolls
            </span>
          )}
          {summary.requiresManualReview && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              Manual review — international route
            </span>
          )}
        </div>
      )}
      <MapboxMap
        markers={markers}
        routeCoordinates={routeCoords}
        trailCoordinates={trailCoords}
        fitBounds
        className={`w-full overflow-hidden rounded-2xl border border-neutral-200`}
        data-testid={`${testID}-canvas`}
        onError={(e) => setMapError(e)}
      />
      <style>{`
        [data-testid="${testID}"] > [data-testid="${testID}-canvas"] { height: ${height}px !important; }
      `}</style>
      {/* R27.4 — height is enforced two ways for defence-in-depth on iOS Safari:
          (a) the CSS selector below (in-tree fallback), and (b) the inline
          style on MapboxMap's minHeight prop (guaranteed non-zero at
          construction time so Mapbox never sees a 0-height container). */}
    </div>
  );
}

export default RouteMapMapbox;
