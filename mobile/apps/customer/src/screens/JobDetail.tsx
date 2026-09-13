/**
 * JobDetailScreen — mirrors web /customer/job/:id.
 * Read-only overview + list of bids received. Shows the standard
 * reference RouteMap whenever the job has pickup + dropoff coords
 * so the screen never collapses to text-only (R71 map-consistency).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RotateCcw, Trash2 } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { CustomerAPI, Job, Bid } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader, PrimaryButton, SecondaryButton, StatusPill, SummaryRow } from "../ui";
import { RouteMap } from "../components/RouteMap";

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

  const hasRouteCoords =
    job?.pickup_lat != null && job?.pickup_lng != null &&
    job?.dropoff_lat != null && job?.dropoff_lng != null;

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
          {hasRouteCoords ? (
            <RouteMap
              pickup={{ lat: job!.pickup_lat!, lng: job!.pickup_lng! }}
              dropoff={{ lat: job!.dropoff_lat!, lng: job!.dropoff_lng! }}
              summary={{
                pickupTown: job!.pickup_town,
                dropoffTown: job!.dropoff_town,
                distanceMiles: job!.distance_miles,
                durationMinutes: job!.duration_minutes,
              }}
            />
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
          {/* R71.14 — Delete job for eligible normal posted/accepted jobs
              with no driver assigned. Backend enforces the same guards
              (409 if driver accepted or a paid booking exists), so this
              button is purely a UX affordance. */}
          {job && !job.cancelled_at && job.status !== "cancelled" && job.status !== "completed" && !(job as any).assigned_driver_id ? (
            <SecondaryButton
              title="Delete job"
              onPress={() => {
                Alert.alert(
                  "Delete this job?",
                  "This will remove the job from your active list. No cancellation fee applies because no driver has accepted.",
                  [
                    { text: "Keep", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await CustomerAPI.cancelJob(jobId);
                          navigation.navigate("Bookings");
                        } catch (e: any) {
                          Alert.alert("Could not delete", e?.message || "Please try again in a moment.");
                        }
                      },
                    },
                  ],
                );
              }}
              testID="job-detail-delete-btn"
            />
          ) : null}
          {/* R71.14 — Rebook a cancelled job: navigates to PostJob with
              the full job payload as a route param; the wizard pre-fills
              and submits a NEW job on completion. Never mutates the
              cancelled source record. */}
          {job && (job.cancelled_at || job.status === "cancelled") ? (
            <PrimaryButton
              title="Rebook this job"
              onPress={() => navigation.navigate("PostJob", { rebookFromJob: job as any })}
              testID="job-detail-rebook-btn"
            />
          ) : null}
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
