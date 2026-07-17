import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { VehicleCapability, VehicleType, useCapabilities, useVehicles } from "@/src/hooks/useCatalog";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type DriverVehicle = {
  id?: string;
  vehicle_type_key: string;
  vehicle_type_name?: string;
  registration: string;
  make?: string;
  model?: string;
  year?: number | null;
  payload_kg?: number | null;
  max_weight_kg?: number | null;
  internal_length_m?: number | null;
  internal_width_m?: number | null;
  internal_height_m?: number | null;
  capabilities?: string[];
  insurance_expiry?: string | null;
  mot_expiry?: string | null;
  photos?: string[];
  is_default?: boolean;
  status?: string;
};

export default function DriverFleet() {
  const { data: vehicles } = useVehicles();
  const { data: capabilities } = useCapabilities();
  const [items, setItems] = useState<DriverVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DriverVehicle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: DriverVehicle[] = await api("/driver/vehicles");
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (v: DriverVehicle) => {
    const path = v.id ? `/driver/vehicles/${v.id}` : "/driver/vehicles";
    await api(path, { method: v.id ? "PUT" : "POST", body: v });
    setEditing(null);
    await load();
  };

  const remove = async (v: DriverVehicle) => {
    if (!v.id) return;
    if (!window.confirm?.(`Remove ${v.registration} from your fleet?`)) return;
    await api(`/driver/vehicles/${v.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Fleet</Text>
          <Text style={styles.sub}>Register your vehicles so we can match you to the right jobs.</Text>
        </View>
        <Pressable
          onPress={() =>
            setEditing({ vehicle_type_key: vehicles[0]?.key || "", registration: "", capabilities: [], photos: [] })
          }
          style={styles.addBtn}
          testID="fleet-add"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Vehicle</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No vehicles yet</Text>
            <Text style={styles.emptyBody}>Add your first vehicle to start receiving matched jobs.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {items.map((v) => (
              <View key={v.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="car-sport" size={22} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHead}>
                      <Text style={styles.regText}>{v.registration}</Text>
                      {v.is_default ? (
                        <View style={styles.defaultBadge}>
                          <Ionicons name="star" size={10} color="#fff" />
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.subText}>
                      {v.vehicle_type_name} • {[v.make, v.model, v.year].filter(Boolean).join(" ")}
                    </Text>
                  </View>
                  <Pressable onPress={() => setEditing(v)} style={styles.iconBtn}>
                    <Ionicons name="create-outline" size={20} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => remove(v)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>

                <View style={styles.chipRow}>
                  {(v.capabilities || []).slice(0, 6).map((c) => {
                    const cap = capabilities.find((x) => x.key === c);
                    return (
                      <View key={c} style={styles.chip}>
                        <Ionicons name={(cap?.icon || "checkmark-circle") as any} size={12} color={colors.brand} />
                        <Text style={styles.chipText}>{cap?.name || c}</Text>
                      </View>
                    );
                  })}
                  {(v.capabilities?.length || 0) > 6 ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>+{(v.capabilities?.length || 0) - 6}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.metaRow}>
                  <MetaItem icon="scale" label="Payload" value={v.payload_kg ? `${v.payload_kg} kg` : "—"} />
                  <MetaItem icon="calendar" label="Insurance" value={v.insurance_expiry || "—"} warn={isExpiringSoon(v.insurance_expiry)} />
                  <MetaItem icon="shield-checkmark" label="MOT" value={v.mot_expiry || "—"} warn={isExpiringSoon(v.mot_expiry)} />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {editing && (
        <VehicleEditor
          vehicle={editing}
          vehicleTypes={vehicles}
          capabilities={capabilities}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </SafeAreaView>
  );
}

function VehicleEditor({
  vehicle,
  vehicleTypes,
  capabilities,
  onSave,
  onCancel,
}: {
  vehicle: DriverVehicle;
  vehicleTypes: VehicleType[];
  capabilities: VehicleCapability[];
  onSave: (v: DriverVehicle) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState<DriverVehicle>({ ...vehicle });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleCap = (key: string) => {
    const set = new Set(v.capabilities || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    setV({ ...v, capabilities: Array.from(set) });
  };

  const submit = async () => {
    if (!v.registration.trim() || !v.vehicle_type_key) {
      setErr("Vehicle type and registration are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave({
        ...v,
        registration: v.registration.trim().toUpperCase(),
        year: v.year ? Number(v.year) : null,
        payload_kg: v.payload_kg ? Number(v.payload_kg) : null,
        max_weight_kg: v.max_weight_kg ? Number(v.max_weight_kg) : null,
        internal_length_m: v.internal_length_m ? Number(v.internal_length_m) : null,
        internal_width_m: v.internal_width_m ? Number(v.internal_width_m) : null,
        internal_height_m: v.internal_height_m ? Number(v.internal_height_m) : null,
      });
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{vehicle.id ? "Edit Vehicle" : "Add Vehicle"}</Text>
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: spacing.md }}>
            {/* Vehicle type picker */}
            <View>
              <Text style={styles.fieldLabel}>Vehicle type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: spacing.xs }}>
                  {vehicleTypes.map((vt) => (
                    <Pressable
                      key={vt.key}
                      onPress={() => setV({ ...v, vehicle_type_key: vt.key })}
                      style={[styles.typeChip, v.vehicle_type_key === vt.key && styles.typeChipActive]}
                    >
                      <Ionicons name={vt.icon as any} size={14} color={v.vehicle_type_key === vt.key ? "#fff" : colors.text} />
                      <Text style={[styles.typeChipText, v.vehicle_type_key === vt.key && { color: "#fff" }]}>
                        {vt.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <F label="Registration" value={v.registration} onChange={(x) => setV({ ...v, registration: x })} placeholder="e.g. AB12 XYZ" />
            <View style={styles.row2}>
              <F label="Make" value={v.make || ""} onChange={(x) => setV({ ...v, make: x })} placeholder="Ford" />
              <F label="Model" value={v.model || ""} onChange={(x) => setV({ ...v, model: x })} placeholder="Transit" />
            </View>
            <View style={styles.row2}>
              <F label="Year" value={String(v.year || "")} onChange={(x) => setV({ ...v, year: x as any })} placeholder="2022" keyboardType="numeric" />
              <F label="Payload (kg)" value={String(v.payload_kg || "")} onChange={(x) => setV({ ...v, payload_kg: x as any })} placeholder="1200" keyboardType="numeric" />
            </View>

            <Text style={styles.fieldLabel}>Internal dimensions (m)</Text>
            <View style={styles.row3}>
              <F label="L" value={String(v.internal_length_m || "")} onChange={(x) => setV({ ...v, internal_length_m: x as any })} keyboardType="numeric" placeholder="4.0" />
              <F label="W" value={String(v.internal_width_m || "")} onChange={(x) => setV({ ...v, internal_width_m: x as any })} keyboardType="numeric" placeholder="1.8" />
              <F label="H" value={String(v.internal_height_m || "")} onChange={(x) => setV({ ...v, internal_height_m: x as any })} keyboardType="numeric" placeholder="1.9" />
            </View>

            <View style={styles.row2}>
              <F label="Insurance expiry" value={v.insurance_expiry || ""} onChange={(x) => setV({ ...v, insurance_expiry: x })} placeholder="YYYY-MM-DD" />
              <F label="MOT expiry" value={v.mot_expiry || ""} onChange={(x) => setV({ ...v, mot_expiry: x })} placeholder="YYYY-MM-DD" />
            </View>

            <Text style={styles.fieldLabel}>Capabilities</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {capabilities.map((c) => {
                const active = (v.capabilities || []).includes(c.key);
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => toggleCap(c.key)}
                    style={[styles.capChip, active && styles.capChipActive]}
                  >
                    <Ionicons name={c.icon as any} size={12} color={active ? "#fff" : colors.text} />
                    <Text style={[styles.capChipText, active && { color: "#fff" }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Set as default vehicle</Text>
              <Switch value={!!v.is_default} onValueChange={(x) => setV({ ...v, is_default: x })} />
            </View>

            {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Button title={saving ? "Saving…" : "Save"} onPress={submit} disabled={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function F({
  label, value, onChange, placeholder, keyboardType,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: any }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.field}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function MetaItem({ icon, label, value, warn }: { icon: any; label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={warn ? "#F59E0B" : colors.textSecondary} />
      <View>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={[styles.metaValue, warn && { color: "#F59E0B" }]}>{value}</Text>
      </View>
    </View>
  );
}

function isExpiringSoon(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const ms = d.getTime() - Date.now();
  return ms > 0 && ms < 60 * 24 * 60 * 60 * 1000; // <60 days
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.xl, flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { fontSize: 26, fontWeight: weight.bold, color: colors.text },
  sub: { color: colors.textSecondary, marginTop: 4 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
  },
  addBtnText: { color: "#fff", fontWeight: weight.bold, fontSize: font.sm },

  scroll: { padding: spacing.xl, paddingTop: 0 },

  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  emptyBody: { color: colors.textSecondary, textAlign: "center" },

  card: {
    backgroundColor: "#fff", borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  regText: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text, letterSpacing: 1 },
  subText: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  defaultBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  defaultBadgeText: { color: "#fff", fontSize: 10, fontWeight: weight.bold },
  iconBtn: { padding: 6 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.brandLight,
  },
  chipText: { color: colors.brand, fontSize: 11, fontWeight: weight.semibold },

  metaRow: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { fontSize: 10, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: font.sm, color: colors.text, fontWeight: weight.medium },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.md },
  modalCard: { backgroundColor: "#fff", borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 560, gap: spacing.md },
  modalTitle: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  modalActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cancelText: { color: colors.textSecondary, fontWeight: weight.semibold },

  fieldLabel: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.text, marginBottom: 4 },
  field: {
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, height: 40, borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: font.base,
  },
  row2: { flexDirection: "row", gap: spacing.md },
  row3: { flexDirection: "row", gap: spacing.sm },

  typeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  typeChipText: { color: colors.text, fontSize: font.sm, fontWeight: weight.medium },

  capChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border },
  capChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  capChipText: { color: colors.text, fontSize: 11, fontWeight: weight.medium },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  switchLabel: { fontSize: font.base, color: colors.text, fontWeight: weight.medium },
});
