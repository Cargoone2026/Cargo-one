import React from "react";
import { STATUS_COLOR, STATUS_LABELS, colors } from "@/theme";

export function StatusPill({ status, testId }) {
  const c = STATUS_COLOR[status] || { bg: colors.bgSecondary, fg: colors.text };
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[12px] font-semibold tracking-wider"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.fg }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}
