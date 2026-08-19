import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Bid, CustomerAPI, DriverProfile, money, SharedAPI, Review } from "@cargoone/core";
import { Body, CARGO, Card, H1, PrimaryButton, Screen } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Bids">;

/**
 * Bids list — customer inspects every bidder's rating + INDIVIDUAL
 * review comments BEFORE accepting a bid (R69). Contact details never
 * appear here — the driver profile endpoint redacts them for
 * non-owner + non-admin callers (see R69 backend fix).
 */
export function BidsScreen({ route, navigation }: P) {
  const { jobId } = route.params;
  const [bids, setBids] = useState<Bid[]>([]);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await CustomerAPI.listBids(jobId);
    setBids(rows);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!inspecting) return;
    setProfile(null);
    CustomerAPI.driverProfile(inspecting).then(setProfile).catch(() => setProfile(null));
  }, [inspecting]);

  async function accept(b: Bid) {
    try {
      const res = await CustomerAPI.acceptBid(jobId, b.id);
      navigation.replace("Payment", { bookingId: res.booking_id });
    } catch (e: any) {
      Alert.alert("Could not accept bid", e?.message || "");
    }
  }

  return (
    <Screen>
      <H1>Bids</H1>
      <Body muted style={{ marginTop: 4, marginBottom: 16 }}>
        Tap “See reviews” to inspect a driver’s rating and comments before accepting.
      </Body>
      <FlatList
        data={bids}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 12 }} testID={`bid-card-${item.id}`}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: CARGO.ink }}>{item.driver_name || "Driver"}</Text>
            <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 2 }} testID={`bid-rating-${item.id}`}>
              ★ {Number(item.driver_rating || 0).toFixed(1)} · {item.driver_review_count ?? 0} review
              {(item.driver_review_count ?? 0) === 1 ? "" : "s"}
              {item.eta_hours ? ` · ~${item.eta_hours}h ETA` : ""}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: CARGO.ink, marginTop: 6 }}>{money(item.amount)}</Text>
            {item.message ? (
              <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 6 }}>{item.message}</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Accept bid" onPress={() => accept(item)} testID={`bid-accept-${item.id}`} />
              </View>
              <Pressable onPress={() => setInspecting(item.driver_id)} testID={`bid-see-reviews-${item.id}`}>
                <Text style={{ color: CARGO.red, fontWeight: "700", fontSize: 13 }}>See reviews</Text>
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Body muted style={{ marginTop: 40, textAlign: "center" }}>No bids yet — check back in a few minutes.</Body>}
      />

      <Modal visible={!!inspecting} animationType="slide" onRequestClose={() => setInspecting(null)}>
        <View style={{ flex: 1, backgroundColor: "#fff", padding: 20 }}>
          <ScrollView>
            <Text style={{ fontSize: 20, fontWeight: "800", color: CARGO.ink, marginBottom: 12 }}>
              Reviews for {profile?.name || "driver"}
            </Text>
            {!profile && <Body muted>Loading…</Body>}
            {profile && (
              <>
                <Text style={{ fontSize: 14, color: CARGO.muted, marginBottom: 12 }}>
                  ★ {Number(profile.rating || 0).toFixed(1)} · {profile.review_count ?? 0} review
                  {(profile.review_count ?? 0) === 1 ? "" : "s"}
                </Text>
                {(profile.reviews || []).length === 0 && <Body muted>No written reviews yet.</Body>}
                {(profile.reviews || []).map((r: Review) => (
                  <Card key={r.id} style={{ marginBottom: 8 }} testID={`review-${r.id}`}>
                    <Text style={{ fontSize: 13, color: CARGO.ink, fontWeight: "700" }}>★ {r.rating}</Text>
                    {r.comment ? <Text style={{ fontSize: 13, color: CARGO.ink, marginTop: 4 }}>{r.comment}</Text> : null}
                    <Text style={{ fontSize: 11, color: CARGO.muted, marginTop: 4 }}>— {r.from_name || "Customer"}</Text>
                  </Card>
                ))}
              </>
            )}
            <PrimaryButton title="Close" variant="secondary" onPress={() => setInspecting(null)} testID="reviews-close" />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
