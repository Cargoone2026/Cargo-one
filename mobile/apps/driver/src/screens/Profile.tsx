import React from "react";
import { ComingSoon } from "../components/ComingSoon";

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
