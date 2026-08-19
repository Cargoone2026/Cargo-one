import React from "react";
import { MapPin, Flag, Clock, Route as RouteIcon, CheckCircle2 } from "lucide-react";
import { CargoNavigateButton } from "./CargoNavigate";

/**
 * R68 — Destination card for the active-job map experience.
 *
 * Presents pickup / destination / ETA / distance and the primary Navigate
 * CTA. Renders one of four phases based on the job status:
 *
 *   phase="to_pickup"   — driver is heading to the pickup point
 *   phase="to_dropoff"  — driver is heading to the dropoff point
 *   phase="arrived"     — arrived at the current target, waiting for the
 *                          next status action to be triggered above
 *   phase="completed"   — job complete
 *
 * Everything is presentational. Business rules (status progression, contact
 * privacy, POD, refund) are handled by the parent screen.
 */
export function DestinationCard({
  phase = "to_pickup",
  pickup,           // { lat, lng, town?, address? }
  dropoff,          // { lat, lng, town?, address? }
  etaMinutes,       // number | null
  distanceMiles,    // number | null
  compact = false,
  showNavigate = true,  // R68 — customer maps suppress this
  children,         // optional slot BELOW the header, ABOVE the Navigate button
  onNavigated,
  "data-testid": testId = "destination-card",
}) {
  const isPickup = phase === "to_pickup";
  const isDropoff = phase === "to_dropoff";
  const isArrived = phase === "arrived";
  const isCompleted = phase === "completed";

  const target = isDropoff ? dropoff : pickup;
  const primaryLabel = isDropoff ? "Destination" : "Pickup";
  const primaryIconColor = isDropoff ? "#D62828" : "#16A34A";
  const primaryIcon = isDropoff ? Flag : MapPin;
  const primaryText =
    (target?.address || target?.town || "").trim() ||
    (isDropoff ? "Destination address" : "Pickup address");

  return (
    <div
      className={`w-full rounded-t-[20px] border border-[#E5E7EB] bg-white shadow-[0_-8px_24px_rgba(17,17,17,0.06)] ${compact ? "p-4" : "p-5"}`}
      data-testid={testId}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${primaryIconColor}15` }}
          aria-hidden
        >
          {React.createElement(primaryIcon, {
            className: "h-5 w-5",
            style: { color: primaryIconColor },
          })}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]"
            data-testid={`${testId}-phase-label`}
          >
            {isCompleted
              ? "Job completed"
              : isArrived
                ? `Arrived at ${isDropoff ? "dropoff" : "pickup"}`
                : `Heading to ${primaryLabel.toLowerCase()}`}
          </p>
          <h2
            className="mt-0.5 truncate text-[20px] font-bold leading-tight tracking-[-0.25px] text-[#111111]"
            data-testid={`${testId}-title`}
          >
            {isCompleted ? "All done" : primaryText}
          </h2>
          {!isCompleted && !!(pickup?.town || dropoff?.town) && (
            <p
              className="mt-0.5 truncate text-[13px] text-[#6B7280]"
              data-testid={`${testId}-route-summary`}
            >
              {pickup?.town || "Pickup"}
              <span className="mx-1 text-[#D1D5DB]">→</span>
              {dropoff?.town || "Dropoff"}
            </p>
          )}
        </div>
      </div>

      {/* ETA + Distance pills */}
      {!isCompleted && (etaMinutes != null || distanceMiles != null) && (
        <div
          className="mt-4 grid grid-cols-2 gap-3"
          data-testid={`${testId}-stats`}
        >
          <StatPill
            Icon={Clock}
            iconColor="#D62828"
            label="ETA"
            value={etaMinutes != null ? fmtDur(etaMinutes) : "—"}
            testId={`${testId}-eta`}
          />
          <StatPill
            Icon={RouteIcon}
            iconColor="#FF6A00"
            label="Distance"
            value={distanceMiles != null ? `${distanceMiles.toFixed?.(1) ?? distanceMiles} mi` : "—"}
            testId={`${testId}-distance`}
          />
        </div>
      )}

      {/* Optional slot for status-progression / POD / contact buttons */}
      {children ? <div className="mt-4">{children}</div> : null}

      {/* Navigate CTA */}
      {!isCompleted && showNavigate && (
        <div className="mt-4">
          <CargoNavigateButton
            destination={target}
            label={isArrived ? `Reopen ${primaryLabel.toLowerCase()} in maps` : "Navigate"}
            onNavigated={onNavigated}
            data-testid={`${testId}-navigate`}
          />
        </div>
      )}

      {isCompleted && (
        <div
          className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#ECFDF5] px-3 py-2 text-[#065F46]"
          data-testid={`${testId}-completed-banner`}
        >
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-[13px] font-semibold">Delivered — thanks for shipping with Cargo One.</p>
        </div>
      )}
    </div>
  );
}

function StatPill({ Icon, iconColor, label, value, testId }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[12px] bg-[#F9FAFB] p-3"
      data-testid={testId}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: `${iconColor}15` }}
        aria-hidden
      >
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
          {label}
        </p>
        <p className="truncate text-[15px] font-bold text-[#111111]">{value}</p>
      </div>
    </div>
  );
}

function fmtDur(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default DestinationCard;
