/**
 * JobDetailScreen — mirrors web /customer/job/:id.
 * Read-only overview + list of bids received.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Job, Bid } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton, StatusPill, SummaryRow } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "JobDetail">;

export function JobDetailScreen({ route, navigation }: P) {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [j, b] = await Promise.all([CustomerAPI.jobDetail(jobId), CustomerAPI.listBids(jobId)]);
      setJob(j);
      setBids(Array.isArray(b) ? b : []);
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Bookings");

  return (
    <Page testID="job-detail-screen" scroll={false}>
      <PageHeader title={job?.title || "Job"} onBack={goBack} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {job?.status ? <StatusPill status={job.status} /> : null}
          {job?.description ? (
            <Text style={[typography.body, { lineHeight: 20, color: colors.inkMuted }]}>{job.description}</Text>
          ) : null}
          <View style={styles.card}>
            <Text style={typography.micro}>Details</Text>
            <View style={{ marginTop: 8 }}>
              <SummaryRow label="From" value={(job as any)?.pickup?.address || (job as any)?.pickup_address || "—"} />
              <SummaryRow label="To" value={(job as any)?.dropoff?.address || (job as any)?.dropoff_address || "—"} />
              <SummaryRow label="Category" value={(job as any)?.category || "—"} />
              <SummaryRow label="Bids received" value={String(bids.length)} emphasise />
            </View>
          </View>
          <PrimaryButton
            title={bids.length ? `Review ${bids.length} bid${bids.length === 1 ? "" : "s"}` : "No bids yet"}
            onPress={() => navigation.navigate("Bids", { jobId })}
            disabled={!bids.length}
            testID="job-detail-bids-btn"
          />
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  card: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
