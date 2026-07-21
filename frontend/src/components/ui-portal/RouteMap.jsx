import React, { useMemo } from "react";
import { MapPin, Truck } from "lucide-react";

/**
 * RouteMap — lightweight SVG preview of pickup → dropoff (+ live driver).
 *
 * We deliberately avoid loading Google Maps in the browser during
 * Stage 2A-ii so that no restricted or unrestricted key is exposed.
 * When the user attaches cargoone.co.uk and provides a restricted
 * production Google Maps key, this component can be replaced with a
 * real MapView without touching call sites (props stay the same).
 */
export function RouteMap({
  pickup,
  dropoff,
  driver = null,
  trail = null,
  height = 220,
  testID = "route-map",
}) {
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
    if (maxLat - minLat < 0.01) {
      minLat -= 0.005;
      maxLat += 0.005;
    }
    if (maxLng - minLng < 0.01) {
      minLng -= 0.005;
      maxLng += 0.005;
    }
    const spanLat = maxLat - minLat;
    const spanLng = maxLng - minLng;
    const pad = 30;
    const w = 600 - 2 * pad;
    const h = height - 2 * pad;
    return raw.map((p) => ({
      ...p,
      x: pad + ((p.lng - minLng) / spanLng) * w,
      y: pad + (1 - (p.lat - minLat) / spanLat) * h,
    }));
  }, [pickup, dropoff, driver, trail, height]);

  const pk = points.find((p) => p.k === "pickup");
  const dr = points.find((p) => p.k === "dropoff");
  const dv = points.find((p) => p.k === "driver");
  const trailPts = points.filter((p) => p.k.startsWith("trail-"));

  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-[#E5E7EB]"
      style={{ height }}
      data-testid={testID}
    >
      <svg viewBox={`0 0 600 ${height}`} className="h-full w-full">
        <defs>
          <pattern
            id="rmgrid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="#EEF0F3"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="600" height={height} fill="#F9FAFB" />
        <rect width="600" height={height} fill="url(#rmgrid)" />

        {pk && dr ? (
          <line
            x1={pk.x}
            y1={pk.y}
            x2={dr.x}
            y2={dr.y}
            stroke="#D62828"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
        ) : null}

        {trailPts.length > 1 ? (
          <polyline
            points={trailPts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#FF6A00"
            strokeWidth="2.5"
            opacity="0.85"
          />
        ) : null}

        {pk ? (
          <g transform={`translate(${pk.x - 12}, ${pk.y - 24})`}>
            <circle cx="12" cy="12" r="12" fill="#16A34A" />
            <text
              x="12"
              y="16"
              textAnchor="middle"
              fontSize="12"
              fontFamily="ui-sans-serif, system-ui"
              fontWeight="700"
              fill="#fff"
            >
              P
            </text>
          </g>
        ) : null}
        {dr ? (
          <g transform={`translate(${dr.x - 12}, ${dr.y - 24})`}>
            <circle cx="12" cy="12" r="12" fill="#D62828" />
            <text
              x="12"
              y="16"
              textAnchor="middle"
              fontSize="12"
              fontFamily="ui-sans-serif, system-ui"
              fontWeight="700"
              fill="#fff"
            >
              D
            </text>
          </g>
        ) : null}
        {dv ? (
          <g transform={`translate(${dv.x - 14}, ${dv.y - 14})`}>
            <circle
              cx="14"
              cy="14"
              r="14"
              fill="#111111"
              stroke="#fff"
              strokeWidth="2"
            />
            <text
              x="14"
              y="18"
              textAnchor="middle"
              fontSize="11"
              fontFamily="ui-sans-serif, system-ui"
              fontWeight="700"
              fill="#fff"
            >
              🚚
            </text>
          </g>
        ) : null}
      </svg>

      {/* Legend / labels */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-3 text-[11px] text-[#111111]">
        {pk?.label ? (
          <span className="rounded-full bg-white/90 px-2 py-0.5 shadow-sm">
            <MapPin className="mr-1 inline h-3 w-3 text-[#16A34A]" />
            {pk.label}
          </span>
        ) : null}
        {dr?.label ? (
          <span className="rounded-full bg-white/90 px-2 py-0.5 shadow-sm">
            <MapPin className="mr-1 inline h-3 w-3 text-[#D62828]" />
            {dr.label}
          </span>
        ) : null}
        {dv ? (
          <span className="rounded-full bg-white/90 px-2 py-0.5 shadow-sm">
            <Truck className="mr-1 inline h-3 w-3 text-[#111111]" />
            Driver
          </span>
        ) : null}
      </div>
    </div>
  );
}
