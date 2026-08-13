import React, { useMemo, useState } from "react";
import { MapboxMap, styleForJob } from "./MapboxMap";
import { MapPin } from "lucide-react";

/**
 * DriverLiveMapMapbox — Mapbox-rendered driver live/available-jobs map.
 *
 * Prop contract preserved BYTE-FOR-BYTE from the Google implementation:
 *   lat, lng      — driver current location (dark dot)
 *   offers = []   — job pins (each has pickup_lat, pickup_lng, service_timing,
 *                   service_type, pricing_type, id/job_id)
 *   onOfferClick  — fired with the full job dict when a pin is tapped
 *   className     — pass-through to root container
 *   showSweep     — draws a pulsing orange radius circle around the driver
 *                   (dispatch heartbeat animation)
 */

const validPt = (p) =>
  p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  !(p.lat === 0 && p.lng === 0);


export function DriverLiveMapMapbox({
  lat,
  lng,
  offers = [],
  onOfferClick,
  className = "",
  showSweep = true,
  onFatalError = null,   // R27 — dispatcher hooks this for Google fallback
}) {
  const [mapError, setMapError] = useState(null);
  const point = { lat: Number(lat), lng: Number(lng) };
  const valid = validPt(point);

  React.useEffect(() => {
    if (mapError && onFatalError) onFatalError(mapError);
  }, [mapError, onFatalError]);

  const markers = useMemo(() => {
    const out = [];
    if (valid) {
      out.push({
        id: "driver-me",
        lng: point.lng, lat: point.lat,
        color: "#111111", label: "•", size: 26,
        testId: "driver-live-me",
      });
    }
    (offers || []).forEach((j) => {
      const p = { lat: Number(j.pickup_lat), lng: Number(j.pickup_lng) };
      if (!validPt(p)) return;
      const style = styleForJob(j);
      out.push({
        id: `job-${j.id || j.job_id}`,
        lng: p.lng, lat: p.lat,
        color: style.color,
        label: style.label,
        size: 34,
        testId: `driver-live-offer-${j.id || j.job_id}`,
        onClick: () => onOfferClick && onOfferClick(j),
      });
    });
    return out;
  }, [valid, point.lat, point.lng, offers, onOfferClick]);

  const sweep = (valid && showSweep)
    ? { lng: point.lng, lat: point.lat, color: "#EA580C" }
    : null;

  if (!valid && (!offers || offers.length === 0)) {
    return (
      <div
        className={`w-full h-full grid place-items-center rounded-2xl bg-neutral-50 border border-neutral-200 text-[13px] text-neutral-500 ${className}`}
        data-testid="driver-live-map-empty"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-neutral-400" />
          Waiting for your location…
        </div>
      </div>
    );
  }

  return (
    <MapboxMap
      markers={markers}
      sweep={sweep}
      fitBounds
      showRecenter
      className={`w-full h-full overflow-hidden rounded-2xl ${className}`}
      data-testid="driver-live-map"
      onError={setMapError}
    />
  );
}

export default DriverLiveMapMapbox;
