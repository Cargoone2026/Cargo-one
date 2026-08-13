/**
 * DriverLiveMap — single-driver live map with optional offer pins.
 *
 * Why a separate component from RouteMap?
 *   `RouteMap` only renders real Google tiles when BOTH `pickup` and
 *   `dropoff` are valid — Live Mode has only the driver's position and
 *   optionally N pending ASAP offers. This component fills that gap
 *   with a proper Google Maps view (or an animated fallback if the
 *   JS key is unavailable — never a lifeless grid).
 *
 * Rendered layers:
 *   • Real Google Maps view centred on the driver (zoom 14 by default).
 *   • Three pulsing radar rings + rotating sweep line around the driver
 *     marker (Uber/Lyft-style "searching" affordance).
 *   • One numbered price pin per pending offer, at each offer's pickup
 *     coords. Clicking a pin fires `onOfferClick(offer)` so the parent
 *     can scroll the matching offer card into view.
 *   • Auto-fits bounds to include driver + all offers when offers exist;
 *     otherwise stays zoomed on the driver.
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

/** Branded price pin — small SVG marker with the offer price. Recovery
 *  offers get an amber accent, transport gets neutral charcoal. */
function offerPinDataUrl(price, serviceType) {
  const isRecovery = serviceType === "breakdown_recovery";
  const fill = isRecovery ? "#D97706" : "#111111";
  const label = `£${Math.round(Number(price) || 0)}`;
  const width = Math.max(48, 14 + label.length * 7);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="44" viewBox="0 0 ${width} 44">` +
    `<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.25"/></filter></defs>` +
    `<g filter="url(#s)">` +
    // Pill body
    `<rect x="1" y="1" rx="14" ry="14" width="${width - 2}" height="28" fill="${fill}"/>` +
    // Downward pointer triangle
    `<path d="M${width / 2 - 6},28 L${width / 2},40 L${width / 2 + 6},28 Z" fill="${fill}"/>` +
    // Label
    `<text x="${width / 2}" y="20" text-anchor="middle" font-family="Arial, sans-serif" ` +
    `font-size="13" font-weight="700" fill="#ffffff">${label}</text>` +
    `</g></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, width };
}

/** Radar-ring overlay — pure CSS animation, positioned via absolute over
 *  the map container. Sits above the map div, non-interactive. */
function RadarPulse() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <span className="absolute h-6 w-6 rounded-full bg-emerald-500/25 driverlive-radar-ring" />
      <span className="absolute h-6 w-6 rounded-full bg-emerald-500/25 driverlive-radar-ring driverlive-radar-ring--delay-1" />
      <span className="absolute h-6 w-6 rounded-full bg-emerald-500/25 driverlive-radar-ring driverlive-radar-ring--delay-2" />
      <span className="relative h-4 w-4 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)] ring-2 ring-white" />
    </div>
  );
}

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

export function DriverLiveMapGoogle({
  lat,
  lng,
  offers = [],
  onOfferClick,
  className = "",
  showSweep = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const offerMarkersRef = useRef([]);       // [{ jobId, marker }]
  const [engine, setEngine] = useState("loading"); // loading | google | fallback

  const point = { lat: Number(lat), lng: Number(lng) };
  const valid = validPt(point);

  // Initial map bootstrap.
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
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
              { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
              { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
            ],
          });
        }
        setEngine("google");
      })
      .catch(() => { if (!cancelled) setEngine("fallback"); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  // Keep driver marker + centre in sync as coords update.
  useEffect(() => {
    if (engine !== "google" || !mapRef.current || !valid) return;
    const maps = window.google.maps;
    // Invisible driver marker (visual is the CSS radar-pulse overlay);
    // keeping a real marker enables map.fitBounds to include the driver
    // position when offers are also plotted.
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new maps.Marker({
        position: point,
        map: mapRef.current,
        opacity: 0, // hidden — the CSS overlay is the visible driver dot
        zIndex: 1000,
        clickable: false,
      });
    } else {
      driverMarkerRef.current.setPosition(point);
    }
    // Only re-centre if we don't have offers (they drive bounds instead).
    if (!offers || offers.length === 0) {
      mapRef.current.panTo(point);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, point.lat, point.lng]);

  // Reconcile offer pins whenever the offers array changes.
  useEffect(() => {
    if (engine !== "google" || !mapRef.current) return;
    const maps = window.google.maps;
    const map = mapRef.current;

    // Drop stale markers (offer no longer in list).
    const nextIds = new Set((offers || []).map((o) => o.job_id));
    offerMarkersRef.current = offerMarkersRef.current.filter(({ jobId, marker }) => {
      if (!nextIds.has(jobId)) { marker.setMap(null); return false; }
      return true;
    });

    // Upsert markers for current offers.
    (offers || []).forEach((o) => {
      const p = { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) };
      if (!validPt(p)) return;
      const existing = offerMarkersRef.current.find((x) => x.jobId === o.job_id);
      const { url, width } = offerPinDataUrl(o.accepted_price, o.service_type);
      const icon = {
        url,
        scaledSize: new maps.Size(width, 44),
        anchor: new maps.Point(width / 2, 40),
      };
      if (existing) {
        existing.marker.setPosition(p);
        existing.marker.setIcon(icon);
      } else {
        const marker = new maps.Marker({
          position: p,
          map,
          icon,
          zIndex: 500,
          title: `${o.pickup_town || "Pickup"} · ${o.distance_to_pickup_miles} mi away`,
        });
        marker.addListener("click", () => onOfferClick?.(o));
        offerMarkersRef.current.push({ jobId: o.job_id, marker });
      }
    });

    // Auto-fit bounds when we have offers; otherwise keep centred on driver.
    if (valid && (offers || []).length > 0) {
      const bounds = new maps.LatLngBounds();
      bounds.extend(point);
      (offers || []).forEach((o) => {
        const p = { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) };
        if (validPt(p)) bounds.extend(p);
      });
      map.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
      // Clamp zoom so a single nearby offer doesn't over-zoom.
      const listener = maps.event.addListenerOnce(map, "idle", () => {
        if (map.getZoom() > 15) map.setZoom(15);
      });
      return () => maps.event.removeListener(listener);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, JSON.stringify((offers || []).map((o) => [o.job_id, o.pickup_lat, o.pickup_lng, o.accepted_price, o.service_type]))]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      offerMarkersRef.current.forEach(({ marker }) => marker.setMap(null));
      offerMarkersRef.current = [];
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }
      mapRef.current = null;
    };
  }, []);

  const offerCount = (offers || []).filter((o) =>
    Number.isFinite(o?.pickup_lat) && Number.isFinite(o?.pickup_lng),
  ).length;

  return (
    <div
      className={`relative w-full overflow-hidden bg-neutral-100 ${className}`}
      data-testid="driver-live-map"
      data-engine={engine}
      data-offer-pins={offerCount}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {engine === "fallback" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-neutral-100">
          <div className="absolute inset-0 driverlive-radar-grid" aria-hidden="true" />
        </div>
      )}

      {/* Sweep only makes sense while the driver is still waiting (no
          offer pins yet). When pins arrive, replace it with a subtle
          pulse only, so the pins remain legible. */}
      {showSweep && valid && offerCount === 0 && <RadarSweep />}

      {valid && <RadarPulse />}

      <div className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600 backdrop-blur-sm shadow-sm">
        Live · you
      </div>
      {offerCount > 0 && (
        <div
          className="absolute top-2 right-2 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
          data-testid="driver-live-map-offer-count"
        >
          {offerCount} nearby offer{offerCount > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export default DriverLiveMapGoogle;
