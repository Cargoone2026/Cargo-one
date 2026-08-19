import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomerAPI } from "@cargoone/core";
import { Body, CARGO, H1, Input, Label, PrimaryButton, Screen } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "CreateJob">;

/**
 * CreateJob — a single form handling the 4 booking flows from Home.
 * The `serviceTiming` / `serviceType` params control:
 *   • `asap+transport`  → ASAP Transport   (auto-dispatch)
 *   • `asap+recovery`   → ASAP Recovery
 *   • `scheduled+big`   → Big Job / Bidding
 *   • `scheduled+*`     → Fixed Price marketplace
 *
 * Coordinates must be typed in for Phase 1 (a native Places autocomplete
 * arrives in Phase 2). Pricing is delegated to the backend so R26/R42
 * remain authoritative.
 */
export function CreateJobScreen({ route, navigation }: P) {
  const { serviceTiming, serviceType } = route.params;
  const isAsap = serviceTiming === "asap";
  const isBid = serviceType === "big";
  const [title, setTitle] = useState(isAsap ? "ASAP job" : "");
  const [pickupTown, setPickupTown] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffTown, setDropoffTown] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [vehicleKey, setVehicleKey] = useState("small_van");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        title: title || "New job",
        description: "",
        category: serviceType === "recovery" ? "recovery" : "general_transport",
        service_type: serviceType === "recovery" ? "recovery" : "transport",
        service_timing: serviceTiming,
        pricing_type: isBid ? "bidding" : "fixed",
        fixed_price: isBid ? undefined : Number(fixedPrice) || undefined,
        pickup_address: pickupAddress,
        pickup_town: pickupTown,
        pickup_lat: Number(pickupLat),
        pickup_lng: Number(pickupLng),
        dropoff_address: dropoffAddress,
        dropoff_town: dropoffTown,
        dropoff_lat: Number(dropoffLat),
        dropoff_lng: Number(dropoffLng),
        requested_vehicle_key: vehicleKey,
      };
      if (!isAsap) {
        payload.collection_date = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
        payload.delivery_date = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10);
      }
      const job = await CustomerAPI.createJob(payload);
      if (isAsap) {
        const booking = await CustomerAPI.createAsapBooking(job.id);
        navigation.replace("Payment", { bookingId: booking.id });
      } else if (isBid) {
        navigation.replace("Bids", { jobId: job.id });
      } else {
        // Fixed-price marketplace — booking is created when a driver accepts.
        Alert.alert("Job posted", "Your job is live in the marketplace.");
        navigation.replace("Tabs");
      }
    } catch (e: any) {
      Alert.alert("Could not create booking", e?.message || "Please check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase", letterSpacing: 1 }}>
            {isAsap ? `ASAP ${serviceType}` : isBid ? "Big Job / Bidding" : "Fixed Price"}
          </Text>
          <H1>New booking</H1>
          <Body muted style={{ marginTop: 4, marginBottom: 20 }}>
            Enter your pickup and destination. Pricing follows the CargoOne rules.
          </Body>

          {!isAsap && (
            <>
              <Label>Title</Label>
              <Input value={title} onChangeText={setTitle} testID="job-title" />
            </>
          )}
          <Label>Pickup town</Label>
          <Input value={pickupTown} onChangeText={setPickupTown} testID="pickup-town" />
          <Label>Pickup address</Label>
          <Input value={pickupAddress} onChangeText={setPickupAddress} testID="pickup-address" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Label>Pickup lat</Label>
              <Input value={pickupLat} onChangeText={setPickupLat} keyboardType="numeric" testID="pickup-lat" />
            </View>
            <View style={{ flex: 1 }}>
              <Label>Pickup lng</Label>
              <Input value={pickupLng} onChangeText={setPickupLng} keyboardType="numeric" testID="pickup-lng" />
            </View>
          </View>

          <Label>Dropoff town</Label>
          <Input value={dropoffTown} onChangeText={setDropoffTown} testID="dropoff-town" />
          <Label>Dropoff address</Label>
          <Input value={dropoffAddress} onChangeText={setDropoffAddress} testID="dropoff-address" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Label>Dropoff lat</Label>
              <Input value={dropoffLat} onChangeText={setDropoffLat} keyboardType="numeric" testID="dropoff-lat" />
            </View>
            <View style={{ flex: 1 }}>
              <Label>Dropoff lng</Label>
              <Input value={dropoffLng} onChangeText={setDropoffLng} keyboardType="numeric" testID="dropoff-lng" />
            </View>
          </View>

          <Label>Vehicle key</Label>
          <Input value={vehicleKey} onChangeText={setVehicleKey} autoCapitalize="none" testID="vehicle-key" />

          {!isBid && !isAsap && (
            <>
              <Label>Your fixed price (£)</Label>
              <Input value={fixedPrice} onChangeText={setFixedPrice} keyboardType="numeric" testID="fixed-price" />
            </>
          )}

          <PrimaryButton title={isAsap ? "Book now" : isBid ? "Post for bids" : "Post fixed-price job"} onPress={onSubmit} loading={busy} testID="job-submit" />
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
