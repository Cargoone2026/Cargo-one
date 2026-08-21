/**
 * AsapScreen — full ASAP dispatch flow.
 * 1:1 port of frontend/src/pages/portal/customer/AsapRequest.jsx —
 * Transport / Recovery modes, address autocomplete, live pricing quote
 * from `/api/asap/quote`, booking summary, and deposit checkout hand-off.
 *
 * The ASAP live-mode / dispatch map remains in DispatchScreen; this
 * screen is the request wizard.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle, ChevronLeft, MapPin, ShieldCheck, Truck, Zap, Loader2 } from "lucide-react-native";
import { SharedAPI, CustomerAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { IconButton, Input, Label, Page, PrimaryButton, SummaryRow } from "../ui";
import { useShellMenu } from "../components/AppShell";
import { AddressAutocomplete, PlaceResult } from "../components/AddressAutocomplete";
import { RouteMap } from "../components/RouteMap";

type Mode = "transport" | "breakdown_recovery";

const TRANSPORT_CATS: { value: string; label: string }[] = [
  { value: "parcel", label: "Parcel" },
  { value: "documents", label: "Documents" },
  { value: "medical_supplies", label: "Medical" },
  { value: "pallets", label: "Pallets" },
  { value: "furniture", label: "Furniture" },
  { value: "machinery", label: "Machinery" },
  { value: "boxes", label: "Boxes" },
  { value: "retail_goods", label: "Retail" },
  { value: "electrical_items", label: "Electrical" },
  { value: "other", label: "Other" },
];

export function AsapScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();
  const [mode, setMode] = useState<Mode>("transport");
  const [pickup, setPickup] = useState<PlaceResult | null>(null);
  const [dropoff, setDropoff] = useState<PlaceResult | null>(null);
  const [note, setNote] = useState("");
  const [transportCategory, setTransportCategory] = useState("");
  const [transportDescription, setTransportDescription] = useState("");
  const [vehicle, setVehicle] = useState({ make: "", model: "", registration: "", condition: "will_not_start" });
  const [quote, setQuote] = useState<any | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSubmit = useMemo(() => {
    if (!pickup || !dropoff) return false;
    if (mode === "breakdown_recovery") {
      if (!vehicle.make || !vehicle.model) return false;
    } else if (!transportCategory) return false;
    return true;
  }, [pickup, dropoff, mode, vehicle, transportCategory]);

  // Live quote (debounced 350 ms)
  useEffect(() => {
    if (!pickup || !dropoff) {
      setQuote(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const cat =
          mode === "breakdown_recovery"
            ? "cars_vehicles"
            : transportCategory === "furniture"
            ? "furniture_delivery"
            : transportCategory === "pallets"
            ? "freight_haulage"
            : transportCategory === "machinery"
            ? "freight_haulage"
            : transportCategory || "package_delivery";
        const q = await SharedAPI.asapQuote({
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          pickup_country_code: pickup.country_code || null,
          dropoff_country_code: dropoff.country_code || null,
          service_type: mode,
          urgency: "asap",
          vehicle_class: mode === "breakdown_recovery" ? vehicle.condition || null : null,
        });
        if (q?.requires_manual_review) {
          setQuote(null);
          setErr(q.manual_review_message || "This route requires operator confirmation. Please book as a Scheduled job.");
          return;
        }
        setErr(null);
        setQuote(q);
      } catch (e: any) {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pickup, dropoff, mode, transportCategory, vehicle.condition]);

  const onSubmit = useCallback(async () => {
    if (!pickup || !dropoff) {
      setErr("Please confirm both addresses.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const suggested = Number(quote?.driver_charge ?? quote?.suggested_price ?? 0);
      const category =
        mode === "breakdown_recovery"
          ? "recovery"
          : transportCategory === "furniture"
          ? "furniture_delivery"
          : transportCategory === "pallets"
          ? "freight_haulage"
          : transportCategory === "machinery"
          ? "freight_haulage"
          : "package_delivery";
      const created: any = await CustomerAPI.createJob({
        title:
          mode === "breakdown_recovery"
            ? "ASAP Vehicle Recovery"
            : `ASAP Delivery — ${(transportCategory || "General").replace(/_/g, " ")}`,
        category,
        description:
          mode === "breakdown_recovery"
            ? "ASAP vehicle recovery"
            : transportDescription || `ASAP delivery — ${transportCategory}`,
        service_timing: "asap",
        service_type: mode,
        vehicle_details: mode === "breakdown_recovery" ? vehicle : null,
        customer_note: note || null,
        pickup_address: pickup.formatted_address,
        pickup_town: pickup.town || "Pickup",
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: dropoff.formatted_address,
        dropoff_town: dropoff.town || "Dropoff",
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        collection_date: new Date().toISOString(),
        delivery_date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        pricing_type: "fixed",
        fixed_price: suggested,
      });
      const booking: any = await CustomerAPI.createAsapBooking(created.id);
      nav.replace("Payment", { bookingId: booking.id });
    } catch (e: any) {
      setErr(e?.message || "Could not start dispatch. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [pickup, dropoff, mode, transportCategory, transportDescription, note, vehicle, quote, nav]);

  const feePercent = quote?.booking_fee_percent ?? null;
  const estDriver = Number(quote?.driver_charge ?? quote?.suggested_price ?? 0);
  const estFee = Number(quote?.booking_fee ?? quote?.booking_fee_preview ?? 0);
  const estTotal = Number(quote?.customer_total ?? estDriver + estFee);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page testID="customer-asap-request">
        <View style={styles.header}>
          <IconButton onPress={() => nav.goBack()} testID="asap-back" accessibilityLabel="Back">
            <ChevronLeft size={20} color={colors.ink} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Zap size={20} color={colors.accent} />
              <Text style={typography.h1}>Request now — ASAP</Text>
            </View>
            <Text style={[typography.bodyMuted, { marginTop: 2 }]}>Find a nearby Cargo One driver in real time.</Text>
          </View>
          {showMenu ? (
            <Pressable onPress={openDrawer}>
              <View style={styles.menuLines}>
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
              </View>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          {/* Mode picker */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <ModeTile
              active={mode === "transport"}
              onPress={() => setMode("transport")}
              Icon={Truck}
              label="Transport"
              body="Urgent parcel, consignment or same-day movement"
              testID="asap-mode-transport"
            />
            <ModeTile
              active={mode === "breakdown_recovery"}
              onPress={() => setMode("breakdown_recovery")}
              Icon={AlertTriangle}
              label="Vehicle Recovery"
              body="Stranded vehicle, breakdown or recovery"
              testID="asap-mode-recovery"
            />
          </View>

          {/* Addresses */}
          <AddressAutocomplete label="Collection location" value={pickup} onSelect={setPickup} testID="asap-pickup" />
          <AddressAutocomplete label="Destination" value={dropoff} onSelect={setDropoff} testID="asap-dropoff" />

          {/* Route preview */}
          {pickup && dropoff ? (
            <RouteMap
              pickup={{ lat: pickup.lat, lng: pickup.lng }}
              dropoff={{ lat: dropoff.lat, lng: dropoff.lng }}
              summary={{
                pickupTown: pickup.town,
                dropoffTown: dropoff.town,
                distanceMiles: quote?.distance_miles,
                durationMinutes: quote?.duration_minutes,
              }}
            />
          ) : null}

          {/* Transport-mode extras */}
          {mode === "transport" ? (
            <View style={{ marginTop: 16 }}>
              <Label>
                What are you sending? <Text style={{ color: colors.brand }}>*</Text>
              </Label>
              <View style={styles.catChipGrid}>
                {TRANSPORT_CATS.map((o) => {
                  const active = transportCategory === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => setTransportCategory(o.value)}
                      testID={`asap-transport-category-${o.value}`}
                      style={[styles.catChip, active && styles.catChipActive]}
                    >
                      <Text style={[styles.catChipText, active && { color: "#FFFFFF" }]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Label>Description (optional)</Label>
              <Input
                value={transportDescription}
                onChangeText={setTransportDescription}
                placeholder="e.g. 3 boxes of glassware, ~30kg total"
                testID="asap-transport-description"
              />
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <View style={styles.recWarn}>
                <AlertTriangle size={16} color={"#B45309"} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#78350F" }}>Vehicle information</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Label>Make</Label>
                  <Input
                    value={vehicle.make}
                    onChangeText={(v) => setVehicle({ ...vehicle, make: v })}
                    placeholder="e.g. BMW"
                    testID="asap-vehicle-make"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>Model</Label>
                  <Input
                    value={vehicle.model}
                    onChangeText={(v) => setVehicle({ ...vehicle, model: v })}
                    placeholder="e.g. 3 Series"
                    testID="asap-vehicle-model"
                  />
                </View>
              </View>
              <Label>Registration (optional)</Label>
              <Input
                value={vehicle.registration}
                onChangeText={(v) => setVehicle({ ...vehicle, registration: v })}
                placeholder="AB12 CDE"
                autoCapitalize="characters"
                testID="asap-vehicle-reg"
              />
            </View>
          )}

          <Label>Anything the driver should know? (optional)</Label>
          <Input
            value={note}
            onChangeText={setNote}
            placeholder={
              mode === "breakdown_recovery"
                ? "e.g. Vehicle is on the hard shoulder / height restriction"
                : "e.g. Access restrictions, fragile items, urgent deadline"
            }
            testID="asap-note"
          />

          {/* Summary */}
          {pickup && dropoff ? (
            <View style={styles.summary} testID="asap-booking-summary">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={typography.micro}>Booking summary</Text>
                <View
                  style={[
                    styles.modePill,
                    mode === "breakdown_recovery" ? { backgroundColor: "#FEF3C7" } : { backgroundColor: "#DCFCE7" },
                  ]}
                  testID="asap-summary-service-type"
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: mode === "breakdown_recovery" ? "#92400E" : "#166534",
                    }}
                  >
                    {mode === "breakdown_recovery" ? "Vehicle Recovery" : "ASAP Transport"}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 8 }}>
                <SummaryRow label="From" value={pickup.town || pickup.formatted_address} />
                <SummaryRow label="To" value={dropoff.town || dropoff.formatted_address} />
                <SummaryRow
                  label="Distance"
                  value={
                    quoteLoading ? "Calculating…" : quote?.distance_miles != null ? `${quote.distance_miles} mi` : "—"
                  }
                />
                <SummaryRow
                  label="Est. driving time"
                  value={
                    quoteLoading
                      ? "Calculating…"
                      : quote?.duration_minutes != null
                      ? quote.duration_minutes < 60
                        ? `${Math.round(quote.duration_minutes)} min`
                        : `${Math.floor(quote.duration_minutes / 60)}h ${Math.round(quote.duration_minutes % 60)}m`
                      : "—"
                  }
                />
                <View style={styles.divider} />
                <SummaryRow
                  label="Total job price"
                  value={estTotal ? `£${estTotal.toFixed(2)}` : "—"}
                  big
                />
                <SummaryRow
                  label={feePercent != null ? `Booking fee (${Number(feePercent).toFixed(0)}%, paid now)` : "Booking fee (paid now)"}
                  value={estFee ? `£${estFee.toFixed(2)}` : "—"}
                />
              </View>
              <Text style={[typography.small, { marginTop: 8, lineHeight: 18 }]}>
                Prices are indicative. Your final fare is confirmed by the backend before payment.
              </Text>
            </View>
          ) : null}

          {err ? (
            <View style={styles.errBox} testID="asap-error">
              <Text style={{ color: colors.errorInk, fontSize: 13 }}>{err}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title={
              estFee
                ? `Confirm & pay £${estFee.toFixed(2)} deposit`
                : "Confirm & find driver"
            }
            onPress={onSubmit}
            disabled={!canSubmit || submitting}
            loading={submitting}
            testID="asap-submit"
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center", marginTop: 8 }}>
            <ShieldCheck size={12} color={colors.inkMuted} />
            <Text style={typography.small}>You pay the deposit now. We only start looking for a driver after payment.</Text>
          </View>
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}

function ModeTile({
  active,
  onPress,
  Icon,
  label,
  body,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  Icon: any;
  label: string;
  body: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[
        styles.modeTile,
        active && { backgroundColor: colors.ink, borderColor: colors.ink },
      ]}
    >
      <Icon size={20} color={active ? "#FFFFFF" : colors.ink} />
      <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#FFFFFF" : colors.ink, marginTop: 6 }}>{label}</Text>
      <Text style={{ fontSize: 11, color: active ? "rgba(255,255,255,0.7)" : colors.inkMuted, marginTop: 4, lineHeight: 15 }}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  menuLines: { gap: 4, width: 20, height: 20, justifyContent: "center" },
  menuLine: { width: 18, height: 2, backgroundColor: colors.ink, borderRadius: 2 },
  modeTile: {
    flex: 1,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  catChipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  catChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  catChipText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  recWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#F59E0B",
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  summary: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  modePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 8 },
  errBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: colors.errorBg,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
});
