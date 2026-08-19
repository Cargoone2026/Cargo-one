import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Switch, Text, View } from "react-native";
import * as Location from "expo-location";
import { DriverAPI, Job, money, miles } from "@cargoone/core";
import { Body, CARGO, Card, H1, PrimaryButton, Screen } from "../ui";

/**
 * Driver Live Mode — the ASAP dispatch experience. Preserves R43/R55/R61:
 * the server ranks offers; we simply show them and let the driver
 * accept. Location is streamed to the backend when the driver is
 * online (used for dispatch scoring + R61 auto-tracking after claim).
 */
export function LiveModeScreen({ navigation }: any) {
  const [online, setOnline] = useState(false);
  const [offers, setOffers] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
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
    return () => {
      clearInterval(iv);
    };
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
      // R61 — automatic tracking is now active server-side. Nothing else
      // for us to do — jump to the active booking screen.
      navigation.navigate("ActiveBooking", { bookingId: booking.id });
    } catch (e: any) {
      Alert.alert("Could not claim", e?.message || "");
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <H1>Live mode</H1>
        <Switch value={online} onValueChange={toggle} disabled={busy} testID="live-online-toggle" trackColor={{ true: CARGO.red }} />
      </View>
      <Body muted style={{ marginTop: 4 }}>
        {online ? "You're online — ASAP offers appear below." : "Go online to receive ASAP jobs."}
      </Body>

      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        style={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 12 }} testID={`asap-offer-${item.id}`}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.red, textTransform: "uppercase" }}>ASAP · {item.service_type}</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 4 }}>{item.title}</Text>
            <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 2 }}>{item.pickup_town} → {item.dropoff_town}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "700" }}>{money(item.fixed_price)}</Text>
              <Text style={{ fontSize: 13, color: CARGO.muted }}>{miles(item.distance_miles)}</Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <PrimaryButton title="Accept ASAP" onPress={() => claim(item)} testID={`asap-accept-${item.id}`} />
            </View>
          </Card>
        )}
        ListEmptyComponent={online ? <Body muted style={{ marginTop: 40, textAlign: "center" }}>Waiting for offers…</Body> : null}
      />
    </Screen>
  );
}
