/**
 * AcceptanceInfo — high-visibility summary of "what the driver needs to
 * know BEFORE tapping Accept" (or that the customer / admin needs when
 * looking at any booking).
 *
 * Renders labelled rows for:
 *   • Suitable Vehicle (recommended_vehicle / vehicle_label)
 *   • Transport Item (transport_category) + Description (transport_description)
 *     — shown for standard + ASAP transport
 *   • Recovery Vehicle Required (recommended_vehicle for recovery jobs)
 *     + Vehicle to Recover (vehicle_details.make/model/reg)
 *     + Fault (vehicle_details.condition / fault) — shown for recovery jobs
 *
 * Round 7 fix — replaces the tiny chip pattern in JobExtras where these
 * critical fields were being missed. This is intentionally prominent —
 * the driver should never have to guess.
 */
import React from "react";
import { Truck, Package, Car, AlertCircle, Info } from "lucide-react";

function humaniseCategory(raw) {
  if (!raw) return "";
  const s = String(raw).replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ label, value, testId, Icon }) {
  return (
    <div className="flex items-start gap-3" data-testid={testId}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2]">
        <Icon className="h-4 w-4 text-[#D62828]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">
          {label}
        </p>
        <p className="mt-0.5 break-words text-[14px] font-semibold text-[#111111]">
          {value}
        </p>
      </div>
    </div>
  );
}

export function AcceptanceInfo({ job, dense = false, testIdPrefix = "acceptance" }) {
  if (!job || typeof job !== "object") return null;

  const isRecovery = (
    (job.service_type || "").toLowerCase() === "breakdown_recovery"
    || (job.category || "").toLowerCase().includes("recovery")
    || (job.category || "").toLowerCase().includes("breakdown")
  );
  const vehicleLabel = job.recommended_vehicle || job.vehicle_label;
  const v = job.vehicle_details || {};
  const transportItem = job.transport_category
    ? humaniseCategory(job.transport_category)
    : null;
  const description = (job.transport_description || "").trim();
  const recoveryVehicleName = [v.make, v.model].filter(Boolean).join(" ").trim();
  const fault = ((v.condition && v.condition !== "unknown")
    ? String(v.condition).replace(/_/g, " ")
    : "");
  const registration = v.registration || "";

  // Nothing to show? bail — the caller keeps the parent layout clean.
  const hasAny = vehicleLabel || transportItem || description
    || recoveryVehicleName || fault || registration;
  if (!hasAny) return null;

  const wrapperCls = dense
    ? "space-y-2 rounded-[10px] bg-[#F9FAFB] p-3"
    : "space-y-3 rounded-[12px] border border-[#E5E7EB] bg-white p-4";

  return (
    <section
      className={wrapperCls}
      data-testid={`${testIdPrefix}-info`}
      aria-label="Acceptance information"
    >
      {!dense && (
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">
          <Info className="h-3.5 w-3.5 text-[#6B7280]" />
          Before you accept
        </div>
      )}

      {vehicleLabel ? (
        <Row
          Icon={Truck}
          label={isRecovery ? "Recovery Vehicle Required" : "Suitable Vehicle"}
          value={vehicleLabel}
          testId={`${testIdPrefix}-vehicle`}
        />
      ) : null}

      {!isRecovery && transportItem ? (
        <Row
          Icon={Package}
          label="Transport Item"
          value={transportItem}
          testId={`${testIdPrefix}-transport-item`}
        />
      ) : null}

      {!isRecovery && description ? (
        <Row
          Icon={Info}
          label="Description"
          value={description}
          testId={`${testIdPrefix}-description`}
        />
      ) : null}

      {isRecovery && (recoveryVehicleName || registration) ? (
        <Row
          Icon={Car}
          label="Vehicle to Recover"
          value={
            [recoveryVehicleName, registration ? `· ${registration}` : ""]
              .filter(Boolean)
              .join(" ")
          }
          testId={`${testIdPrefix}-recovery-vehicle`}
        />
      ) : null}

      {isRecovery && fault ? (
        <Row
          Icon={AlertCircle}
          label="Fault"
          value={fault.charAt(0).toUpperCase() + fault.slice(1)}
          testId={`${testIdPrefix}-fault`}
        />
      ) : null}
    </section>
  );
}

export default AcceptanceInfo;
