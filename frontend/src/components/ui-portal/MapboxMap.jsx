import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Navigation, AlertCircle } from "lucide-react";

/**
 * classifyMapboxError — pure classifier used by the MapboxMap error handler.
 *
 * The mapbox-gl `error` event fires for MANY conditions, most of them
 * non-fatal (single tile 404, glyph subrange fetch retry, telemetry
 * blocked by an ad-blocker, etc.). The dispatcher only wants to fall
 * back to Google when the map is genuinely unable to render. This
 * classifier is exported so it can be unit-tested in isolation.
 *
 * Returns "fatal" or "non_fatal".
 * `hasLoaded=true` means the map has already successfully rendered at
 * least once, so ANY subsequent error is treated as non-fatal.
 */
export function classifyMapboxError(err, { hasLoaded = false } = {}) {
  if (hasLoaded) return "non_fatal";
  const status = err?.status || err?.statusCode ||
    (err?.error && (err.error.status || err.error.statusCode)) || null;
  const message = String(err?.message || err?.error?.message || err || "");
  if (status === 401 || status === 403) return "fatal";
  // Genuine fatal signals from mapbox-gl during initial load
  if (/^(?:No Token|Not Authorized|A valid Mapbox access token|access token is required|WebGL is not supported|WebGL is required|Mapbox GL unsupported|Mapbox failed to load|Style is not done loading|Failed to load style|CSP|Content Security Policy)/i.test(message))
    return "fatal";
  // Anything else pre-load is treated as transient/non-fatal — the map
  // might still recover on the next tick. If Mapbox never fires `load`,
  // the customer sees the transparent map placeholder and can refresh;
  // we prefer that over an eager Google swap on a single tile 404.
  return "non_fatal";
}

/**
 * MapboxMap — shared Mapbox base wrapper used by RouteMap, DriverLiveMap
 * and the new AvailableJobsMap. Keeps every consumer on ONE map layer +
 * ONE style + ONE token so we don't spin up a second Google Maps SDK.
 *
 * Props:
 *   center          — [lng, lat] initial camera centre (defaults to UK).
 *   zoom            — initial zoom (defaults to 5.4).
 *   markers         — [{id, lng, lat, color?, testId?, popupHtml?, onClick?}]
 *                     Full-freedom marker list. Consumer decides the style.
 *   routeCoordinates — optional [[lng,lat], [lng,lat], …] Great-circle
 *                     line drawn behind markers (used by RouteMap only).
 *   fitBounds       — boolean; when true, the map auto-fits to all
 *                     provided markers + route on every markers change.
 *   showRecenter    — boolean; renders a floating "Recenter" button using
 *                     the browser Geolocation API.
 *   className       — Tailwind classes for the wrapping div (height +
 *                     rounding). Defaults to a 320px card.
 *   'data-testid'   — root testid.
 */
export function MapboxMap({
  center = [-2.5, 54.0],
  zoom = 5.4,
  markers = [],
  routeCoordinates = null,
  trailCoordinates = null,   // R27 — customer BookingDetail breadcrumb polyline
  sweep = null,              // R27 — {lng, lat, color?, radiusMeters?} pulsing dispatch circle
  fitBounds = true,
  showRecenter = false,
  className = "h-80 w-full rounded-2xl overflow-hidden",
  onLoad = null,             // R27 — parent-side ready hook
  onError = null,            // R27 — parent-side failure hook (token restriction, etc.)
  "data-testid": testId = "mapbox-map",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const routeLoaded = useRef(false);
  const sweepAnimRef = useRef(null);
  const hasLoaded = useRef(false);   // R27.1 — becomes true on `map.on("load")`
  const [tokenMissing, setTokenMissing] = useState(false);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);

  // Initialise map once
  useEffect(() => {
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (!token) {
      setTokenMissing(true);
      onError && onError(new Error("REACT_APP_MAPBOX_TOKEN missing"));
      return undefined;
    }
    mapboxgl.accessToken = token;
    // R27.1 — silence Mapbox telemetry. `events.mapbox.com` is blocked by
    // uBlock / Brave / privacy extensions on ~15% of real UK traffic; when
    // blocked it fires an `error` event that we no longer treat as fatal
    // (see classifyMapboxError). Belt-and-braces disable it too.
    try {
      if (typeof mapboxgl.setTelemetryEnabled === "function") {
        mapboxgl.setTelemetryEnabled(false);
      }
    } catch { /* older mapbox-gl versions may not expose this — safe to ignore */ }
    // R27.2 — iOS Safari (Low Power Mode / WebGL disabled / GPU blocklist)
    // can silently fail to allocate a WebGL context. mapboxgl.supported()
    // is the canonical up-front capability probe. When false, we skip the
    // Map constructor entirely and bubble a fatal error so the dispatcher
    // falls back to Google (Google Maps uses raster tiles — works on
    // every iOS Safari + WebGL-disabled browser).
    try {
      if (typeof mapboxgl.supported === "function"
          && !mapboxgl.supported({ failIfMajorPerformanceCaveat: true })) {
        const err = new Error("Mapbox GL unsupported on this browser (WebGL unavailable)");
        setInitError(err);
        onError && onError(err);
        return undefined;
      }
    } catch { /* very old / very new mapbox-gl may not expose .supported — proceed anyway */ }
    if (!containerRef.current) return undefined;
    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom,
        attributionControl: false,
      });
    } catch (e) {
      // Constructor throwing = truly fatal (WebGL unsupported, bad container, etc.)
      setInitError(e);
      onError && onError(e);
      return undefined;
    }
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    // R27.3 — Load-timeout failsafe: iOS Safari can occasionally accept the
    // constructor (mapboxgl.supported returned true) but then silently hang
    // without firing `load` OR `error` (background restore, WebGL context
    // creation ok'd but paint never happens, or GPU stall). If `load` hasn't
    // fired within 8 seconds, we treat it as a fatal init failure and let
    // the dispatcher fall back to Google raster tiles.
    const loadTimeout = setTimeout(() => {
      if (!hasLoaded.current) {
        const err = new Error("Mapbox failed to load within 8s — likely iOS Safari WebGL init hang");
        // eslint-disable-next-line no-console
        console.warn("[MapboxMap] load timeout, bubbling to dispatcher:", err.message);
        setInitError(err);
        onError && onError(err);
      }
    }, 8000);
    map.on("load", () => {
      clearTimeout(loadTimeout);
      hasLoaded.current = true;
      setReady(true);
      onLoad && onLoad();
    });
    map.on("error", (ev) => {
      const err = ev?.error || ev || new Error("mapbox error");
      const kind = classifyMapboxError(err, { hasLoaded: hasLoaded.current });
      if (kind === "fatal") {
        // eslint-disable-next-line no-console
        console.warn("[MapboxMap] fatal error, bubbling to dispatcher:", err?.message || err);
        setInitError(err);
        onError && onError(err);
      } else {
        // eslint-disable-next-line no-console
        console.debug("[MapboxMap] non-fatal error ignored:", err?.message || err);
      }
    });
    mapRef.current = map;
    return () => {
      clearTimeout(loadTimeout);
      if (sweepAnimRef.current) {
        cancelAnimationFrame(sweepAnimRef.current);
        sweepAnimRef.current = null;
      }
      try { map.remove(); } catch { /* ignore */ }
      mapRef.current = null;
      routeLoaded.current = false;
      hasLoaded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Wipe old markers
    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];
    if (!markers.length) return;
    markers.forEach((mk) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer";
      el.setAttribute("data-testid", mk.testId || `map-marker-${mk.id}`);
      el.style.cssText = `
        display:flex;align-items:center;justify-content:center;
        width:${mk.size || 34}px;height:${mk.size || 34}px;
        border-radius:9999px;border:2px solid #fff;
        background:${mk.color || "#EA580C"};
        color:#000;font-weight:800;font-size:12px;
        box-shadow:0 4px 12px -4px rgba(0,0,0,0.4);
      `;
      el.innerHTML = mk.label ? String(mk.label) : "●";
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([mk.lng, mk.lat])
        .addTo(map);
      if (mk.onClick) {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          mk.onClick(mk);
        });
      }
      markerRefs.current.push(marker);
    });
    if (fitBounds) {
      try {
        const bounds = new mapboxgl.LngLatBounds();
        markers.forEach((mk) => bounds.extend([mk.lng, mk.lat]));
        (routeCoordinates || []).forEach((c) => bounds.extend(c));
        (trailCoordinates || []).forEach((c) => bounds.extend(c));
        if (sweep && Number.isFinite(sweep.lng) && Number.isFinite(sweep.lat)) {
          bounds.extend([sweep.lng, sweep.lat]);
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 600 });
        }
      } catch { /* ignore */ }
    }
  }, [markers, ready, fitBounds, routeCoordinates, trailCoordinates, sweep]);

  // Draw route line (main road-polyline)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const sourceId = "route-line";
    if (!routeCoordinates || routeCoordinates.length < 2) {
      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }
    const geo = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: routeCoordinates },
    };
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geo);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geo });
      // Casing (white halo, wider) under the main line for the "Google-Maps app" sheen.
      map.addLayer({
        id: `${sourceId}-casing`,
        type: "line",
        source: sourceId,
        paint: { "line-color": "#FFFFFF", "line-width": 10, "line-opacity": 0.72 },
      });
      map.addLayer({
        id: sourceId,
        type: "line",
        source: sourceId,
        paint: { "line-color": "#1F2937", "line-width": 6, "line-opacity": 0.98 },
      });
    }
  }, [routeCoordinates, ready]);

  // Draw driver breadcrumb trail (blue polyline behind markers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const sourceId = "trail-line";
    if (!trailCoordinates || trailCoordinates.length < 2) {
      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }
    const geo = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: trailCoordinates },
    };
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geo);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geo });
      map.addLayer({
        id: sourceId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#2563EB",
          "line-width": 3.5,
          "line-opacity": 0.9,
          "line-dasharray": [0.6, 1.2],
        },
      });
    }
  }, [trailCoordinates, ready]);

  // Pulsing radius sweep animation (DriverLive dispatch heartbeat)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const sourceId = "sweep-circle";
    if (!sweep || !Number.isFinite(sweep.lng) || !Number.isFinite(sweep.lat)) {
      if (sweepAnimRef.current) {
        cancelAnimationFrame(sweepAnimRef.current);
        sweepAnimRef.current = null;
      }
      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }
    // Convert desired METRES radius to pixels using the built-in projection.
    // We paint a fixed circle-radius in pixels for now (fast; readable at zooms
    // 8-14 which is where DriverLive lives), and pulse opacity for the sweep.
    const color = sweep.color || "#EA580C";
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Point", coordinates: [sweep.lng, sweep.lat] },
        },
      });
      map.addLayer({
        id: sourceId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 80,
          "circle-color": color,
          "circle-opacity": 0.15,
          "circle-stroke-color": color,
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.5,
        },
      });
    } else {
      map.getSource(sourceId).setData({
        type: "Feature",
        geometry: { type: "Point", coordinates: [sweep.lng, sweep.lat] },
      });
    }
    // Animate: pulse radius 40 → 100 px and opacity 0.35 → 0.05 on a 1.8s loop.
    let start;
    const tick = (ts) => {
      if (start === undefined) start = ts;
      const t = ((ts - start) % 1800) / 1800; // 0..1
      const r = 40 + t * 60;
      const o = 0.35 - t * 0.30;
      const layer = map.getLayer(sourceId);
      if (layer) {
        map.setPaintProperty(sourceId, "circle-radius", r);
        map.setPaintProperty(sourceId, "circle-opacity", Math.max(o, 0.02));
        map.setPaintProperty(sourceId, "circle-stroke-opacity", Math.max(o + 0.15, 0.05));
      }
      sweepAnimRef.current = requestAnimationFrame(tick);
    };
    sweepAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (sweepAnimRef.current) {
        cancelAnimationFrame(sweepAnimRef.current);
        sweepAnimRef.current = null;
      }
    };
  }, [sweep, ready]);

  const recenter = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 12,
          duration: 700,
        });
      },
      () => { /* silent — user may have denied */ },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  if (tokenMissing || initError) {
    const isRestriction = initError && /restrict|401|403|unauthor/i.test(String(initError?.message || initError));
    return (
      <div
        className={`${className} flex flex-col items-center justify-center gap-2 border border-amber-200 bg-amber-50 p-4 text-center`}
        data-testid={`${testId}-${tokenMissing ? "token-missing" : "error"}`}
      >
        <AlertCircle className="h-8 w-8 text-amber-600" />
        <p className="text-[13px] font-semibold text-amber-900">
          {tokenMissing ? "Map is not configured" : "Map failed to load"}
        </p>
        <p className="text-[11px] text-amber-800">
          {tokenMissing
            ? <>Set <code>REACT_APP_MAPBOX_TOKEN</code> in the frontend .env to enable maps.</>
            : isRestriction
              ? "This origin is not allowed by the Mapbox token URL restrictions."
              : "Map tiles could not be loaded. Check network."}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} data-testid={testId}>
      <div ref={containerRef} className="absolute inset-0" />
      {showRecenter && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter on me"
          data-testid={`${testId}-recenter`}
          className="absolute bottom-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md hover:bg-neutral-100"
        >
          <Navigation className="h-4 w-4 text-neutral-700" />
        </button>
      )}
    </div>
  );
}

export default MapboxMap;

// Small helper — canonical pin colours per job type
export const JOB_MARKER_STYLE = {
  asap_transport:  { color: "#EA580C", label: "A" }, // orange
  asap_recovery:   { color: "#DC2626", label: "R" }, // red
  scheduled_fixed: { color: "#2563EB", label: "F" }, // blue
  scheduled_bid:   { color: "#059669", label: "B" }, // green
  driver_me:       { color: "#111111", label: "•" }, // black dot
};

/** Given a job dict, return the canonical marker style. */
export function styleForJob(job) {
  const asap = (job.service_timing || "").toLowerCase() === "asap";
  const recovery = (job.service_type || "").toLowerCase() === "breakdown_recovery";
  if (asap && recovery) return JOB_MARKER_STYLE.asap_recovery;
  if (asap) return JOB_MARKER_STYLE.asap_transport;
  if ((job.pricing_type || "").toLowerCase() === "bidding") return JOB_MARKER_STYLE.scheduled_bid;
  return JOB_MARKER_STYLE.scheduled_fixed;
}
