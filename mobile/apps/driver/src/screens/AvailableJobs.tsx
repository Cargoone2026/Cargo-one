/**
 * Shared "Coming soon" shell used by every Driver tab except Home.
 * Keeps the standard CargoOne page shell + a polished EmptyState.
 */
import React from "react";
import {
  Page, PageHeader, Section, EmptyState, PrimaryButton,
  type Glyph as _Glyph,
} from "../ui";
import { useAuth } from "../AuthContext";

type GlyphName = React.ComponentProps<typeof _Glyph>["name"];

export function ComingSoon({
  title, body, glyph = "box", testID, showLogout,
}: {
  title: string;
  body: string;
  glyph?: GlyphName;
  testID?: string;
  showLogout?: boolean;
}) {
  const { logout } = useAuth();
  return (
    <Page testID={testID}>
      <PageHeader title={title} />
      <Section>
        <EmptyState
          glyph={glyph}
          title="Coming soon"
          body={body}
        />
        {showLogout ? (
          <PrimaryButton
            title="Log out"
            onPress={() => logout()}
            testID="driver-logout-button"
          />
        ) : null}
      </Section>
    </Page>
  );
}

export default function AvailableJobsScreen() {
  return (
    <ComingSoon
      testID="driver-available-jobs"
      title="Available"
      glyph="compass"
      body="Marketplace browsing and bidding ship in the next phase. You'll see nearby jobs, place bids, and claim ASAP offers here."
    />
  );
}
