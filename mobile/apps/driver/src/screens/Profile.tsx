import React from "react";
import { ComingSoon } from "./AvailableJobs";

export default function ProfileScreen() {
  return (
    <ComingSoon
      testID="driver-profile"
      title="Profile"
      glyph="user"
      body="Account settings, passkeys, notification preferences and driver profile ship in a later phase."
      showLogout
    />
  );
}
