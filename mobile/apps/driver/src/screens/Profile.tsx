import React from "react";
import { ComingSoon } from "./AvailableJobs";

export default function ProfileScreen() {
  return (
    <ComingSoon
      testID="driver-profile"
      title="Profile"
      subtitle="Account settings, passkeys, notification preferences and driver profile arrive in a later phase."
      showLogout
    />
  );
}
