import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import * as Location from "expo-location";
import { DriverAPI, Job, money, miles, sortByCreatedAtDesc } from "@cargoone/core";
import { Body, CARGO, Card, H1, Screen } from "../ui";

/**
 * Driver's full marketplace list. R70 — newest-first by default, and
 * server-side ordering is already newest-first (see server.py L2085).
 * We defensively re-sort client-side as belt-and-braces.
 */
export function AvailableJobsScreen({ navigation }: any) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      // Ask for the driver's location so distance is populated, but the
      // server order remains newest-first regardless (R70).
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
    <Screen>
      <H1>Available jobs</H1>
      <Body muted style={{ marginTop: 4, marginBottom: 12 }}>
        Newest first. Pull to refresh.
      </Body>
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable testID={`job-row-${item.id}`} onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}>
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase" }}>
                  {item.pricing_type === "bidding" ? "Bidding" : "Fixed price"}
                </Text>
                <Text style={{ fontSize: 11, color: CARGO.muted }}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: CARGO.ink, marginTop: 6 }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 2 }} numberOfLines={1}>
                {item.pickup_town || "—"} → {item.dropoff_town || "—"}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: "700" }}>{item.fixed_price ? money(item.fixed_price) : "Open bid"}</Text>
                <Text style={{ fontSize: 13, color: CARGO.muted }}>{miles(item.distance_miles)}</Text>
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Body muted style={{ marginTop: 40, textAlign: "center" }}>No jobs available right now.</Body>}
      />
    </Screen>
  );
}
