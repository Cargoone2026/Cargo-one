/**
 * FleetScreen — Driver mobile port of frontend/src/pages/portal/driver/Fleet.jsx.
 *
 * List + detail/add form inline on a single screen (navigates to a
 * dedicated VehicleEdit screen for form editing, mirroring Customer's
 * modal-style flow). Uses DriverAPI.listVehicles / saveVehicle /
 * deleteVehicle and SharedAPI.vehicles for the vehicle-type catalog.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DriverAPI, type DriverVehicle } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import {
  Card, EmptyState, Icon, IconButton, Page, PageHeader, Section,
  colors, radius, space, typography,
} from "../ui";

export default function FleetScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<DriverVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await DriverAPI.listVehicles();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (v: DriverVehicle) => {
    Alert.alert(
      "Remove vehicle?",
      `Remove ${v.registration || "this vehicle"} from your fleet?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await DriverAPI.deleteVehicle(v.id);
              await load();
            } catch (e: any) {
              Alert.alert("Could not remove", e?.message || "Please try again.");
            }
          },
        },
      ],
    );
  };

  return (
    <Page
      testID="driver-fleet"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
    >
      <PageHeader
        title="My Fleet"
        subtitle="Register your vehicles so we can match you to the right jobs."
        large
        right={
          <IconButton
            testID="fleet-add"
            accessibilityLabel="Add vehicle"
            variant="solid"
            onPress={() => nav.navigate("VehicleEdit", {})}
          >
            <Icon name="plus" size={20} color="#FFFFFF" />
          </IconButton>
        }
      />
      <Section gap={space[3]}>
        {loading && items.length === 0 ? (
          <Text style={[typography.caption, { textAlign: "center", paddingVertical: space[6] }]}>
            Loading fleet…
          </Text>
        ) : items.length === 0 ? (
          <EmptyState
            glyph="truck"
            title="No vehicles yet"
            body="Tap the + button above to register your first vehicle."
            testID="fleet-empty"
          />
        ) : (
          items.map((v) => (
            <Card key={v.id} testID={`fleet-veh-${v.id}`}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text style={typography.strong} numberOfLines={1}>
                      {v.vehicle_type_name || v.vehicle_type_key || "Vehicle"}
                    </Text>
                    {v.is_default ? (
                      <View style={styles.defaultPill}>
                        <Icon name="star" size={11} color={colors.accentDark} />
                        <Text style={styles.defaultPillText}>Default</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[typography.caption, { marginTop: 4 }]}>
                    Reg: {v.registration || "—"}
                    {v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(" ")}` : ""}
                  </Text>
                  {v.capabilities && v.capabilities.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space[2] }}>
                      {v.capabilities.map((c) => (
                        <View key={c} style={styles.capChip}>
                          <Text style={styles.capChipText}>{c.replace(/_/g, " ")}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={[styles.statusPill, v.status === "active" ? styles.statusActive : styles.statusPending]}>
                  <Text style={[
                    styles.statusText,
                    { color: v.status === "active" ? colors.success : colors.warningInk },
                  ]}>
                    {v.status || "—"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
                <Pressable
                  onPress={() => nav.navigate("VehicleEdit", { vehicleId: v.id })}
                  testID={`fleet-edit-${v.id}`}
                  style={({ pressed }) => [styles.actionBtn, pressed && { backgroundColor: colors.bgSecondary }]}
                >
                  <Icon name="edit-2" size={14} color={colors.ink} />
                  <Text style={styles.actionBtnText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(v)}
                  testID={`fleet-remove-${v.id}`}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { borderColor: "#FCA5A5" },
                    pressed && { backgroundColor: "#FEF2F2" },
                  ]}
                >
                  <Icon name="trash-2" size={14} color={colors.errorInk} />
                  <Text style={[styles.actionBtnText, { color: colors.errorInk }]}>Remove</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </Section>
    </Page>
  );
}

const styles = {
  defaultPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
  },
  defaultPillText: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
    color: colors.accentDark,
    textTransform: "uppercase" as const,
  },
  capChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.bgSecondary,
  },
  capChipText: { fontSize: 11, color: colors.ink },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start" as const,
  },
  statusActive: { backgroundColor: colors.successBg },
  statusPending: { backgroundColor: colors.warningBg },
  statusText: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" as const, color: colors.ink },
} as const;
