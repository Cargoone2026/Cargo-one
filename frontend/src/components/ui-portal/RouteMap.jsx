import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Navigation, Clock } from "lucide-react";

/**
 * RouteMap — Google Maps route preview with branded markers, blue polyline,
 * skeleton loading, and an optional backend-sourced summary strip.
 *
 * PROPS CONTRACT (backward-compatible; existing call-sites keep working):
 *   pickup   { lat, lng, label? }
 *   dropoff  { lat, lng, label? }
 *   driver?  { lat, lng }                 optional live driver marker (blue)
 *   trail?   [{ lat, lng }]               optional breadcrumb polyline
 *   height   number (px)                  defaults 220
 *   testID   string
 *   summary? {                             optional strip rendered above the map
 *     pickupTown?: string,                 e.g. "Manchester"
 *     dropoffTown?: string,                e.g. "Birmingham"
 *     distanceMiles?: number,              backend value — never computed here
 *     durationMinutes?: number,            backend value — never computed here
 *   }
 *
 * COMMERCIAL LIFECYCLE INTEGRITY (unchanged):
 *   DirectionsService output is DISPLAY-ONLY. Distance / ETA / price shown to
 *   the user still come from the backend (job / booking / quote objects). This
 *   component never overwrites job.distance_miles, booking.distance_miles, ETA,
 *   suggested_price or accepted_price.
 */

const MAPS_JS_KEY = process.env.REACT_APP_GOOGLE_MAPS_JS_KEY || "";

// ---------------------------------------------------------------- loader ---
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

// Padding tuned so pickup/dropoff marker tips (52px tall, anchored at bottom)
// never touch the container edges — including tight mobile portrait viewports.
const FIT_PADDING = { top: 68, right: 44, bottom: 68, left: 44 };

const ROUTE_STROKE_COLOR = "#1D4ED8"; // Google-blue, high-contrast on grey tiles
const ROUTE_STROKE_WEIGHT = 6;
const ROUTE_STROKE_OPACITY = 0.92;

const MARKER_GREEN = "#16A34A"; // pickup
const MARKER_RED = "#D62828";   // dropoff
const MARKER_BLUE = "#2563EB";  // driver

// Format helpers for the summary strip
function fmtDistanceMiles(m) {
  if (m == null || !Number.isFinite(Number(m))) return null;
  const n = Number(m);
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} mi`;
}
function fmtDurationMinutes(mins) {
  if (mins == null || !Number.isFinite(Number(mins))) return null;
  const n = Math.round(Number(mins));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// SVG teardrop marker icon (green/red/blue + white letter + white outline + shadow).
// Returned as a Google Maps Icon object with correct anchor at the tip.
function buildTeardropIcon(maps, color, letter) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">` +
      `<defs>` +
        `<filter id="s" x="-30%" y="-10%" width="160%" height="130%">` +
          `<feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>` +
          `<feOffset dy="2" result="off"/>` +
          `<feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>` +
          `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>` +
        `</filter>` +
      `</defs>` +
      `<path filter="url(#s)" d="M20 2C10.6 2 3 9.6 3 19c0 12 17 30 17 30s17-18 17-30c0-9.4-7.6-17-17-17z" ` +
        `fill="${color}" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>` +
      (letter
        ? `<text x="20" y="25" text-anchor="middle" font-family="Inter, -apple-system, Segoe UI, sans-serif" ` +
          `font-size="16" font-weight="800" fill="#FFFFFF">${letter}</text>`
        : ``) +
    `</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(40, 52),
    anchor: new maps.Point(20, 50),
    labelOrigin: new maps.Point(20, 20),
  };
}

// Small circular driver icon (blue dot with white ring + shadow).
function buildDriverIcon(maps) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">` +
      `<defs><filter id="ds" x="-30%" y="-30%" width="160%" height="160%">` +
        `<feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/>` +
        `<feOffset dy="1.5" result="o"/>` +
        `<feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>` +
        `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>` +
      `</filter></defs>` +
      `<circle filter="url(#ds)" cx="14" cy="14" r="9" fill="${MARKER_BLUE}" stroke="#FFFFFF" stroke-width="3"/>` +
    `</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(28, 28),
    anchor: new maps.Point(14, 14),
  };
}

// ============================================================ summary ===
function SummaryStrip({ summary, testID }) {
  if (!summary) return null;
  const { pickupTown, dropoffTown, distanceMiles, durationMinutes } = summary;
  const hasTowns = pickupTown || dropoffTown;
  const distText = fmtDistanceMiles(distanceMiles);
  const durText = fmtDurationMinutes(durationMinutes);
  if (!hasTowns && !distText && !durText) return null;
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#111111]"
      data-testid={`${testID}-summary`}
    >
      {hasTowns && (
        <div className="flex min-w-0 items-center gap-1.5 font-semibold" data-testid={`${testID}-summary-route`}>
          <MapPin className="h-4 w-4 shrink-0 text-[#16A34A]" />
          <span className="truncate">{pickupTown || "Pickup"}</span>
          <span className="text-[#9CA3AF]">→</span>
          <MapPin className="h-4 w-4 shrink-0 text-[#D62828]" />
          <span className="truncate">{dropoffTown || "Dropoff"}</span>
        </div>
      )}
      {distText && (
        <div className="flex items-center gap-1 text-[#374151]" data-testid={`${testID}-summary-distance`}>
          <Navigation className="h-3.5 w-3.5 text-[#6B7280]" />
          <span className="tabular-nums font-medium">{distText}</span>
        </div>
      )}
      {durText && (
        <div className="flex items-center gap-1 text-[#374151]" data-testid={`${testID}-summary-duration`}>
          <Clock className="h-3.5 w-3.5 text-[#6B7280]" />
          <span className="tabular-nums font-medium">{durText}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================ component ===
export function RouteMap({
  pickup,
  dropoff,
  driver = null,
  trail = null,
  height = 220,
  testID = "route-map",
  summary = null,
}) {
  const canUseGoogle = validPt(pickup) && validPt(dropoff) && MAPS_JS_KEY;

  return (
    <div data-testid={`${testID}-wrapper`}>
      <SummaryStrip summary={summary} testID={testID} />
      {canUseGoogle ? (
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
      )}
    </div>
  );
}

// ================================================= real Google Maps view ===
function GoogleRouteMap({ pickup, dropoff, driver, trail, height, testID }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const rendererRef = useRef(null);
  const markersRef = useRef([]);
  const trailPolyRef = useRef(null);
  const fallbackLineRef = useRef(null);
  const boundsRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

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
        fallbackLineRef.current?.setMap(null);
        fallbackLineRef.current = null;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "cooperative",
            clickableIcons: false,
            backgroundColor: "#EEF2F7",
          });
        }

        const bounds = new maps.LatLngBounds();
        bounds.extend({ lat: pickup.lat, lng: pickup.lng });
        bounds.extend({ lat: dropoff.lat, lng: dropoff.lng });

        // Branded pickup + dropoff markers
        const pMarker = new maps.Marker({
          position: { lat: pickup.lat, lng: pickup.lng },
          map: mapRef.current,
          icon: buildTeardropIcon(maps, MARKER_GREEN, "P"),
          title: pickup.label || "Pickup",
          zIndex: 3,
        });
        const dMarker = new maps.Marker({
          position: { lat: dropoff.lat, lng: dropoff.lng },
          map: mapRef.current,
          icon: buildTeardropIcon(maps, MARKER_RED, "D"),
          title: dropoff.label || "Dropoff",
          zIndex: 3,
        });
        markersRef.current.push(pMarker, dMarker);

        // Driver marker (blue circle) — visually distinct
        if (validPt(driver)) {
          const drv = new maps.Marker({
            position: { lat: driver.lat, lng: driver.lng },
            map: mapRef.current,
            icon: buildDriverIcon(maps),
            title: "Driver",
            zIndex: 4,
          });
          markersRef.current.push(drv);
          bounds.extend(drv.getPosition());
        }

        // Breadcrumb trail (existing)
        if (Array.isArray(trail) && trail.filter(validPt).length >= 2) {
          const path = trail.filter(validPt).map((t) => ({ lat: t.lat, lng: t.lng }));
          trailPolyRef.current = new maps.Polyline({
            path,
            geodesic: true,
            strokeColor: MARKER_RED,
            strokeOpacity: 0.9,
            strokeWeight: 3,
            map: mapRef.current,
          });
          path.forEach((p) => bounds.extend(p));
        }

        // Real road-following route via DirectionsService.
        const ds = new maps.DirectionsService();
        rendererRef.current = new maps.DirectionsRenderer({
          suppressMarkers: true, // our branded markers stay
          preserveViewport: true, // we own fitBounds
          polylineOptions: {
            strokeColor: ROUTE_STROKE_COLOR,
            strokeOpacity: ROUTE_STROKE_OPACITY,
            strokeWeight: ROUTE_STROKE_WEIGHT,
            geodesic: true,
            zIndex: 2,
          },
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
              // Straight-line fallback on real tiles — same blue look for consistency.
              fallbackLineRef.current = new maps.Polyline({
                path: [
                  { lat: pickup.lat, lng: pickup.lng },
                  { lat: dropoff.lat, lng: dropoff.lng },
                ],
                geodesic: true,
                strokeColor: ROUTE_STROKE_COLOR,
                strokeOpacity: 0.7,
                strokeWeight: ROUTE_STROKE_WEIGHT,
                map: mapRef.current,
                zIndex: 1,
              });
            }
            boundsRef.current = bounds;
            fit();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driver?.lat, driver?.lng, JSON.stringify(trail || [])]);

  // Refit on container resize / orientation change
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
      className="relative w-full overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-[#EEF2F7]"
      style={{ height }}
      data-testid={testID}
      data-map-engine="google"
    >
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#EEF2F7] via-[#E5EAF0] to-[#E0E7EF]"
          data-testid={`${testID}-loading`}
          aria-label="Loading map"
        />
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
    if (maxLat === minLat) { minLat -= 0.01; maxLat += 0.01; }
    if (maxLng === minLng) { minLng -= 0.01; maxLng += 0.01; }
    const pad = 0.12; // matches the more generous Google padding
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
          <line
            x1={p.x}
            y1={p.y}
            x2={d.x}
            y2={d.y}
            stroke={ROUTE_STROKE_COLOR}
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
        )}
        {trailPts.length >= 2 && (
          <polyline
            fill="none"
            stroke={MARKER_RED}
            strokeWidth="0.7"
            points={trailPts.map((t) => `${t.x},${t.y}`).join(" ")}
          />
        )}
        {p && (
          <>
            <circle cx={p.x} cy={p.y} r="2.8" fill={MARKER_GREEN} stroke="#FFFFFF" strokeWidth="0.7" />
            <text x={p.x} y={p.y + 1.0} textAnchor="middle" fontSize="2.1" fill="#FFFFFF" fontWeight="800">
              P
            </text>
          </>
        )}
        {d && (
          <>
            <circle cx={d.x} cy={d.y} r="2.8" fill={MARKER_RED} stroke="#FFFFFF" strokeWidth="0.7" />
            <text x={d.x} y={d.y + 1.0} textAnchor="middle" fontSize="2.1" fill="#FFFFFF" fontWeight="800">
              D
            </text>
          </>
        )}
        {drv && (
          <>
            <circle cx={drv.x} cy={drv.y} r="2.2" fill={MARKER_BLUE} stroke="#FFFFFF" strokeWidth="0.6" />
          </>
        )}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-2 text-[10px]">
        {pickup?.label && (
          <span className="rounded-full bg-[#16A34A] px-2 py-0.5 font-semibold text-white">{pickup.label}</span>
        )}
        {dropoff?.label && (
          <span className="rounded-full bg-[#D62828] px-2 py-0.5 font-semibold text-white">{dropoff.label}</span>
        )}
      </div>
    </div>
  );
}

export default RouteMap;
