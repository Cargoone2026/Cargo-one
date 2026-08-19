import React, { useCallback, useState } from "react";
import { LocateFixed } from "lucide-react";
import { AsapMapCanvas } from "./AsapMapCanvas";
import { DestinationCard } from "./DestinationCard";

/**
 * R68 — Active job map panel.
 *
 * Shared full-featured map + destination-card composition used by both
 * driver and customer active-booking screens. Presentation only —
 * business rules (status progression, contact release, POD, dispatch)
 * are handled by the calling screen through the `children` slot inside
 * the destination card.
 *
 * The panel is deliberately height-bounded (not full-screen) so it
 * plugs into existing detail screens without rewriting them. Callers
 * that want full-screen (driver Live Mode) continue to use
 * AsapMapCanvas + AsapBottomSheet directly.
 *
 * Props:
 *   phase           — "to_pickup" | "to_dropoff" | "arrived" | "completed"
 *   pickup          — { lat, lng, town?, address? }
 *   dropoff         — { lat, lng, town?, address? }
 *   driver          — { lat, lng } (optional — live driver marker)
 *   trail           — [{ lat, lng }] (optional — breadcrumb polyline)
 *   etaMinutes      — number | null
 *   distanceMiles   — number | null
 *   role            — "driver" | "customer" (controls Navigate button visibility)
 *   mapHeight       — CSS height for the map surface (default "clamp(280px, 55vh, 480px)")
 *   children        — extra rows rendered inside the destination card
 *                     above the Navigate button (status progression, POD…)
 *   onNavigated     — callback with the result of the navigation handoff
 */
export function ActiveJobMapPanel({
  phase = "to_pickup",
  pickup,
  dropoff,
  driver,
  trail,
  etaMinutes = null,
  distanceMiles = null,
  role = "driver",
  mapHeight = "clamp(280px, 55vh, 480px)",
  children,
  onNavigated,
  "data-testid": testId = "active-job-map-panel",
}) {
  const [recenterSignal, setRecenterSignal] = useState(0);
  const handleRecenter = useCallback(() => setRecenterSignal((v) => v + 1), []);

  const isCompleted = phase === "completed";

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-sm"
      data-testid={testId}
    >
      {/* Map surface */}
      <div
        className="relative w-full"
        style={{ height: mapHeight }}
        data-testid={`${testId}-map`}
      >
        <AsapMapCanvas
          mode="customer"
          pickup={pickup}
          dropoff={dropoff}
          driver={driver}
          trail={trail}
          showSweep={false}
          recenterSignal={recenterSignal}
          data-testid={`${testId}-canvas`}
        />

        {/* Floating recenter — R58 parity. Placed top-LEFT to avoid
            overlapping Mapbox's default NavigationControl zoom buttons
            in the top-right corner. 44px target for mobile. */}
        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Recenter map on the route"
          data-testid={`${testId}-recenter`}
          className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#111111] shadow-lg ring-1 ring-black/5 backdrop-blur hover:bg-white"
        >
          <LocateFixed className="h-5 w-5" />
        </button>

        {/* Top status pill — subtle, non-obstructive */}
        <div
          className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-14"
          aria-hidden
        >
          <span
            className="rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-[#111111] shadow-md ring-1 ring-black/5"
            data-testid={`${testId}-top-pill`}
          >
            {phaseLabel(phase, role)}
          </span>
        </div>
      </div>

      {/* Destination card */}
      <DestinationCard
        phase={phase}
        pickup={pickup}
        dropoff={dropoff}
        etaMinutes={etaMinutes}
        distanceMiles={distanceMiles}
        showNavigate={role === "driver"}
        onNavigated={onNavigated}
        data-testid={`${testId}-card`}
      >
        {/* Callers inject their own progression buttons here. Customers
            typically pass nothing (map is read-only). Drivers pass their
            status/POD/contact rows. */}
        {role === "driver" ? children : null}
      </DestinationCard>

      {/* On the customer side, the Navigate button is suppressed via
          `showNavigate={false}` on DestinationCard. Render a lightweight
          hint strip instead. */}
      {role === "customer" && !isCompleted && (
        <div className="border-t border-[#F3F4F6] px-5 py-3 text-[12px] text-[#6B7280]" data-testid={`${testId}-customer-hint`}>
          Live map updates automatically as your driver moves.
        </div>
      )}
    </div>
  );
}

function phaseLabel(phase, role) {
  if (phase === "completed") return "Job completed";
  if (phase === "arrived") return role === "driver" ? "Arrived on-scene" : "Driver on-scene";
  if (phase === "to_dropoff") return role === "driver" ? "On route to dropoff" : "Driver on route to you";
  return role === "driver" ? "On route to pickup" : "Driver on the way";
}

export default ActiveJobMapPanel;
