/**
 * JobDetailScreen — driver-side job accept / bid flow.
 * Uses shared Cargo One primitives so styling matches the customer app.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DriverAPI, Job, money, miles } from "@cargoone/core";
import { Input, Label, Page, PageHeader, PrimaryButton, StatusPill, SummaryRow } from "../ui";
import { colors, radius, typography } from "../theme";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "JobDetail">;

export function JobDetailScreen({ route, navigation }: P) {
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setJob(await DriverAPI.jobDetail(jobId));
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!job) {
    return (
      <Page>
        <PageHeader title="Job" />
        <Text style={{ padding: 16, color: colors.inkMuted }}>Loading job…</Text>
      </Page>
    );
  }

  const currentJob = job;
  const isFixed = job.pricing_type === "fixed" || job.fixed_price != null;
  const isBidding = job.pricing_type === "bidding";

  async function accept() {
    setBusy(true);
    try {
      const res = await DriverAPI.acceptFixedPrice(currentJob.id);
      Alert.alert("Job accepted", "It's now in your bookings.");
      navigation.replace("ActiveBooking", { bookingId: res.booking_id });
    } catch (e: any) {
      Alert.alert("Could not accept", e?.message || "");
    } finally {
      setBusy(false);
    }
  }

  async function bid() {
    setBusy(true);
    try {
      await DriverAPI.submitBid(currentJob.id, Number(bidAmount) || 0, bidMessage);
      Alert.alert("Bid submitted", "You'll be notified if the customer accepts.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Bid failed", e?.message || "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page testID="job-detail-screen">
      <ScrollView>
        <PageHeader title={job.title} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StatusPill status={job.status || "posted"} />
            <Text style={[typography.micro]}>{isBidding ? "BIDDING" : "FIXED PRICE"} · {job.service_type}</Text>
          </View>
          <Text style={[typography.bodyMuted]}>
            {job.pickup_town || "—"} → {job.dropoff_town || "—"}
          </Text>

          <View style={styles.card}>
            <Text style={typography.micro}>Details</Text>
            <View style={{ marginTop: 8 }}>
              <SummaryRow label="Price" value={isFixed ? money(job.fixed_price ?? 0) : "Open bid"} big />
              <SummaryRow label="Distance" value={miles(job.distance_miles ?? 0)} />
              {job.description ? <SummaryRow label="Notes" value={job.description} /> : null}
            </View>
          </View>

          {isFixed && <PrimaryButton title="Accept this job" onPress={accept} loading={busy} testID="job-accept" />}

          {isBidding && (
            <View style={{ gap: 4 }}>
              <Label>Your bid (£)</Label>
              <Input value={bidAmount} onChangeText={setBidAmount} keyboardType="numeric" testID="bid-amount" />
              <Label>Message to customer (optional)</Label>
              <Input
                value={bidMessage}
                onChangeText={setBidMessage}
                multiline
                testID="bid-message"
                style={{ height: 80, textAlignVertical: "top" }}
              />
              <View style={{ marginTop: 16 }}>
                <PrimaryButton title="Submit bid" onPress={bid} loading={busy} testID="bid-submit" />
              </View>
            </View>
          )}
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
