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
  // R27.6 — Always-on diagnostic overlay state. Updated as lifecycle stages
  // fire. Rendered on top of the map so the user can screenshot the iPhone
  // and paste the JSON without needing Safari Web Inspector.
  //
  // NB: NO object-literal getters or exotic property descriptors — those
  // proved brittle under Terser + iOS Safari (surfaced as `Can't find
  // variable: o` in the R27.5 build). Plain object with plain fields only.
  const [diag, setDiag] = useState({
    stage: "boot",
    elapsed: 0,
    events: 0,
    reqs: { style: 0, tile: 0, glyph: 0, sprite: 0, other: 0 },
    // Explicit boolean lifecycle flags — user asked for these to
    // distinguish style vs tile vs render vs WebGL failure modes.
    styleLoaded: false,
    mapLoaded: false,
    firstRender: false,
    idle: false,
    webglReady: false,
    // Separate error counters (Mapbox source-level vs window-level JS)
    styleErrors: 0,
    tileErrors: 0,
    otherErrors: 0,
    jsErrors: 0,
    lastErr: null,
    // R27.7 — actual error text + signature-count for overlay display.
    // mbErrText: latest Mapbox error message (truncated). mbErrSame: true
    // when all Mapbox errors so far share the same signature; false when
    // there are multiple distinct signatures. jsErrText / jsErrSame:
    // same, but for window.onerror + unhandledrejection.
    mbErrText: null,
    mbErrSame: true,
    mbErrDistinct: 0,
    jsErrText: null,
    jsErrSame: true,
    jsErrDistinct: 0,
    // R27.7 — per-event counts (styledata / sourcedata / data / render
    // / idle) so we can tell whether render ticks after the first paint
    // or halts.
    eventCounts: { styledata: 0, sourcedata: 0, data: 0, render: 0, idle: 0 },
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
    // R27.6 — DIAGNOSTIC BUILD (always-on, never logs token, Safari-safe)
    //
    // Every diagnostic call is wrapped in safe() so a diagnostic exception
    // can NEVER interrupt Mapbox itself. No object-literal getters, no
    // property descriptor tricks — those proved brittle under iOS Safari
    // JIT + Terser in the R27.5 build (surfaced as "Can't find variable: o").
    // ─────────────────────────────────────────────────────────────────────
    const t0 = Date.now();
    const timeline = [];
    const errorLog = [];       // rich Mapbox error records
    const jsErrorLog = [];     // window.onerror + unhandledrejection records
    const reqCounts = { style: 0, tile: 0, glyph: 0, sprite: 0, other: 0 };
    // R27.7 — per-lifecycle-event counts + last URL requested (for
    // error correlation). Answers: does render tick after the first
    // render? does styledata keep firing? What was requested right
    // before the error?
    const eventCounts = { styledata: 0, sourcedata: 0, data: 0, dataloading: 0, render: 0, idle: 0 };
    let lastReqUrl = null;
    // R27.7 — signature buckets so we can report "same error ×N" vs
    // "N distinct errors". Kept small; each entry stores { count, first, last }.
    const mbErrorSigs = Object.create(null);
    const jsErrorSigs = Object.create(null);
    let lastMapboxError = null;   // rich record, exposed via window.__mapboxDiag__.current
    let lastJSError = null;
    let styleErrCount = 0;
    let tileErrCount = 0;
    let otherErrCount = 0;
    let jsErrCount = 0;
    let lastErrMsg = null;
    let lastStage = "boot";
    let styleLoadedFlag = false;
    let mapLoadedFlag = false;
    let firstRenderFlag = false;
    let idleFlag = false;
    let webglReadyFlag = false;

    // ── Defensive wrapper: any diagnostic exception is swallowed and
    //    logged as a jsError, but never rethrown to Mapbox / React.
    const safe = (label, fn) => {
      try { return fn(); } catch (e) {
        jsErrCount += 1;
        const rec = {
          t: Date.now() - t0,
          origin: "safe:" + label,
          message: String(e && e.message ? e.message : e).slice(0, 300),
          stack: String(e && e.stack ? e.stack : "").slice(0, 500),
        };
        jsErrorLog.push(rec);
        try { console.warn("[MAPBOX-DIAG] safe() swallowed:", label, rec.message); } catch (_) { /* noop */ }
        return undefined;
      }
    };

    const stripToken = (url) => {
      if (typeof url !== "string") return String(url == null ? "" : url);
      return url.replace(/([?&])access_token=[^&]+/g, "$1access_token=REDACTED");
    };
    const classify = (url) => {
      const s = String(url == null ? "" : url);
      if (s.indexOf("/styles/v1/") !== -1) return "style";
      if (s.indexOf("/fonts/v1/") !== -1) return "glyph";
      if (s.indexOf("/sprites/") !== -1 || s.indexOf("/sprite@") !== -1 || s.indexOf("/sprite.") !== -1) return "sprite";
      if (s.indexOf("/tiles/") !== -1 || s.indexOf(".mvt") !== -1 || s.indexOf(".pbf") !== -1) return "tile";
      return "other";
    };
    const emit = (stage, extra) => safe("emit:" + stage, () => {
      const elapsed = Date.now() - t0;
      lastStage = stage;
      const entry = { t: elapsed, stage };
      if (extra && typeof extra === "object") {
        // shallow-copy extra WITHOUT spread (Terser occasionally miscompiles
        // spread over unknown objects on old iOS Safari targets)
        const keys = Object.keys(extra);
        for (let i = 0; i < keys.length; i++) entry[keys[i]] = extra[keys[i]];
      }
      timeline.push(entry);
      try { console.info("[MAPBOX-DIAG] +" + elapsed + "ms " + stage, extra || ""); } catch (_) { /* noop */ }
      setDiag(function (d) {
        // R27.7 — compute signature-same booleans on each emit so the
        // overlay reflects the live picture, not a stale first-error snapshot.
        const mbSigKeys = Object.keys(mbErrorSigs);
        const jsSigKeys = Object.keys(jsErrorSigs);
        return {
          stage: stage,
          elapsed: elapsed,
          events: timeline.length,
          reqs: {
            style: reqCounts.style, tile: reqCounts.tile, glyph: reqCounts.glyph,
            sprite: reqCounts.sprite, other: reqCounts.other,
          },
          styleLoaded: styleLoadedFlag,
          mapLoaded: mapLoadedFlag,
          firstRender: firstRenderFlag,
          idle: idleFlag,
          webglReady: webglReadyFlag,
          styleErrors: styleErrCount,
          tileErrors: tileErrCount,
          otherErrors: otherErrCount,
          jsErrors: jsErrCount,
          lastErr: lastErrMsg,
          mbErrText: lastMapboxError ? String(lastMapboxError.message || "").slice(0, 140) : null,
          mbErrSame: mbSigKeys.length <= 1,
          mbErrDistinct: mbSigKeys.length,
          jsErrText: lastJSError ? String(lastJSError.message || "").slice(0, 140) : null,
          jsErrSame: jsSigKeys.length <= 1,
          jsErrDistinct: jsSigKeys.length,
          eventCounts: {
            styledata: eventCounts.styledata,
            sourcedata: eventCounts.sourcedata,
            data: eventCounts.data,
            render: eventCounts.render,
            idle: eventCounts.idle,
          },
          w: containerRef.current ? containerRef.current.clientWidth  : d.w,
          h: containerRef.current ? containerRef.current.clientHeight : d.h,
        };
      });
    });

    // Expose live snapshot for post-mortem inspection from Safari Web
    // Inspector. Plain object, no getters — safe under all minifiers.
    safe("expose-global", function () {
      if (!window.__mapboxDiag__) window.__mapboxDiag__ = { instances: [] };
      const currentRef = {
        t0: t0,
        timeline: timeline,      // shared array reference — mutation-visible
        reqCounts: reqCounts,    // shared object reference
        errorLog: errorLog,
        jsErrorLog: jsErrorLog,
        eventCounts: eventCounts,     // R27.7 — per-lifecycle-event counts
        mbErrorSigs: mbErrorSigs,     // R27.7 — signature → { count, first, last }
        jsErrorSigs: jsErrorSigs,
        // R27.7 — plain accessor functions (no object-literal getters).
        // From Safari Web Inspector: `window.__mapboxDiag__.current.getLastMapboxError()`
        // returns the rich last error record with all fields.
        getLastMapboxError: function () { return lastMapboxError; },
        getLastJSError:     function () { return lastJSError; },
        snapshot: function () {
          return {
            stage: lastStage, elapsed: Date.now() - t0, events: timeline.length,
            reqCounts: {
              style: reqCounts.style, tile: reqCounts.tile, glyph: reqCounts.glyph,
              sprite: reqCounts.sprite, other: reqCounts.other,
            },
            eventCounts: {
              styledata: eventCounts.styledata, sourcedata: eventCounts.sourcedata,
              data: eventCounts.data, render: eventCounts.render, idle: eventCounts.idle,
            },
            styleLoaded: styleLoadedFlag, mapLoaded: mapLoadedFlag,
            firstRender: firstRenderFlag, idle: idleFlag, webglReady: webglReadyFlag,
            styleErrors: styleErrCount, tileErrors: tileErrCount,
            otherErrors: otherErrCount, jsErrors: jsErrCount,
            lastErr: lastErrMsg,
            lastMapboxError: lastMapboxError,
            lastJSError: lastJSError,
            mbErrorSigs: mbErrorSigs,
            jsErrorSigs: jsErrorSigs,
          };
        },
      };
      window.__mapboxDiag__.current = currentRef;
      window.__mapboxDiag__.instances.push(currentRef);
    });

    // ── Global window-level error listeners. Fire independently of Mapbox
    //    so we know whether "Can't find variable: X" is coming from Mapbox
    //    or from unrelated page JS. Isolated from application execution.
    const onWindowError = function (ev) {
      safe("window.onerror", function () {
        jsErrCount += 1;
        const rec = {
          timestamp: Date.now() - t0,
          origin: "window.error",
          message: String(ev && ev.message ? ev.message : ev).slice(0, 300),
          source: String(ev && ev.filename ? ev.filename : ""),
          line: ev && typeof ev.lineno === "number" ? ev.lineno : null,
          column: ev && typeof ev.colno === "number" ? ev.colno : null,
          stack: ev && ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 600) : null,
          errType: ev && ev.error && ev.error.name ? ev.error.name : null,
          precedingStage: lastStage,
          precedingReqUrl: lastReqUrl,
        };
        jsErrorLog.push(rec);
        lastJSError = rec;
        // Signature bucket — treat identical `message` strings as same error.
        const sigKey = rec.message || "(empty)";
        if (!jsErrorSigs[sigKey]) jsErrorSigs[sigKey] = { count: 0, firstT: rec.timestamp, lastT: rec.timestamp };
        jsErrorSigs[sigKey].count += 1;
        jsErrorSigs[sigKey].lastT = rec.timestamp;
        lastErrMsg = "JS:" + rec.message;
        try { console.warn("[MAPBOX-DIAG] window.onerror", rec); } catch (_) { /* noop */ }
        emit("js.error", { message: rec.message, source: rec.source, line: rec.line, column: rec.column });
      });
    };
    const onUnhandledRejection = function (ev) {
      safe("window.onunhandledrejection", function () {
        jsErrCount += 1;
        const reason = ev && ev.reason;
        const rec = {
          timestamp: Date.now() - t0,
          origin: "unhandledrejection",
          message: String(reason && reason.message ? reason.message : reason).slice(0, 300),
          source: null,
          line: null,
          column: null,
          stack: reason && reason.stack ? String(reason.stack).slice(0, 600) : null,
          errType: reason && reason.name ? reason.name : null,
          precedingStage: lastStage,
          precedingReqUrl: lastReqUrl,
        };
        jsErrorLog.push(rec);
        lastJSError = rec;
        const sigKey = rec.message || "(empty)";
        if (!jsErrorSigs[sigKey]) jsErrorSigs[sigKey] = { count: 0, firstT: rec.timestamp, lastT: rec.timestamp };
        jsErrorSigs[sigKey].count += 1;
        jsErrorSigs[sigKey].lastT = rec.timestamp;
        lastErrMsg = "REJ:" + rec.message;
        try { console.warn("[MAPBOX-DIAG] unhandledrejection", rec); } catch (_) { /* noop */ }
        emit("js.rejection", { message: rec.message });
      });
    };
    safe("register-globals", function () {
      window.addEventListener("error", onWindowError, { capture: true });
      window.addEventListener("unhandledrejection", onUnhandledRejection, { capture: true });
    });

    // R27.2 — WebGL capability probe.
    let supported = null;
    safe("mapboxgl.supported", function () {
      if (typeof mapboxgl.supported === "function") {
        supported = mapboxgl.supported({ failIfMajorPerformanceCaveat: false });
      }
    });

    // Detailed WebGL capability probe — fills gaps that mapboxgl.supported() hides.
    const glProbe = safe("gl-probe", function () {
      const c = document.createElement("canvas");
      const gl2 = c.getContext("webgl2");
      const gl = gl2 || c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return { hasGl: false };
      const dbgInfo = gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
      const out = {
        hasGl: true,
        webgl2: !!gl2,
        vendor: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      };
      webglReadyFlag = true;
      return out;
    }) || { hasGl: false };

    const containerEl = containerRef.current;
    const containerSnapshot = function () {
      return safe("container-snapshot", function () {
        if (!containerEl) return { present: false };
        const rect = containerEl.getBoundingClientRect();
        const cs = window.getComputedStyle ? window.getComputedStyle(containerEl) : {};
        return {
          present: true,
          connected: !!containerEl.isConnected,
          offsetParent: !!containerEl.offsetParent,
          clientW: containerEl.clientWidth,
          clientH: containerEl.clientHeight,
          rectW: Math.round(rect.width),
          rectH: Math.round(rect.height),
          display: cs.display || "",
          visibility: cs.visibility || "",
          position: cs.position || "",
        };
      }) || { present: false };
    };

    emit("init.start", {
      ua: (navigator.userAgent || "").slice(0, 140),
      mapboxVersion: mapboxgl.version || "unknown",
      supported: supported,
      dpr: window.devicePixelRatio,
      viewport: window.innerWidth + "x" + window.innerHeight,
      container: containerSnapshot(),
      gl: glProbe,
    });

    if (supported === false) {
      const err = new Error("Mapbox GL unsupported on this browser (WebGL unavailable)");
      emit("init.unsupported", { reason: "mapboxgl.supported=false" });
      setInitError(err);
      onError && onError(err);
      // Best-effort cleanup of window listeners (early exit path).
      safe("cleanup-globals-early", function () {
        window.removeEventListener("error", onWindowError, { capture: true });
        window.removeEventListener("unhandledrejection", onUnhandledRejection, { capture: true });
      });
      return undefined;
    }
    if (!containerEl) {
      emit("init.no-container");
      safe("cleanup-globals-early2", function () {
        window.removeEventListener("error", onWindowError, { capture: true });
        window.removeEventListener("unhandledrejection", onUnhandledRejection, { capture: true });
      });
      return undefined;
    }

    let map;
    const styleUrl = "mapbox://styles/mapbox/streets-v12";
    try {
      map = new mapboxgl.Map({
        container: containerEl,
        style: styleUrl,
        center: center,
        zoom: zoom,
        attributionControl: false,
        preserveDrawingBuffer: false,
        antialias: false,
        // R27.5 — transformRequest lets us observe every outbound URL.
        // Wrapped in safe() so if classification throws, Mapbox still
        // receives a valid { url } request object and continues.
        transformRequest: function (url, resourceType) {
          safe("transformRequest", function () {
            const kind = classify(url);
            reqCounts[kind] = (reqCounts[kind] || 0) + 1;
            lastReqUrl = stripToken(url);   // R27.7 — correlated with next error
            emit("req." + kind, { resourceType: resourceType, url: lastReqUrl });
          });
          return { url: url };
        },
      });
      emit("map.constructed", { style: styleUrl });
    } catch (e) {
      emit("map.construct.throw", { message: String(e && e.message ? e.message : e) });
      setInitError(e);
      onError && onError(e);
      safe("cleanup-globals-throw", function () {
        window.removeEventListener("error", onWindowError, { capture: true });
        window.removeEventListener("unhandledrejection", onUnhandledRejection, { capture: true });
      });
      return undefined;
    }

    safe("add-controls", function () {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    });

    // R27.3 — Load-timeout failsafe: 8-second budget for `load` to fire.
    const loadTimeout = setTimeout(function () {
      if (!hasLoaded.current) {
        const err = new Error("Mapbox failed to load within 8s — likely iOS Safari WebGL init hang");
        emit("timeout.8s", {
          stage: lastStage,
          reqCounts: {
            style: reqCounts.style, tile: reqCounts.tile, glyph: reqCounts.glyph,
            sprite: reqCounts.sprite, other: reqCounts.other,
          },
          styleErrors: styleErrCount, tileErrors: tileErrCount,
          otherErrors: otherErrCount, jsErrors: jsErrCount,
          lastErr: lastErrMsg,
          container: containerSnapshot(),
        });
        try {
          console.warn("[MAPBOX-DIAG] 8s load timeout — falling back to Google. Stage:", lastStage,
            "styleLoaded:", styleLoadedFlag, "firstRender:", firstRenderFlag,
            "jsErrors:", jsErrCount, "mapErrors:", (styleErrCount + tileErrCount + otherErrCount));
        } catch (_) { /* noop */ }
        setInitError(err);
        onError && onError(err);
      }
    }, 8000);

    // Layout checkpoints at 100/500/1000/3000/7000 ms.
    const layoutChecks = [100, 500, 1000, 3000, 7000].map(function (ms) {
      return setTimeout(function () {
        emit("layout.t" + ms, { container: containerSnapshot() });
      }, ms);
    });

    // 1-second heartbeat — dense timeline sampling of full status.
    const heartbeat = setInterval(function () {
      if (hasLoaded.current) return;
      emit("heartbeat", {
        stage: lastStage,
        container: containerSnapshot(),
      });
    }, 1000);

    // R27.4 — Defensive resize after 250ms.
    const resizeTimeout = setTimeout(function () {
      safe("map.resize", function () { map.resize(); emit("map.resize.forced"); });
    }, 250);

    // ── Full Mapbox lifecycle event surface. Every handler goes through
    //    safe() so a diagnostic throw can NEVER prevent Mapbox from
    //    receiving its own event, or the load/error/fallback path.
    map.on("load", function () {
      clearTimeout(loadTimeout);
      hasLoaded.current = true;
      mapLoadedFlag = true;
      setReady(true);
      emit("map.load", { container: containerSnapshot() });
      try { console.info("[MAPBOX-DIAG] ✓ map.load fired — Mapbox is live"); } catch (_) { /* noop */ }
      onLoad && onLoad();
    });
    map.on("style.load", function () {
      styleLoadedFlag = true;
      emit("map.style.load");
    });
    map.on("styledata",   function (e) {
      eventCounts.styledata += 1;
      // Only emit the first N to avoid flooding; owner still sees the count.
      if (eventCounts.styledata <= 5 || eventCounts.styledata % 20 === 0) {
        emit("map.styledata", { n: eventCounts.styledata, dataType: e && e.dataType });
      }
    });
    map.on("sourcedata",  function (e) {
      eventCounts.sourcedata += 1;
      if (eventCounts.sourcedata <= 5 || eventCounts.sourcedata % 20 === 0) {
        emit("map.sourcedata", {
          n: eventCounts.sourcedata,
          sourceId: e && e.sourceId,
          isSourceLoaded: !!(e && e.isSourceLoaded),
          sourceDataType: e && e.sourceDataType,
        });
      }
    });
    map.on("dataloading", function (e) { emit("map.dataloading", { dataType: e && e.dataType }); });
    map.on("data",        function (e) {
      eventCounts.data += 1;
      if (eventCounts.data <= 5 || eventCounts.data % 20 === 0) {
        emit("map.data", { n: eventCounts.data, dataType: e && e.dataType });
      }
    });
    map.on("idle",        function () { idleFlag = true; eventCounts.idle += 1; emit("map.idle", { n: eventCounts.idle }); });
    map.on("render", function () {
      eventCounts.render += 1;
      if (eventCounts.render === 1)  { firstRenderFlag = true; emit("map.render.first"); }
      if (eventCounts.render === 10) { emit("map.render.10"); }
      if (eventCounts.render === 60) { emit("map.render.60"); }
      if (eventCounts.render === 300) { emit("map.render.300"); }
    });
    map.on("webglcontextlost",     function () { emit("map.webglcontextlost"); });
    map.on("webglcontextrestored", function () { emit("map.webglcontextrestored"); });

    // R27.6 → R27.7 — Rich per-error capture.
    // Now records precedingStage + precedingReqUrl, and safely snapshots
    // style.layers / style.sources counts on each error so we can tell
    // whether the error correlates with a specific layer or source id.
    map.on("error", function (ev) {
      safe("map.on.error", function () {
        const evObj = ev || {};
        const err = evObj.error || evObj || new Error("mapbox error");
        const urlForClass = evObj.url || (err && err.url) || evObj.sourceId || "";
        const errKind = classify(urlForClass);
        if (errKind === "style") styleErrCount += 1;
        else if (errKind === "tile" || errKind === "glyph" || errKind === "sprite") tileErrCount += 1;
        else otherErrCount += 1;

        // Safe snapshot of style state (Task 8) — counts only, no dump.
        let styleState = null;
        try {
          const s = map.getStyle && map.getStyle();
          if (s) {
            styleState = {
              layers: s.layers ? s.layers.length : 0,
              sources: s.sources ? Object.keys(s.sources).length : 0,
            };
          }
        } catch (_) { styleState = { error: "getStyle-threw" }; }

        const message = String(err && err.message ? err.message : err).slice(0, 300);
        const record = {
          timestamp: Date.now() - t0,
          message: message,
          nestedMessage: err && err.error && err.error.message
            ? String(err.error.message).slice(0, 300) : null,
          status: err && (err.status || err.statusCode)
            ? (err.status || err.statusCode) : null,
          source: evObj.source ? String(evObj.source).slice(0, 100) : null,
          sourceId: evObj.sourceId ? String(evObj.sourceId).slice(0, 100) : null,
          tile: evObj.tile ? JSON.stringify(evObj.tile).slice(0, 200) : null,
          url: stripToken(evObj.url || (err && err.url) || ""),
          errType: err && err.name ? err.name : null,
          errKind: errKind,
          precedingStage: lastStage,          // R27.7 — timeline correlation
          precedingReqUrl: lastReqUrl,         // R27.7 — last URL requested
          styleState: styleState,             // R27.7 — layer / source counts
          stack: err && err.stack ? String(err.stack).slice(0, 600) : null,
        };
        errorLog.push(record);
        lastMapboxError = record;
        // Signature bucket — identical `message` → same-error.
        const sigKey = message || "(empty)";
        if (!mbErrorSigs[sigKey]) mbErrorSigs[sigKey] = { count: 0, firstT: record.timestamp, lastT: record.timestamp };
        mbErrorSigs[sigKey].count += 1;
        mbErrorSigs[sigKey].lastT = record.timestamp;
        lastErrMsg = message;

        const kind = classifyMapboxError(err, { hasLoaded: hasLoaded.current });
        emit("map.error." + kind, record);
        try { console.warn("[MAPBOX-DIAG] map.error " + kind, record); } catch (_) { /* noop */ }

        if (kind === "fatal") {
          setInitError(err);
          onError && onError(err);
        }
      });
    });

    mapRef.current = map;
    return function () {
      clearTimeout(loadTimeout);
      clearTimeout(resizeTimeout);
      clearInterval(heartbeat);
      layoutChecks.forEach(clearTimeout);
      safe("cleanup-globals", function () {
        window.removeEventListener("error", onWindowError, { capture: true });
        window.removeEventListener("unhandledrejection", onUnhandledRejection, { capture: true });
      });
      if (sweepAnimRef.current) {
        cancelAnimationFrame(sweepAnimRef.current);
        sweepAnimRef.current = null;
      }
      safe("map.remove", function () { map.remove(); });
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

      {/* R27.7 — Diagnostic overlay with actual error text + event counts.
          When production iPhone hangs, screenshot shows exactly what
          error(s) occurred, whether they're the same or distinct, and
          which lifecycle events kept firing after first render. */}
      {!ready && (
        <div
          data-testid={`${testId}-diag`}
          className="pointer-events-none absolute top-2 left-2 z-20 max-w-[92%] rounded-md bg-black/85 px-2 py-1 font-mono text-[10px] leading-tight text-white shadow"
        >
          <div><b>MB</b> v{mapboxgl.version || "?"} · dpr {typeof window !== "undefined" ? window.devicePixelRatio : "?"}</div>
          <div>stage: <b>{diag.stage}</b> · {diag.elapsed}ms · ev {diag.events}</div>
          <div>size: {diag.w}×{diag.h}</div>
          <div>
            gl{diag.webglReady ? "✓" : "✗"}·
            style{diag.styleLoaded ? "✓" : "✗"}·
            load{diag.mapLoaded ? "✓" : "✗"}·
            R{diag.firstRender ? "✓" : "✗"}·
            idle{diag.idle ? "✓" : "✗"}
          </div>
          <div>
            ec: sd{diag.eventCounts.styledata} src{diag.eventCounts.sourcedata}
            {" "}d{diag.eventCounts.data} r{diag.eventCounts.render} i{diag.eventCounts.idle}
          </div>
          <div>req: s{diag.reqs.style} t{diag.reqs.tile} g{diag.reqs.glyph} sp{diag.reqs.sprite} o{diag.reqs.other}</div>
          <div>
            errs: st{diag.styleErrors} ti{diag.tileErrors} ot{diag.otherErrors} js{diag.jsErrors}
          </div>
          {diag.mbErrText ? (
            <div className="text-amber-300">
              MBERR{diag.mbErrDistinct > 1 ? ` (${diag.mbErrDistinct} distinct)` : (diag.otherErrors > 1 ? ` (same×${diag.otherErrors + diag.styleErrors + diag.tileErrors})` : "")}: {diag.mbErrText}
            </div>
          ) : null}
          {diag.jsErrText ? (
            <div className="text-red-300">
              JSERR{diag.jsErrDistinct > 1 ? ` (${diag.jsErrDistinct} distinct)` : (diag.jsErrors > 1 ? ` (same×${diag.jsErrors})` : "")}: {diag.jsErrText}
            </div>
          ) : null}
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
