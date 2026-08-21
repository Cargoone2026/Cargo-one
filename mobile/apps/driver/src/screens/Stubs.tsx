/**
 * Driver secondary screens — Cargo One shell parity.
 * Each stub renders inside the shared AppShell so the sidebar
 * remains present at every route. Detailed data screens (job
 * detail, active booking, earnings analytics, fleet management)
 * remain in follow-up commits.
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Compass, Package, PoundSterling, Truck, User as UserIcon } from "lucide-react-native";
import { EmptyState, Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";
import { colors, radius, typography } from "../theme";

function Wrap({ title, subtitle, Icon, body }: { title: string; subtitle?: string; Icon: any; body: string }) {
  const { openDrawer, showMenu } = useShellMenu();
  return (
    <Page>
      <ScrollView>
        <PageHeader large title={title} subtitle={subtitle} showMenu={showMenu} onMenuPress={openDrawer} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <EmptyState Icon={Icon} title={title} body={body} />
        </View>
      </ScrollView>
    </Page>
  );
}

export function MyJobsScreen() {
  return <Wrap title="My Jobs" subtitle="Every job you're on today." Icon={Package} body="Active and upcoming bookings show up here." />;
}
export function EarningsHubScreen() {
  return <Wrap title="Earnings" subtitle="Payouts, statements and history." Icon={PoundSterling} body="Weekly and monthly summaries land here." />;
}
export function FleetScreen() {
  return <Wrap title="Fleet" subtitle="Vehicles you can use for jobs." Icon={Truck} body="Add or edit vehicles from here." />;
}
export function DriverProfileScreen() {
  return <Wrap title="Profile" subtitle="Your public Cargo One driver profile." Icon={UserIcon} body="Photo, ratings and reviews shown to customers." />;
}
export function AvailableJobsHubScreen() {
  return <Wrap title="Available" subtitle="Jobs currently open for bidding or acceptance." Icon={Compass} body="Nearby marketplace jobs will show here." />;
}
