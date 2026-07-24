import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * RouteMap — Maps Phase 2.
 *
 * Real Google Maps tiles + DirectionsService driving route + fitBounds that
 * always keeps both pickup & dropoff visible. Falls back to the original
 * pure-SVG rendering if the browser Maps JS key is missing, if the JS
 * loader fails, or if either endpoint coordinate is invalid.
 *
 * PROPS CONTRACT PRESERVED (zero call-site changes):
 *   pickup   { lat, lng, label? }
 *   dropoff  { lat, lng, label? }
 *   driver?  { lat, lng }         optional live driver marker
 *   trail?   [{ lat, lng }]       optional breadcrumb polyline
 *   height   number (px)          defaults 220
 *   testID   string
 *
 * COMMERCIAL LIFECYCLE INTEGRITY:
 *   DirectionsService output here is DISPLAY-ONLY. It never overwrites
 *   job.distance_miles, booking.distance_miles, ETA, suggested_price or
 *   accepted_price. Those remain sourced from the backend Distance Matrix
 *   (Phase 1) — this component does not persist or emit any commercial
 *   value.
 */

const MAPS_JS_KEY = process.env.REACT_APP_GOOGLE_MAPS_JS_KEY || "";

// ---------------------------------------------------------------- loader ---
// Single global loader across the SPA — repeated mounts don't inject
// multiple <script> tags and don't double-load the Maps library.
let _mapsPromise = null;
function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (_mapsPromise) return _mapsPromise;
  if (!MAPS_JS_KEY) return Promise.reject(new Error("no key"));
  _mapsPromise = new Promise((resolve, reject) => {
    const cbName = `__cargoOneMapsCb_${Date.now()}`;
    window[cbName] = () => {
      delete window[cbName];
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("google.maps not present after load"));
    };
    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_JS_KEY)}` +
      `&v=weekly&libraries=marker&loading=async&callback=${cbName}`;
    s.onerror = () => {
      _mapsPromise = null;
      reject(new Error("maps js script error"));
    };
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

// -------------------------------------------------------------- helpers ---
const validPt = (p) =>
  p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  !(p.lat === 0 && p.lng === 0);

const FIT_PADDING = { top: 44, right: 32, bottom: 44, left: 32 };

// ============================================================ component ===
export function RouteMap({
  pickup,
  dropoff,
  driver = null,
  trail = null,
  height = 220,
  testID = "route-map",
}) {
  const canUseGoogle = validPt(pickup) && validPt(dropoff) && MAPS_JS_KEY;

  return canUseGoogle ? (
    <GoogleRouteMap
      pickup={pickup}
      dropoff={dropoff}
      driver={driver}
      trail={trail}
      height={height}
      testID={testID}
    />
  ) : (
    <SvgRouteMap
      pickup={pickup}
      dropoff={dropoff}
      driver={driver}
      trail={trail}
      height={height}
      testID={testID}
    />
  );
}

// ================================================= real Google Maps view ===
function GoogleRouteMap({ pickup, dropoff, driver, trail, height, testID }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const rendererRef = useRef(null);
  const markersRef = useRef([]);
  const trailPolyRef = useRef(null);
  const boundsRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  // Fit bounds — used on init AND on every resize/orientation change so the
  // full route stays visible even if the container width changed.
  const fit = () => {
    if (!mapRef.current || !boundsRef.current) return;
    try {
      mapRef.current.fitBounds(boundsRef.current, FIT_PADDING);
    } catch {
      /* no-op */
    }
  };

  // ---- init / re-init on prop changes ------------------------------------
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;

        // Clean previous instance state so repeated renders don't stack
        // markers or routes on top of old ones.
        markersRef.current.forEach((m) => m.setMap?.(null));
        markersRef.current = [];
        rendererRef.current?.setMap(null);
        rendererRef.current = null;
        trailPolyRef.current?.setMap(null);
        trailPolyRef.current = null;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "cooperative",
            clickableIcons: false,
            backgroundColor: "#F4F4F4",
          });
        }

        const bounds = new maps.LatLngBounds();
        bounds.extend({ lat: pickup.lat, lng: pickup.lng });
        bounds.extend({ lat: dropoff.lat, lng: dropoff.lng });

        // Pickup + dropoff markers (branded)
        const pMarker = new maps.Marker({
          position: { lat: pickup.lat, lng: pickup.lng },
          map: mapRef.current,
          label: { text: "P", color: "#FFFFFF", fontWeight: "700" },
          title: pickup.label || "Pickup",
        });
        const dMarker = new maps.Marker({
          position: { lat: dropoff.lat, lng: dropoff.lng },
          map: mapRef.current,
          label: { text: "D", color: "#FFFFFF", fontWeight: "700" },
          title: dropoff.label || "Dropoff",
        });
        markersRef.current.push(pMarker, dMarker);

        // Driver marker (optional)
        if (validPt(driver)) {
          const drv = new maps.Marker({
            position: { lat: driver.lat, lng: driver.lng },
            map: mapRef.current,
            title: "Driver",
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#111111",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2,
            },
          });
          markersRef.current.push(drv);
          bounds.extend(drv.getPosition());
        }

        // Trail (optional)
        if (Array.isArray(trail) && trail.filter(validPt).length >= 2) {
          const path = trail.filter(validPt).map((t) => ({ lat: t.lat, lng: t.lng }));
          trailPolyRef.current = new maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#D62828",
            strokeOpacity: 0.9,
            strokeWeight: 3,
            map: mapRef.current,
          });
          path.forEach((p) => bounds.extend(p));
        }

        // Directions — draw the real road route. On failure, fall back to
        // a straight polyline; never bring down the map.
        const ds = new maps.DirectionsService();
        rendererRef.current = new maps.DirectionsRenderer({
          suppressMarkers: true,
          preserveViewport: true, // we fitBounds ourselves
          polylineOptions: { strokeColor: "#111111", strokeWeight: 4, strokeOpacity: 0.85 },
        });
        rendererRef.current.setMap(mapRef.current);
        ds.route(
          {
            origin: { lat: pickup.lat, lng: pickup.lng },
            destination: { lat: dropoff.lat, lng: dropoff.lng },
            travelMode: maps.TravelMode.DRIVING,
            provideRouteAlternatives: false,
          },
          (result, dstatus) => {
            if (cancelled) return;
            if (dstatus === "OK" && result?.routes?.[0]) {
              rendererRef.current.setDirections(result);
              const rb = result.routes[0].bounds;
              if (rb) bounds.union(rb);
            } else {
              // Straight-line fallback — still on real map tiles.
              new maps.Polyline({
                path: [
                  { lat: pickup.lat, lng: pickup.lng },
                  { lat: dropoff.lat, lng: dropoff.lng },
                ],
                geodesic: true,
                strokeColor: "#111111",
                strokeOpacity: 0.6,
                strokeWeight: 3,
                map: mapRef.current,
              });
            }
            boundsRef.current = bounds;
            fit();
            // Refit shortly after tiles settle — first paint sometimes
            // computes bounds before the container reaches its final size.
            setTimeout(fit, 150);
            setStatus("ready");
          },
        );
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Include every commercial input so accepted-price/lifecycle changes on
    // the parent trigger a clean re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driver?.lat, driver?.lng, JSON.stringify(trail || [])]);

  // ---- resize / orientation change → refit -------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    const onOrient = () => setTimeout(fit, 200);
    window.addEventListener("orientationchange", onOrient);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", onOrient);
    };
  }, []);

  if (status === "error") {
    // Loader/API failed → hand off to SVG so we never render a blank map.
    return (
      <SvgRouteMap
        pickup={pickup}
        dropoff={dropoff}
        driver={driver}
        trail={trail}
        height={height}
        testID={testID}
      />
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-[#F4F4F4]"
      style={{ height }}
      data-testid={testID}
      data-map-engine="google"
    >
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[#F4F4F4]/80 text-[13px] text-[#6B7280]"
          data-testid={`${testID}-loading`}
        >
          Loading map…
        </div>
      )}
    </div>
  );
}

// ================================================= SVG fallback (legacy) ==
function SvgRouteMap({ pickup, dropoff, driver, trail, height, testID }) {
  const points = useMemo(() => {
    const raw = [];
    if (pickup) raw.push({ ...pickup, k: "pickup" });
    if (dropoff) raw.push({ ...dropoff, k: "dropoff" });
    if (driver) raw.push({ ...driver, k: "driver" });
    if (Array.isArray(trail)) trail.forEach((t, i) => raw.push({ ...t, k: `trail-${i}` }));
    if (raw.length === 0) return [];
    const lats = raw.map((p) => p.lat);
    const lngs = raw.map((p) => p.lng);
    let minLat = Math.min(...lats),
      maxLat = Math.max(...lats),
      minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs);
    if (maxLat === minLat) {
      minLat -= 0.01;
      maxLat += 0.01;
    }
    if (maxLng === minLng) {
      minLng -= 0.01;
      maxLng += 0.01;
    }
    const pad = 0.08;
    const spanLat = (maxLat - minLat) * (1 + pad);
    const spanLng = (maxLng - minLng) * (1 + pad);
    return raw.map((p) => ({
      ...p,
      x: ((p.lng - minLng + spanLng * pad * 0.5) / spanLng) * 100,
      y: 100 - ((p.lat - minLat + spanLat * pad * 0.5) / spanLat) * 100,
    }));
  }, [pickup, dropoff, driver, trail]);

  const p = points.find((pt) => pt.k === "pickup");
  const d = points.find((pt) => pt.k === "dropoff");
  const drv = points.find((pt) => pt.k === "driver");
  const trailPts = points.filter((pt) => pt.k.startsWith("trail-"));

  return (
    <div
      className="relative w-full overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-gradient-to-br from-[#F4F4F4] to-[#E5E7EB]"
      style={{ height }}
      data-testid={testID}
      data-map-engine="svg"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id={`${testID}-grid`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#D1D5DB" strokeWidth="0.2" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#${testID}-grid)`} />
        {p && d && (
          <line x1={p.x} y1={p.y} x2={d.x} y2={d.y} stroke="#111111" strokeWidth="0.7" strokeDasharray="2 1.5" />
        )}
        {trailPts.length >= 2 && (
          <polyline
            fill="none"
            stroke="#D62828"
            strokeWidth="0.7"
            points={trailPts.map((t) => `${t.x},${t.y}`).join(" ")}
          />
        )}
        {p && (
          <>
            <circle cx={p.x} cy={p.y} r="2.4" fill="#111111" />
            <text x={p.x} y={p.y + 0.9} textAnchor="middle" fontSize="2" fill="#FFFFFF" fontWeight="700">
              P
            </text>
          </>
        )}
        {d && (
          <>
            <circle cx={d.x} cy={d.y} r="2.4" fill="#D62828" />
            <text x={d.x} y={d.y + 0.9} textAnchor="middle" fontSize="2" fill="#FFFFFF" fontWeight="700">
              D
            </text>
          </>
        )}
        {drv && (
          <>
            <circle cx={drv.x} cy={drv.y} r="2.2" fill="#111111" stroke="#FFFFFF" strokeWidth="0.5" />
            <text x={drv.x} y={drv.y + 0.8} textAnchor="middle" fontSize="1.8">🚚</text>
          </>
        )}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-2 text-[10px]">
        {pickup?.label && (
          <span className="rounded-full bg-black/70 px-2 py-0.5 text-white">{pickup.label}</span>
        )}
        {dropoff?.label && (
          <span className="rounded-full bg-[#D62828] px-2 py-0.5 text-white">{dropoff.label}</span>
        )}
      </div>
    </div>
  );
}

export default RouteMap;
