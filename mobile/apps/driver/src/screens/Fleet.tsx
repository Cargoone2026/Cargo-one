/**
 * FleetScreen — driver vehicle management.
 *
 * R71.16.10 (Driver P2) — full parity port of
 * `frontend/src/pages/portal/driver/Fleet.jsx`. Field names match the
 * backend (`vehicle_type_key`, `registration`, `capabilities`,
 * `payload_kg`, `year`, `is_default`) rather than the previous
 * placeholder-shaped state.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Plus, Star, Trash2, Truck, X } from "lucide-react-native";
import { DriverAPI, DriverVehicle, SharedAPI } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { EmptyState, Input, Label, Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";
import { useShellMenu } from "../components/AppShell";

interface EditingVehicle extends Partial<DriverVehicle> {
  payload_kg?: number | null;
}

export function FleetScreen() {
  const [vehicles, setVehicles] = useState<DriverVehicle[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [caps, setCaps] = useState<any[]>([]);
  const [editing, setEditing] = useState<EditingVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const { openDrawer, showMenu } = useShellMenu();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [rows, catTypes, catCaps] = await Promise.all([
        DriverAPI.listVehicles(),
        SharedAPI.vehicles(),
        DriverAPI.capabilities(),
      ]);
      setVehicles(Array.isArray(rows) ? rows : []);
      setTypes(Array.isArray(catTypes) ? catTypes : []);
      setCaps(Array.isArray(catCaps) ? catCaps : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    if (!editing.vehicle_type_key || !editing.registration?.trim()) {
      setSaveErr("Vehicle type and registration are required.");
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      await DriverAPI.saveVehicle(editing as any);
      setEditing(null);
      load(true);
    } catch (e: any) {
      setSaveErr(e?.message || "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  }

  async function remove(v: DriverVehicle) {
    if (!v.id) return;
    Alert.alert(
      "Remove vehicle?",
      `Remove ${v.registration || v.vehicle_type_name || "this vehicle"} from your fleet?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await DriverAPI.deleteVehicle(v.id!);
              load(true);
            } catch (e: any) {
              Alert.alert("Could not remove", e?.message || "");
            }
          },
        },
      ],
    );
  }

  const openNew = () =>
    setEditing({
      vehicle_type_key: types[0]?.key || "",
      registration: "",
      capabilities: [],
    });

  const toggleCap = (k: string) =>
    setEditing((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.capabilities || []);
      if (set.has(k)) set.delete(k);
      else set.add(k);
      return { ...prev, capabilities: Array.from(set) };
    });

  return (
    <Page testID="driver-fleet" scroll={false}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />
        }
      >
        <PageHeader
          large
          title="My fleet"
          subtitle="Register or edit the vehicles you can use for Cargo One jobs."
          showMenu={showMenu}
          onMenuPress={openDrawer}
          right={
            <Pressable
              onPress={openNew}
              testID="fleet-add"
              accessibilityLabel="Add vehicle"
              style={({ pressed }) => [
                styles.fab,
                pressed && { backgroundColor: colors.brandDark },
              ]}
            >
              <Plus size={20} color="#FFFFFF" />
            </Pressable>
          }
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          {loading && vehicles.length === 0 ? (
            <Text style={typography.caption}>Loading fleet…</Text>
          ) : vehicles.length === 0 ? (
            <EmptyState
              Icon={Truck}
              title="No vehicles yet"
              body="Tap the + button to register your first vehicle."
              testID="fleet-empty"
            />
          ) : (
            vehicles.map((v) => (
              <View key={v.id} style={styles.card} testID={`fleet-veh-${v.id}`}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={typography.cardTitle}>
                        {v.vehicle_type_name || v.vehicle_type_key || "Vehicle"}
                      </Text>
                      {v.is_default ? (
                        <View style={styles.defaultPill}>
                          <Star size={10} color={colors.accentDark} />
                          <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5, color: colors.accentDark }}>
                            DEFAULT
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[typography.caption, { marginTop: 2 }]}>
                      Reg: {v.registration || "—"}
                      {v.make || v.model ? ` · ${v.make || ""} ${v.model || ""}`.trim() : ""}
                    </Text>
                    {v.capabilities && v.capabilities.length > 0 ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {v.capabilities.map((c) => (
                          <View key={c} style={styles.capChip}>
                            <Text style={{ fontSize: 11, color: colors.ink }}>{c.replace(/_/g, " ")}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: v.status === "active" ? colors.successBg : colors.warningBg },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        letterSpacing: 0.5,
                        color: v.status === "active" ? colors.successInk : colors.warningInk,
                      }}
                    >
                      {(v.status || "PENDING").toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => setEditing({ ...v })}
                    testID={`fleet-edit-${v.id}`}
                    style={({ pressed }) => [styles.actionBtn, pressed && { backgroundColor: colors.bgSecondary }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => remove(v)}
                    testID={`fleet-remove-${v.id}`}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { flexDirection: "row", gap: 6 },
                      pressed && { backgroundColor: "#FEF2F2" },
                    ]}
                  >
                    <Trash2 size={14} color={colors.error} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.error }}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <Page bg={colors.bg}>
          <PageHeader
            title={editing?.id ? "Edit vehicle" : "Add vehicle"}
            right={
              <Pressable onPress={() => setEditing(null)} hitSlop={8} testID="fleet-modal-close">
                <X size={22} color={colors.ink} />
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <Label>Vehicle type</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {types.map((t: any) => {
                const on = editing?.vehicle_type_key === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() =>
                      setEditing((cur) => (cur ? { ...cur, vehicle_type_key: t.key, vehicle_type_name: t.name } : cur))
                    }
                    testID={`fleet-vehicle-type-${t.key}`}
                    style={[
                      styles.typeChip,
                      on ? { backgroundColor: colors.ink } : { backgroundColor: colors.bgSecondary },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#FFFFFF" : colors.ink }}>
                      {t.name || t.key}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Label>Registration</Label>
            <Input
              value={editing?.registration || ""}
              onChangeText={(v) => setEditing((cur) => (cur ? { ...cur, registration: v.toUpperCase() } : cur))}
              placeholder="AB12 CDE"
              autoCapitalize="characters"
              testID="fleet-registration"
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Label>Make</Label>
                <Input
                  value={editing?.make || ""}
                  onChangeText={(v) => setEditing((cur) => (cur ? { ...cur, make: v } : cur))}
                  testID="fleet-make"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label>Model</Label>
                <Input
                  value={editing?.model || ""}
                  onChangeText={(v) => setEditing((cur) => (cur ? { ...cur, model: v } : cur))}
                  testID="fleet-model"
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Label>Year</Label>
                <Input
                  value={editing?.year ? String(editing.year) : ""}
                  onChangeText={(v) => setEditing((cur) => (cur ? { ...cur, year: Number(v) || undefined } : cur))}
                  keyboardType="number-pad"
                  testID="fleet-year"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label>Payload (kg)</Label>
                <Input
                  value={editing?.payload_kg ? String(editing.payload_kg) : ""}
                  onChangeText={(v) =>
                    setEditing((cur) => (cur ? { ...cur, payload_kg: Number(v) || null } : cur))
                  }
                  keyboardType="number-pad"
                  testID="fleet-payload"
                />
              </View>
            </View>

            {caps.length > 0 ? (
              <>
                <Label>Capabilities</Label>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {caps.map((c: any) => {
                    const on = (editing?.capabilities || []).includes(c.key);
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => toggleCap(c.key)}
                        testID={`fleet-cap-${c.key}`}
                        style={[
                          styles.typeChip,
                          on ? { backgroundColor: colors.ink } : { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#FFFFFF" : colors.ink }}>
                          {c.name || c.key}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Pressable
              onPress={() =>
                setEditing((cur) => (cur ? { ...cur, is_default: !cur.is_default } : cur))
              }
              testID="fleet-default"
              style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: editing?.is_default ? colors.brand : colors.border,
                  backgroundColor: editing?.is_default ? colors.brand : colors.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {editing?.is_default ? <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>✓</Text> : null}
              </View>
              <Text style={{ fontSize: 13, color: colors.ink }}>Set as default vehicle</Text>
            </Pressable>

            {saveErr ? (
              <Text style={{ marginTop: 12, fontSize: 13, color: colors.error }} testID="fleet-modal-error">
                {saveErr}
              </Text>
            ) : null}

            <View style={{ marginTop: 24, gap: 8 }}>
              <PrimaryButton
                title={editing?.id ? "Save changes" : "Add vehicle"}
                onPress={save}
                loading={saving}
                testID="fleet-modal-save"
              />
              <SecondaryButton
                title="Cancel"
                onPress={() => setEditing(null)}
                testID="fleet-modal-cancel"
              />
            </View>
          </ScrollView>
        </Page>
      </Modal>
    </Page>
  );
}

const styles = {
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  card: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  defaultPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  capChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 10,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
};
