/**
 * AvailableJobsScreen — driver marketplace. Uses the shared Cargo One
 * primitives so this matches the customer app's design system exactly.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import * as Location from "expo-location";
import { DriverAPI, Job, sortByCreatedAtDesc } from "@cargoone/core";
import { Compass } from "lucide-react-native";
import { BookingRow, EmptyState, Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";
import { colors } from "../theme";

export function AvailableJobsScreen({ navigation }: any) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { openDrawer, showMenu } = useShellMenu();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      let lat: number | undefined, lng: number | undefined;
      if (perm.status === "granted") {
        try {
          const loc = await Location.getLastKnownPositionAsync({});
          if (loc) {
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        } catch {
          /* ignore */
        }
      }
      const rows = await DriverAPI.nearbyJobs(lat, lng);
      setJobs(sortByCreatedAtDesc(rows));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page testID="driver-available-jobs">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <PageHeader
          large
          title="Available jobs"
          subtitle="Newest first. Pull to refresh."
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {jobs.length === 0 ? (
            <EmptyState Icon={Compass} title="No jobs available right now" body="Pull down to check again." />
          ) : (
            jobs.map((item: any) => (
              <BookingRow
                key={item.id}
                title={item.title}
                status={item.status || "posted"}
                pickup={item.pickup_town}
                dropoff={item.dropoff_town}
                price={item.fixed_price ?? item.suggested_price ?? null}
                priceLabel={item.pricing_type === "bidding" ? "Open bid" : "Fixed"}
                onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}
                testID={`job-row-${item.id}`}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}
