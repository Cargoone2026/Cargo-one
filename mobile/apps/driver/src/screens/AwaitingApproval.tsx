import React from "react";
import { useAuth } from "../AuthContext";
import { Body, CARGO, H1, PrimaryButton, Screen } from "../ui";

/**
 * Shown to registered but not-yet-approved drivers. Admin approves them
 * via the existing web portal. The `useAuth().refresh` re-fetches the
 * user record so the moment they're approved they can enter the app.
 */
export function AwaitingApprovalScreen() {
  const { logout, refresh } = useAuth();
  return (
    <Screen>
      <H1>Application in review</H1>
      <Body muted style={{ marginTop: 10 }}>
        Our team is checking your details. You'll get an email as soon as you're approved — then you can start accepting jobs.
      </Body>
      <PrimaryButton title="Check status" onPress={refresh} testID="approval-refresh" />
      <PrimaryButton title="Log out" variant="secondary" onPress={logout} testID="approval-logout" />
    </Screen>
  );
}
