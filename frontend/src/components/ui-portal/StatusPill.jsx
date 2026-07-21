import React from "react";
import { STATUS_COLOR, STATUS_LABELS } from "@/theme";

/**
 * StatusPill — small colored badge for booking / job status.
 * Palette + labels are shared with the Expo source (see theme.js).
 */
export function StatusPill({ status, testID }) {
  const c = STATUS_COLOR[status] || { bg: "#F4F4F4", fg: "#111111" };
  return (
    <span
      data-testid={testID}
      className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[12px] font-semibold tracking-[0.2px]"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: c.fg }}
      />
      {STATUS_LABELS[status] || status}
    </span>
  );
}
