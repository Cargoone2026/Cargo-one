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
  // R27.5 — Always-on diagnostic overlay state. Updated as lifecycle stages
  // fire. Rendered on top of the map so the user can screenshot the iPhone
  // and paste the JSON without needing Safari Web Inspector.
  const [diag, setDiag] = useState({
    stage: "boot",
    elapsed: 0,
    events: 0,
    reqs: { style: 0, tile: 0, glyph: 0, sprite: 0, other: 0 },
    errs: 0,
    lastErr: null,
    w: 0, h: 0,
  });

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

    // ─────────────────────────────────────────────────────────────────────
    // R27.5 — DIAGNOSTIC BUILD (always-on, never logs token)
    //
    // The R27.4 diagnostic path was gated behind ?debug_mapbox=1 which
    // means we get no data from a real user on production. This build
    // logs every Mapbox lifecycle event unconditionally with a
    // `[MAPBOX-DIAG]` prefix, captures the full event timeline into
    // `window.__mapboxDiag__`, and renders a compact on-screen overlay
    // so the user can screenshot from an iPhone without needing Safari
    // Web Inspector attached.
    // ─────────────────────────────────────────────────────────────────────
    const t0 = Date.now();
    const timeline = [];
    const reqCounts = { style: 0, tile: 0, glyph: 0, sprite: 0, other: 0 };
    let errCount = 0;
    let lastErrMsg = null;
    let lastStage = "boot";

    const stripToken = (url) => {
      if (typeof url !== "string") return String(url || "");
      return url.replace(/([?&])access_token=[^&]+/g, "$1access_token=REDACTED");
    };
    const classify = (url) => {
      const u = String(url || "");
      if (/\/styles\/v1\//.test(u)) return "style";
      if (/\/fonts\/v1\//.test(u) || /\.pbf(\?|$)/.test(u) && /glyph/i.test(u)) return "glyph";
      if (/\/sprites?\//.test(u) || /sprite@?/.test(u)) return "sprite";
      if (/\/tiles\//.test(u) || /\.mvt(\?|$)/.test(u) || /\.pbf(\?|$)/.test(u)) return "tile";
      return "other";
    };
    const emit = (stage, extra) => {
      const elapsed = Date.now() - t0;
      lastStage = stage;
      const entry = { t: elapsed, stage, ...(extra || {}) };
      timeline.push(entry);
      try {
        // eslint-disable-next-line no-console
        console.info(`[MAPBOX-DIAG] +${elapsed}ms ${stage}`, extra || "");
      } catch { /* ignore */ }
      setDiag((d) => ({
        ...d,
        stage,
        elapsed,
        events: timeline.length,
        reqs: { ...reqCounts },
        errs: errCount,
        lastErr: lastErrMsg,
        w: containerRef.current ? containerRef.current.clientWidth : d.w,
        h: containerRef.current ? containerRef.current.clientHeight : d.h,
      }));
    };
    // Expose full timeline for post-mortem inspection from Safari console.
    try {
      window.__mapboxDiag__ = window.__mapboxDiag__ || { instances: [] };
      window.__mapboxDiag__.current = { t0, timeline, reqCounts, get errs() { return errCount; }, get lastErr() { return lastErrMsg; } };
      window.__mapboxDiag__.instances.push(window.__mapboxDiag__.current);
    } catch { /* ignore */ }

    // R27.2 — iOS Safari (Low Power Mode / WebGL disabled / GPU blocklist)
    // can silently fail to allocate a WebGL context. mapboxgl.supported()
    // is the canonical up-front capability probe. When false, we skip the
    // Map constructor entirely and bubble a fatal error so the dispatcher
    // falls back to Google.
    let supported = null;
    try {
      supported = typeof mapboxgl.supported === "function"
        ? mapboxgl.supported({ failIfMajorPerformanceCaveat: false })
        : null;
    } catch { supported = null; }

    // Detailed WebGL capability probe — fills gaps that mapboxgl.supported() hides.
    const glProbe = (() => {
      try {
        const c = document.createElement("canvas");
        const gl2 = c.getContext("webgl2");
        const gl = gl2 || c.getContext("webgl") || c.getContext("experimental-webgl");
        if (!gl) return { hasGl: false };
        const dbgInfo = gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
        return {
          hasGl: true,
          webgl2: !!gl2,
          vendor: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          renderer: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxVpDims: (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || []).toString(),
        };
      } catch (e) { return { hasGl: false, probeErr: String(e && e.message) }; }
    })();

    const containerEl = containerRef.current;
    const containerSnapshot = () => {
      if (!containerEl) return { present: false };
      const rect = containerEl.getBoundingClientRect();
      const cs = window.getComputedStyle ? window.getComputedStyle(containerEl) : {};
      return {
        present: true,
        connected: containerEl.isConnected,
        offsetParent: !!containerEl.offsetParent,
        clientW: containerEl.clientWidth,
        clientH: containerEl.clientHeight,
        rectW: Math.round(rect.width),
        rectH: Math.round(rect.height),
        display: cs.display,
        visibility: cs.visibility,
        position: cs.position,
      };
    };

    emit("init.start", {
      ua: navigator.userAgent.slice(0, 140),
      mapboxVersion: mapboxgl.version || "unknown",
      supported,
      dpr: window.devicePixelRatio,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      container: containerSnapshot(),
      gl: glProbe,
    });

    if (supported === false) {
      const err = new Error("Mapbox GL unsupported on this browser (WebGL unavailable)");
      emit("init.unsupported", { reason: "mapboxgl.supported=false" });
      setInitError(err);
      onError && onError(err);
      return undefined;
    }
    if (!containerEl) { emit("init.no-container"); return undefined; }

    let map;
    const styleUrl = "mapbox://styles/mapbox/streets-v12";
    try {
      map = new mapboxgl.Map({
        container: containerEl,
        style: styleUrl,
        center,
        zoom,
        attributionControl: false,
        preserveDrawingBuffer: false,
        antialias: false,
        // R27.5 — transformRequest lets us observe every outbound URL
        // (style JSON, sprite, glyphs, vector tiles) with the token
        // stripped. This is the single most valuable data point for
        // pinpointing where the iOS Safari load stalls: does the style
        // request even fire? do glyphs 200? do tiles 200?
        transformRequest: (url, resourceType) => {
          const kind = classify(url);
          reqCounts[kind] = (reqCounts[kind] || 0) + 1;
          emit(`req.${kind}`, { resourceType, url: stripToken(url) });
          return { url };
        },
      });
      emit("map.constructed", { style: styleUrl });
    } catch (e) {
      emit("map.construct.throw", { message: String(e && e.message) });
      setInitError(e);
      onError && onError(e);
      return undefined;
    }

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    // R27.3 — Load-timeout failsafe: 8-second budget for `load` to fire.
    const loadTimeout = setTimeout(() => {
      if (!hasLoaded.current) {
        const err = new Error("Mapbox failed to load within 8s — likely iOS Safari WebGL init hang");
        emit("timeout.8s", {
          stage: lastStage,
          reqCounts: { ...reqCounts },
          errs: errCount,
          lastErr: lastErrMsg,
          container: containerSnapshot(),
        });
        // eslint-disable-next-line no-console
        console.warn("[MAPBOX-DIAG] 8s load timeout — falling back to Google. Stage at timeout:", lastStage, "Requests:", { ...reqCounts });
        setInitError(err);
        onError && onError(err);
      }
    }, 8000);

    // Layout checkpoints — capture container dimensions at several points to
    // detect a late layout / 0-height parent that Mapbox saw on construction.
    const layoutChecks = [100, 500, 1000, 3000, 7000].map((ms) =>
      setTimeout(() => emit(`layout.t${ms}`, { container: containerSnapshot() }), ms),
    );

    // R27.4 — Defensive resize after 250ms.
    const resizeTimeout = setTimeout(() => {
      try { map.resize(); emit("map.resize.forced"); } catch { /* ignore */ }
    }, 250);

    // Full Mapbox lifecycle event surface — every stage user asked for.
    map.on("load", () => {
      clearTimeout(loadTimeout);
      hasLoaded.current = true;
      setReady(true);
      emit("map.load", { container: containerSnapshot() });
      // eslint-disable-next-line no-console
      console.info("[MAPBOX-DIAG] ✓ map.load fired — Mapbox is live");
      onLoad && onLoad();
    });
    map.on("style.load",  () => emit("map.style.load"));
    map.on("styledata",   (e) => emit("map.styledata", { dataType: e && e.dataType }));
    map.on("sourcedata",  (e) => emit("map.sourcedata", {
      sourceId: e && e.sourceId, isSourceLoaded: !!(e && e.isSourceLoaded), sourceDataType: e && e.sourceDataType,
    }));
    map.on("dataloading", (e) => emit("map.dataloading", { dataType: e && e.dataType }));
    map.on("data",        (e) => emit("map.data", { dataType: e && e.dataType }));
    map.on("idle",        () => emit("map.idle"));
    let renderCount = 0;
    map.on("render", () => {
      renderCount++;
      if (renderCount === 1) emit("map.render.first");
      if (renderCount === 10) emit("map.render.10");
      if (renderCount === 60) emit("map.render.60");
    });
    map.on("webglcontextlost",    () => emit("map.webglcontextlost"));
    map.on("webglcontextrestored",() => emit("map.webglcontextrestored"));

    map.on("error", (ev) => {
      const err = ev?.error || ev || new Error("mapbox error");
      errCount++;
      lastErrMsg = String(err?.message || err).slice(0, 200);
      const kind = classifyMapboxError(err, { hasLoaded: hasLoaded.current });
      emit(`map.error.${kind}`, {
        message: lastErrMsg,
        status: err?.status || err?.statusCode || null,
        url: stripToken(err?.url || ev?.sourceId || ""),
      });
      if (kind === "fatal") {
        // eslint-disable-next-line no-console
        console.warn("[MAPBOX-DIAG] fatal error → dispatcher fallback:", lastErrMsg);
        setInitError(err);
        onError && onError(err);
      } else {
        // eslint-disable-next-line no-console
        console.debug("[MAPBOX-DIAG] non-fatal error ignored:", lastErrMsg);
      }
    });

    mapRef.current = map;
    return () => {
      clearTimeout(loadTimeout);
      clearTimeout(resizeTimeout);
      layoutChecks.forEach(clearTimeout);
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
    <div
      className={`relative ${className}`}
      data-testid={testId}
      style={{ minHeight: 200 }}   /* R27.4 — guarantee non-zero container
        even during the initial React layout tick. iOS Safari reads container
        dimensions synchronously inside `new mapboxgl.Map()`; a 0-height
        container is one of the top three causes of silent-hang failures. */
    >
      <div ref={containerRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />
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

      {/* R27.5 — Diagnostic overlay. Renders a compact status badge in the
          top-left showing what stage Mapbox reached, request counts, and
          any errors. Removed once `map.load` succeeds so production users
          who see Mapbox never see it. When the iPhone hangs, the user can
          screenshot the badge and we know exactly where it stalled. */}
      {!ready && (
        <div
          data-testid={`${testId}-diag`}
          className="pointer-events-none absolute top-2 left-2 z-20 max-w-[92%] rounded-md bg-black/75 px-2 py-1 font-mono text-[10px] leading-tight text-white shadow"
        >
          <div><b>MB</b> v{mapboxgl.version || "?"} · dpr {typeof window !== "undefined" ? window.devicePixelRatio : "?"}</div>
          <div>stage: <b>{diag.stage}</b> · {diag.elapsed}ms · ev {diag.events}</div>
          <div>size: {diag.w}×{diag.h}</div>
          <div>req: s{diag.reqs.style} t{diag.reqs.tile} g{diag.reqs.glyph} sp{diag.reqs.sprite} o{diag.reqs.other}</div>
          {diag.errs > 0 && <div className="text-amber-300">err×{diag.errs}: {String(diag.lastErr || "").slice(0, 60)}</div>}
        </div>
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
