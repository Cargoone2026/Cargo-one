/**
 * EarningsScreen — Cargo One driver earnings. Uses the shared Card /
 * PageHeader / SummaryRow primitives.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { DriverAPI, money } from "@cargoone/core";
import { Page, PageHeader, SummaryRow } from "../ui";
import { colors, radius, typography } from "../theme";
import { useShellMenu } from "../components/AppShell";

export function EarningsScreen() {
  const [data, setData] = useState<{ total: number; period: string; jobs: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { openDrawer, showMenu } = useShellMenu();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await DriverAPI.earnings());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page testID="driver-earnings">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}>
        <PageHeader large title="Earnings" subtitle={data?.period || "This period"} showMenu={showMenu} onMenuPress={openDrawer} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <View style={styles.hero}>
            <Text style={typography.micro}>Total</Text>
            <Text style={styles.heroValue}>{money(data?.total ?? 0)}</Text>
            <Text style={typography.caption}>{data?.jobs ?? 0} completed jobs</Text>
          </View>
          <View style={styles.card}>
            <Text style={typography.micro}>Summary</Text>
            <View style={{ marginTop: 8 }}>
              <SummaryRow label="Period" value={data?.period || "—"} />
              <SummaryRow label="Completed jobs" value={String(data?.jobs ?? 0)} />
              <SummaryRow label="Total earnings" value={money(data?.total ?? 0)} big />
            </View>
          </View>
          <Text style={typography.small}>Cargo One pays out via Stripe. Statements arrive on Fridays.</Text>
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  hero: {
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    gap: 8,
  },
  heroValue: { color: "#FFFFFF", fontSize: 40, fontWeight: "800" as const, letterSpacing: -0.5 },
  card: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
