/**
 * JobDetailScreen — read-only job overview + bids list for a
 * pending job posted by the customer. Mirrors web /customer/job/:id.
 * From here the customer opens the full Bids screen to accept.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Job, Bid } from "@cargoone/core";
import { PrimaryButton } from "../ui";

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
      /* leave stale state on error, refresh will retry */
    } finally {
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} testID="job-detail-screen">
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#D62828" />}
      >
        <Text style={styles.title}>{job?.title || "Job"}</Text>
        {job?.description ? <Text style={styles.desc}>{job.description}</Text> : null}

        <View style={styles.card}>
          <Row label="From" value={(job as any)?.pickup?.address || (job as any)?.pickup_address || "—"} />
          <Row label="To" value={(job as any)?.dropoff?.address || (job as any)?.dropoff_address || "—"} />
          <Row label="Category" value={(job as any)?.category || "—"} />
          <Row label="Status" value={job?.status || "—"} />
          <Row label="Bids received" value={String(bids.length)} />
        </View>

        <View style={{ height: 20 }} />
        <PrimaryButton
          title={bids.length ? `Review ${bids.length} bid${bids.length === 1 ? "" : "s"}` : "No bids yet"}
          onPress={() => navigation.navigate("Bids", { jobId })}
          disabled={!bids.length}
          testID="job-detail-bids-btn"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  body: { padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  desc: { fontSize: 14, color: "#6B7280", marginTop: 8, marginBottom: 20, lineHeight: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  row: { flexDirection: "row", padding: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  rowLabel: { width: 110, fontSize: 13, color: "#6B7280", fontWeight: "500" },
  rowValue: { flex: 1, fontSize: 14, color: "#111827" },
});
