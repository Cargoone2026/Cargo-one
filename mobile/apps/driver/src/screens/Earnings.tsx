import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { DriverAPI, money } from "@cargoone/core";
import { Body, CARGO, Card, H1, Screen } from "../ui";

/**
 * Driver earnings — reads the R59-certified backend calculation as-is.
 * No client-side math to prevent drift from the authoritative record.
 */
export function EarningsScreen() {
  const [data, setData] = useState<{ total: number; period: string; jobs: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await DriverAPI.earnings());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <H1>Earnings</H1>
      <Body muted style={{ marginTop: 6 }}>{data?.period || "This period"}</Body>
      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase" }}>Total</Text>
        <Text style={{ fontSize: 34, fontWeight: "800", color: CARGO.ink, marginTop: 4 }}>{money(data?.total ?? 0)}</Text>
        <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 4 }}>{data?.jobs ?? 0} completed jobs</Text>
      </Card>
    </ScrollView>
  );
}
