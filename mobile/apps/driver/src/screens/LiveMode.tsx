import React from "react";
import { ComingSoon } from "./AvailableJobs";

export default function LiveModeScreen() {
  return (
    <ComingSoon
      testID="driver-live-mode"
      title="Live Mode"
      glyph="zap"
      body="Go-online, live heartbeat and ASAP offer acceptance ship in a later phase. Location permission is requested then — not now."
    />
  );
}
