/**
 * Shared "Coming soon" shell for Driver screens that haven't shipped
 * yet. Uses the standard CargoOne page shell + a polished EmptyState.
 */
import React from "react";
import {
  Page, PageHeader, Section, EmptyState, PrimaryButton,
  type IconName,
} from "../ui";
import { useAuth } from "../AuthContext";

export function ComingSoon({
  title, body, glyph = "package", testID, showLogout,
}: {
  title: string;
  body: string;
  glyph?: IconName;
  testID?: string;
  showLogout?: boolean;
}) {
  const { logout } = useAuth();
  return (
    <Page testID={testID}>
      <PageHeader title={title} />
      <Section>
        <EmptyState glyph={glyph} title="Coming soon" body={body} />
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
