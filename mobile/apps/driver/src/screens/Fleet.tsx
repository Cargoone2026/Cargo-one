/**
 * FleetScreen — driver vehicle management. Ports the structure of
 * frontend/src/pages/portal/driver/Fleet.jsx.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Plus, Truck, Trash2, X } from "lucide-react-native";
import { DriverAPI, SharedAPI } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { EmptyState, Input, Label, Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";
import { useShellMenu } from "../components/AppShell";

interface Vehicle {
  id?: string;
  key?: string;
  make?: string;
  model?: string;
  reg?: string;
  year?: number;
  default?: boolean;
}

export function FleetScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { openDrawer, showMenu } = useShellMenu();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [rows, cat] = await Promise.all([DriverAPI.listVehicles(), SharedAPI.vehicles()]);
      setVehicles(Array.isArray(rows) ? rows : []);
      setCatalog(Array.isArray(cat) ? cat : []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await DriverAPI.saveVehicle(editing as any);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert("Could not save", e?.message || "");
    } finally {
      setSaving(false);
    }
  }

  async function remove(v: Vehicle) {
    if (!v.id) return;
    Alert.alert("Delete vehicle?", `Remove ${v.make || ""} ${v.model || ""} from your fleet?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await DriverAPI.deleteVehicle(v.id!);
            load();
          } catch (e: any) {
            Alert.alert("Could not delete", e?.message || "");
          }
        },
      },
    ]);
  }

  return (
    <Page testID="driver-fleet">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}>
        <PageHeader
          large
          title="My fleet"
          subtitle="Register or edit the vehicles you can use for Cargo One jobs."
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <PrimaryButton title="Add vehicle" onPress={() => setEditing({})} testID="fleet-add" />
          {vehicles.length === 0 ? (
            <EmptyState Icon={Truck} title="No vehicles yet" body="Add at least one vehicle to accept jobs." />
          ) : (
            vehicles.map((v) => (
              <View key={v.id} style={styles.card} testID={`vehicle-${v.id}`}>
                <View style={styles.iconWrap}>
                  <Truck size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.cardTitle}>
                    {v.make || "Vehicle"} {v.model || ""}
                  </Text>
                  <Text style={[typography.caption, { marginTop: 2 }]}>
                    {v.reg || "—"} · {catalog.find((c: any) => c.key === v.key)?.name || v.key || "Uncategorised"}
                  </Text>
                </View>
                <Pressable onPress={() => setEditing(v)} hitSlop={8} testID={`vehicle-edit-${v.id}`}>
                  <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 13 }}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => remove(v)} hitSlop={8} testID={`vehicle-delete-${v.id}`} style={{ marginLeft: 8 }}>
                  <Trash2 size={18} color={colors.errorInk} />
                </Pressable>
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
              <Pressable onPress={() => setEditing(null)} hitSlop={8} testID="vehicle-close">
                <X size={20} color={colors.ink} />
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <Label>Vehicle category</Label>
            <Input
              value={editing?.key || ""}
              onChangeText={(v) => setEditing((cur) => ({ ...(cur || {}), key: v }))}
              placeholder="small_van, luton, hgv…"
              autoCapitalize="none"
              testID="vehicle-key"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Label>Make</Label>
                <Input
                  value={editing?.make || ""}
                  onChangeText={(v) => setEditing((cur) => ({ ...(cur || {}), make: v }))}
                  testID="vehicle-make"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label>Model</Label>
                <Input
                  value={editing?.model || ""}
                  onChangeText={(v) => setEditing((cur) => ({ ...(cur || {}), model: v }))}
                  testID="vehicle-model"
                />
              </View>
            </View>
            <Label>Registration</Label>
            <Input
              value={editing?.reg || ""}
              onChangeText={(v) => setEditing((cur) => ({ ...(cur || {}), reg: v }))}
              autoCapitalize="characters"
              testID="vehicle-reg"
            />
            <View style={{ marginTop: 20, gap: 8 }}>
              <PrimaryButton title={saving ? "Saving…" : editing?.id ? "Save changes" : "Add vehicle"} onPress={save} loading={saving} testID="vehicle-save" />
              <SecondaryButton title="Cancel" onPress={() => setEditing(null)} testID="vehicle-cancel" />
            </View>
          </ScrollView>
        </Page>
      </Modal>
    </Page>
  );
}

const styles = {
  card: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
