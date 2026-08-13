/**
 * Mapbox Directions client — VISUAL road polyline only.
 *
 * IMPORTANT — commercial-lifecycle boundary:
 *   The distance / duration numbers shown to users (customer summary strip,
 *   driver offer card, admin bookings) come from the backend `pricing_snapshot`
 *   which is calculated using **Google Distance Matrix on the server**. This
 *   helper returns coordinates ONLY. We NEVER surface a Mapbox distance to
 *   the customer or use it in a pricing calculation. See R26 sign-off.
 *
 * Public token restrictions apply — the token in REACT_APP_MAPBOX_TOKEN must
 * whitelist the current origin. If Mapbox 401/403s, callers get null and
 * should fall back to a straight great-circle polyline (already handled
 * inside RouteMapMapbox).
 */

const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";

let _lastKey = null;
let _lastResult = null;

export async function fetchMapboxRoute(pickup, dropoff, opts = {}) {
  const token = process.env.REACT_APP_MAPBOX_TOKEN;
  if (!token) return null;
  const pLng = Number(pickup?.lng); const pLat = Number(pickup?.lat);
  const dLng = Number(dropoff?.lng); const dLat = Number(dropoff?.lat);
  if (![pLng, pLat, dLng, dLat].every(Number.isFinite)) return null;
  // Cheap in-memory cache so cheap re-renders (e.g. RouteMap parent state
  // ticking every second on Live) don't hammer the Directions endpoint.
  const key = `${pLng},${pLat}|${dLng},${dLat}`;
  if (key === _lastKey && _lastResult) return _lastResult;

  const url =
    `${DIRECTIONS_URL}/${pLng},${pLat};${dLng},${dLat}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs || 6000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;
    const result = {
      coordinates: route.geometry.coordinates,       // [[lng,lat], …]
      distance_meters: route.distance,
      duration_seconds: route.duration,
      source: "mapbox",
    };
    _lastKey = key;
    _lastResult = result;
    return result;
  } catch {
    return null;
  }
}

/** Straight great-circle fallback — 2-point polyline pickup → dropoff. */
export function straightLine(pickup, dropoff) {
  const pLng = Number(pickup?.lng); const pLat = Number(pickup?.lat);
  const dLng = Number(dropoff?.lng); const dLat = Number(dropoff?.lat);
  if (![pLng, pLat, dLng, dLat].every(Number.isFinite)) return null;
  return [[pLng, pLat], [dLng, dLat]];
}
