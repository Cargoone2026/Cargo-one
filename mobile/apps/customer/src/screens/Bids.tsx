/**
 * BidsScreen — mirrors web bid selection UI. Customer inspects
 * driver reviews (R69) before accepting.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Bid, CustomerAPI, DriverProfile, money, Review } from "@cargoone/core";
import { Star, X } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { EmptyState, Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Bids">;

export function BidsScreen({ route, navigation }: P) {
  const { jobId } = route.params;
  const [bids, setBids] = useState<Bid[]>([]);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await CustomerAPI.listBids(jobId).catch(() => [] as Bid[]);
    setBids(Array.isArray(rows) ? rows : []);
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
    <Page testID="bids-screen">
      <ScrollView>
        <PageHeader
          title="Bids"
          subtitle="Tap “See reviews” to inspect a driver's rating and comments before accepting."
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          {bids.length === 0 ? (
            <EmptyState Icon={Star} title="No bids yet" body="Check back in a few minutes." />
          ) : (
            bids.map((item) => (
              <View key={item.id} style={styles.card} testID={`bid-card-${item.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.cardTitle}>{item.driver_name || "Driver"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Star size={14} color={colors.accent} fill={colors.accent} />
                      <Text style={typography.caption}>
                        {Number(item.driver_rating || 0).toFixed(1)} · {item.driver_review_count ?? 0} review
                        {(item.driver_review_count ?? 0) === 1 ? "" : "s"}
                        {item.eta_hours ? ` · ~${item.eta_hours}h ETA` : ""}
                      </Text>
                    </View>
                  </View>
                  <Text style={typography.priceBig}>{money(item.amount)}</Text>
                </View>
                {item.message ? (
                  <Text style={[typography.caption, { marginTop: 8, lineHeight: 18 }]}>{item.message}</Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 12, marginTop: 12, alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Accept bid" onPress={() => accept(item)} testID={`bid-accept-${item.id}`} />
                  </View>
                  <Pressable onPress={() => setInspecting(item.driver_id)} testID={`bid-see-reviews-${item.id}`}>
                    <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 14 }}>See reviews</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={!!inspecting} animationType="slide" onRequestClose={() => setInspecting(null)}>
        <Page testID="reviews-modal">
          <ScrollView>
            <PageHeader
              title={`Reviews for ${profile?.name || "driver"}`}
              right={
                <Pressable onPress={() => setInspecting(null)} testID="reviews-close" hitSlop={8}>
                  <X size={20} color={colors.ink} />
                </Pressable>
              }
            />
            <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
              {!profile && <Text style={typography.caption}>Loading…</Text>}
              {profile && (
                <>
                  <Text style={typography.caption}>
                    ★ {Number((profile as any).rating || 0).toFixed(1)} · {(profile as any).review_count ?? 0} reviews
                  </Text>
                  {((profile as any).reviews || []).length === 0 && (
                    <Text style={typography.caption}>No written reviews yet.</Text>
                  )}
                  {((profile as any).reviews || []).map((r: Review) => (
                    <View key={r.id} style={styles.card} testID={`review-${r.id}`}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Star size={14} color={colors.accent} fill={colors.accent} />
                        <Text style={{ fontSize: 13, fontWeight: "700" }}>{r.rating}</Text>
                      </View>
                      {r.comment ? (
                        <Text style={[typography.body, { marginTop: 6 }]}>{r.comment}</Text>
                      ) : null}
                      <Text style={[typography.small, { marginTop: 6 }]}>— {r.from_name || "Customer"}</Text>
                    </View>
                  ))}
                </>
              )}
              <SecondaryButton title="Close" onPress={() => setInspecting(null)} testID="reviews-close-btn" />
            </View>
          </ScrollView>
        </Page>
      </Modal>
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
