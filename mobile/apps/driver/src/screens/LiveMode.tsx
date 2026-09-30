import React from "react";
import { ComingSoon } from "./AvailableJobs";

export default function LiveModeScreen() {
  return (
    <ComingSoon
      testID="driver-live-mode"
      title="Live Mode"
      subtitle="Location sharing and ASAP dispatch (go online, receive & accept live offers) arrive in a later phase. Location permissions will be requested at that point."
    />
  );
}
