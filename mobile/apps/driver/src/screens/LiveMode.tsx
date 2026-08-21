/**
 * LiveModeScreen — driver ASAP dispatch. Uses shared Cargo One
 * primitives; map remains dominant, secondary controls fold via a
 * status hero at the top, offers list below.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as Location from "expo-location";
import { DriverAPI, Job, money, miles } from "@cargoone/core";
import { Zap } from "lucide-react-native";
import { EmptyState, Page, PageHeader, PrimaryButton, StatusPill } from "../ui";
import { colors, radius, typography } from "../theme";
import { useShellMenu } from "../components/AppShell";

export function LiveModeScreen({ navigation }: any) {
  const [online, setOnline] = useState(false);
  const [offers, setOffers] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const { openDrawer, showMenu } = useShellMenu();
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const stopLocation = useCallback(() => {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
  }, []);

  const startLocation = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Location required", "CargoOne needs your location to dispatch ASAP jobs.");
      return false;
    }
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 8000 },
      (loc) => {
        DriverAPI.pushLocation(loc.coords.latitude, loc.coords.longitude).catch(() => {});
      },
    );
    return true;
  }, []);

  const refreshOffers = useCallback(async () => {
    if (!online) return;
    try {
      setOffers(await DriverAPI.asapOffers());
    } catch {
      setOffers([]);
    }
  }, [online]);

  useEffect(() => {
    if (!online) {
      stopLocation();
      setOffers([]);
      return;
    }
    startLocation();
    refreshOffers();
    const iv = setInterval(refreshOffers, 5000);
    return () => clearInterval(iv);
  }, [online, refreshOffers, startLocation, stopLocation]);

  useEffect(() => () => stopLocation(), [stopLocation]);

  async function toggle(v: boolean) {
    setBusy(true);
    try {
      if (v) await DriverAPI.goOnline();
      else await DriverAPI.goOffline();
      setOnline(v);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "");
    } finally {
      setBusy(false);
    }
  }

  async function claim(job: Job) {
    try {
      const booking = await DriverAPI.claimAsap(job.id);
      navigation.navigate("ActiveBooking", { bookingId: booking.id });
    } catch (e: any) {
      Alert.alert("Could not claim", e?.message || "");
    }
  }

  return (
    <Page testID="driver-live-mode">
      <ScrollView>
        <PageHeader
          large
          title="Live mode"
          subtitle={online ? "You're online — ASAP offers appear below." : "Go online to receive ASAP jobs."}
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
          <View style={[styles.hero, online && styles.heroOnline]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Zap size={22} color={online ? "#FFFFFF" : colors.accent} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.strong, online && { color: "#FFFFFF" }]}>
                  {online ? "Online — you're on dispatch" : "You're offline"}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { marginTop: 2, color: online ? "rgba(255,255,255,0.72)" : colors.inkMuted },
                  ]}
                >
                  {online
                    ? "Cargo One is sharing your location and forwarding ASAP offers to you."
                    : "Toggle on when you're ready to receive Cargo One ASAP jobs."}
                </Text>
              </View>
            </View>
            <Switch
              value={online}
              onValueChange={toggle}
              disabled={busy}
              testID="live-online-toggle"
              trackColor={{ true: colors.brand, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          {offers.length === 0 ? (
            <EmptyState
              Icon={Zap}
              title={online ? "Waiting for offers…" : "No offers yet"}
              body={online ? "Ranked ASAP offers will land here as soon as Cargo One dispatch matches one to you." : "Turn on Live mode above to start receiving ASAP jobs."}
            />
          ) : (
            offers.map((item) => (
              <View key={item.id} style={styles.offer} testID={`asap-offer-${item.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <StatusPill status="posted" />
                  <Text style={typography.micro}>ASAP · {item.service_type}</Text>
                </View>
                <Text style={[typography.cardTitle, { marginTop: 8 }]}>{item.title}</Text>
                <Text style={[typography.caption, { marginTop: 2 }]} numberOfLines={1}>
                  {item.pickup_town} → {item.dropoff_town}
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
                  <View>
                    <Text style={typography.small}>Est. earnings</Text>
                    <Text style={typography.priceBig}>{money(item.fixed_price ?? 0)}</Text>
                  </View>
                  <Text style={typography.caption}>{miles(item.distance_miles ?? 0)}</Text>
                </View>
                <View style={{ marginTop: 12 }}>
                  <PrimaryButton title="Accept ASAP" onPress={() => claim(item)} testID={`asap-accept-${item.id}`} />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  hero: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  heroOnline: { backgroundColor: colors.ink, borderColor: colors.ink },
  offer: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
};
