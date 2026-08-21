import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DriverAPI, Job, money, miles } from "@cargoone/core";
import { Body, CARGO, Card, H1, Input, Label, PrimaryButton, Screen } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "JobDetail">;

/**
 * Job detail — supports Fixed Price accept + Bidding submit-bid. ASAP
 * jobs use LiveMode instead so this screen intentionally doesn't need
 * an ASAP path.
 */
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

  if (!job) return <Screen><Body muted>Loading…</Body></Screen>;

  const currentJob = job; // Non-null capture for closures below.
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
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase", letterSpacing: 1 }}>
        {isBidding ? "Bidding" : "Fixed price"} · {job.service_type}
      </Text>
      <H1>{job.title}</H1>
      <Body muted style={{ marginTop: 6 }}>
        {job.pickup_town || "—"} → {job.dropoff_town || "—"}
      </Body>

      <Card style={{ marginTop: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase" }}>Price</Text>
            <Text style={{ fontSize: 22, fontWeight: "800" }}>{isFixed ? money(job.fixed_price) : "Open bid"}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase" }}>Distance</Text>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>{miles(job.distance_miles)}</Text>
          </View>
        </View>
      </Card>

      {job.description ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, color: CARGO.ink }}>{job.description}</Text>
        </Card>
      ) : null}

      <View style={{ marginTop: 20 }}>
        {isFixed && (
          <PrimaryButton title="Accept this job" onPress={accept} loading={busy} testID="job-accept" />
        )}
        {isBidding && (
          <>
            <Label>Your bid (£)</Label>
            <Input value={bidAmount} onChangeText={setBidAmount} keyboardType="numeric" testID="bid-amount" />
            <Label>Message to customer (optional)</Label>
            <Input value={bidMessage} onChangeText={setBidMessage} multiline testID="bid-message" style={{ height: 80 }} />
            <PrimaryButton title="Submit bid" onPress={bid} loading={busy} testID="bid-submit" />
          </>
        )}
      </View>
    </ScrollView>
  );
}
