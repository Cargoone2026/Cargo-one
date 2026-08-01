/**
 * DriverLiveMap — a single-point live map for Driver Live Mode.
 *
 * Why a separate component from RouteMap?
 *   `RouteMap` only renders a real Google Maps view when BOTH `pickup` and
 *   `dropoff` are valid coordinates (its job is drawing a road-following
 *   polyline between two points). Live Mode has ONLY the driver's own
 *   position, so it was silently falling back to the static SVG grid —
 *   which reads as "dead" on production.
 *
 * What we render instead:
 *   • Real Google Maps view centred on the driver's coordinates, zoom 14
 *     (city block). Uses the same `loading=async` + `libraries=marker`
 *     loader posture as RouteMap (no duplicated script).
 *   • A pulsing radar-ring overlay around the driver marker (three
 *     concentric rings, staggered `animation-delay`) — mimics the Uber /
 *     Lyft "searching" affordance shown in the reference screenshots.
 *   • A subtle rotating sweep line for extra life while offers are pending.
 *   • Graceful SVG fallback (also animated) if the Google Maps JS key is
 *     missing or the loader fails — never falls back to a static grid.
 */
import React, { useEffect, useRef, useState } from "react";

const MAPS_JS_KEY = process.env.REACT_APP_GOOGLE_MAPS_JS_KEY || "";

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
    s.onerror = () => { _mapsPromise = null; reject(new Error("maps js script error")); };
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

const validPt = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  && !(p.lat === 0 && p.lng === 0);

/** Radar-ring overlay — pure CSS animation, positioned via absolute over
 *  the map container. Sits above the map div, non-interactive. */
function RadarPulse({ children, className = "" }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {/* Three concentric rings, staggered */}
      <span className="absolute h-6 w-6 rounded-full bg-emerald-500/25 driverlive-radar-ring" />
      <span className="absolute h-6 w-6 rounded-full bg-emerald-500/25 driverlive-radar-ring driverlive-radar-ring--delay-1" />
      <span className="absolute h-6 w-6 rounded-full bg-emerald-500/25 driverlive-radar-ring driverlive-radar-ring--delay-2" />
      {/* Core driver dot */}
      <span className="relative h-4 w-4 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)] ring-2 ring-white" />
      {children}
    </div>
  );
}

/** Rotating sweep line — draws a translucent wedge sweeping 360° around
 *  the driver marker, on top of the map. Optional; enabled only while
 *  the driver is actively searching for offers. */
function RadarSweep() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="h-40 w-40 rounded-full driverlive-radar-sweep" />
    </div>
  );
}

export function DriverLiveMap({ lat, lng, className = "", showSweep = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [engine, setEngine] = useState("loading"); // loading | google | fallback

  const point = { lat: Number(lat), lng: Number(lng) };
  const valid = validPt(point);

  useEffect(() => {
    if (!valid) return () => {};
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center: point,
            zoom: 14,
            disableDefaultUI: true,
            zoomControl: false,
            gestureHandling: "greedy",
            clickableIcons: false,
            styles: [
              // Slightly desaturated + light styling — keeps the driver
              // marker (bright emerald) as the clear focal point.
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
              { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
              { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
            ],
          });
        } else {
          mapRef.current.panTo(point);
        }
        setEngine("google");
      })
      .catch(() => { if (!cancelled) setEngine("fallback"); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, point.lat, point.lng]);

  // Panning updates without recreating the map.
  useEffect(() => {
    if (engine === "google" && mapRef.current && valid) {
      mapRef.current.panTo(point);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point.lat, point.lng, engine]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-neutral-100 ${className}`}
      data-testid="driver-live-map"
      data-engine={engine}
    >
      {/* Real map (Google) — hidden behind the overlays but visible through them. */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Fallback: an animated concentric-ring canvas (no static grid). */}
      {engine === "fallback" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-neutral-100">
          <div className="absolute inset-0 driverlive-radar-grid" aria-hidden="true" />
        </div>
      )}

      {/* Radar-sweep line — only while searching. */}
      {showSweep && valid && <RadarSweep />}

      {/* Pulsing driver dot — always centred. */}
      {valid && <RadarPulse />}

      {/* Corner attribution / status hint */}
      <div className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600 backdrop-blur-sm shadow-sm">
        Live · you
      </div>
    </div>
  );
}

export default DriverLiveMap;
