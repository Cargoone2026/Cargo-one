import React from "react";
import { ComingSoon } from "./AvailableJobs";

export default function EarningsScreen() {
  return (
    <ComingSoon
      testID="driver-earnings"
      title="Earnings"
      glyph="coin"
      body="Detailed earnings breakdown by day, week and month plus payout history ships in a later phase. Today's totals are visible on Home."
    />
  );
}
