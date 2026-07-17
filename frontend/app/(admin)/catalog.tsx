import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { invalidateCatalog } from "@/src/hooks/useCatalog";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Tab = "categories" | "vehicles" | "capabilities";

type Row = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  active: boolean;
  featured?: boolean;
  default_vehicles?: string[];
  typical_weight_kg?: number | null;
  typical_volume_m3?: number | null;
  max_weight_kg?: number;
  max_volume_m3?: number | null;
  features?: string[];
  capabilities?: string[];
};

const TAB_META: Record<Tab, { title: string; endpoint: string; itemLabel: string; addLabel: string }> = {
  categories:   { title: "Service Categories", endpoint: "/admin/catalog/categories",   itemLabel: "category",   addLabel: "Add Category" },
  vehicles:     { title: "Vehicle Types",       endpoint: "/admin/catalog/vehicles",     itemLabel: "vehicle",    addLabel: "Add Vehicle" },
  capabilities: { title: "Vehicle Capabilities",endpoint: "/admin/catalog/capabilities", itemLabel: "capability", addLabel: "Add Capability" },
};

export default function AdminCatalog() {
  const [tab, setTab] = useState<Tab>("categories");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: Row[] = await api(TAB_META[tab].endpoint);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRow = async (row: Row) => {
    const isNew = !row.id;
    const path = isNew
      ? TAB_META[tab].endpoint
      : `${TAB_META[tab].endpoint}/${row.id}`;
    await api(path, { method: isNew ? "POST" : "PUT", body: row });
    invalidateCatalog();
    setEditing(null);
    setCreating(false);
    await load();
  };

  const toggleActive = async (row: Row) => {
    await api(`${TAB_META[tab].endpoint}/${row.id}`, {
      method: "PUT",
      body: { ...row, active: !row.active },
    });
    invalidateCatalog();
    await load();
  };

  const toggleFeatured = async (row: Row) => {
    await api(`${TAB_META[tab].endpoint}/${row.id}`, {
      method: "PUT",
      body: { ...row, featured: !row.featured },
    });
    invalidateCatalog();
    await load();
  };

  const move = async (row: Row, dir: -1 | 1) => {
    const idx = rows.findIndex((r) => r.id === row.id);
    const other = rows[idx + dir];
    if (!other) return;
    await Promise.all([
      api(`${TAB_META[tab].endpoint}/${row.id}`, { method: "PUT", body: { ...row, order: other.order } }),
      api(`${TAB_META[tab].endpoint}/${other.id}`, { method: "PUT", body: { ...other, order: row.order } }),
    ]);
    invalidateCatalog();
    await load();
  };

  const deleteRow = async (row: Row) => {
    if (!window.confirm?.(`Delete ${TAB_META[tab].itemLabel} "${row.name}"?`)) return;
    await api(`${TAB_META[tab].endpoint}/${row.id}`, { method: "DELETE" });
    invalidateCatalog();
    await load();
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Catalogue</Text>
        <Text style={styles.sub}>Manage service categories, vehicle types and capabilities.</Text>
      </View>

      <View style={styles.tabs}>
        {(Object.keys(TAB_META) as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
            testID={`catalog-tab-${t}`}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{TAB_META[t].title}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.actionRow}>
          <Text style={styles.countText}>{rows.length} {TAB_META[tab].itemLabel}s</Text>
          <Pressable
            onPress={() => setCreating(true)}
            style={styles.addBtn}
            testID="catalog-add"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>{TAB_META[tab].addLabel}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: spacing.xl }} color={colors.brand} />
        ) : (
          <View style={styles.list}>
            {rows.map((row, i) => (
              <View key={row.id} style={[styles.row, !row.active && { opacity: 0.5 }]}>
                <View style={styles.iconWrap}>
                  <Ionicons name={row.icon as any} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowHeadLine}>
                    <Text style={styles.rowName}>{row.name}</Text>
                    <Text style={styles.rowKey}>{row.key}</Text>
                    {row.featured ? (
                      <View style={styles.featuredBadge}>
                        <Ionicons name="star" size={10} color="#fff" />
                        <Text style={styles.featuredText}>Featured</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowDesc} numberOfLines={2}>{row.description || "—"}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => move(row, -1)} disabled={i === 0} style={[styles.iconBtn, i === 0 && { opacity: 0.3 }]}>
                    <Ionicons name="chevron-up" size={16} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => move(row, 1)} disabled={i === rows.length - 1} style={[styles.iconBtn, i === rows.length - 1 && { opacity: 0.3 }]}>
                    <Ionicons name="chevron-down" size={16} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => toggleFeatured(row)} style={styles.iconBtn}>
                    <Ionicons name={row.featured ? "star" : "star-outline"} size={16} color={row.featured ? colors.brand : colors.textSecondary} />
                  </Pressable>
                  <Switch value={row.active} onValueChange={() => toggleActive(row)} />
                  <Pressable onPress={() => setEditing(row)} style={styles.iconBtn}>
                    <Ionicons name="create-outline" size={18} color={colors.text} />
                  </Pressable>
                  <Pressable onPress={() => deleteRow(row)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {(editing || creating) && (
        <EditorModal
          tab={tab}
          row={editing || undefined}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={saveRow}
        />
      )}
    </SafeAreaView>
  );
}

function EditorModal({
  tab,
  row,
  onCancel,
  onSave,
}: {
  tab: Tab;
  row?: Row;
  onCancel: () => void;
  onSave: (row: Row) => Promise<void>;
}) {
  const [name, setName] = useState(row?.name || "");
  const [key, setKey] = useState(row?.key || "");
  const [description, setDescription] = useState(row?.description || "");
  const [icon, setIcon] = useState(row?.icon || (tab === "vehicles" ? "car" : "cube"));
  const [order, setOrder] = useState(String(row?.order ?? 999));
  const [active, setActive] = useState(row?.active ?? true);
  const [featured, setFeatured] = useState(row?.featured ?? false);
  const [maxWeight, setMaxWeight] = useState(row?.max_weight_kg != null ? String(row.max_weight_kg) : "");
  const [maxVolume, setMaxVolume] = useState(row?.max_volume_m3 != null ? String(row.max_volume_m3) : "");
  const [typicalWeight, setTypicalWeight] = useState(row?.typical_weight_kg != null ? String(row.typical_weight_kg) : "");
  const [typicalVolume, setTypicalVolume] = useState(row?.typical_volume_m3 != null ? String(row.typical_volume_m3) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: any = {
        id: row?.id,
        key: key.trim() || undefined,
        name: name.trim(),
        description: description.trim(),
        icon: icon.trim(),
        order: Number(order || 0),
        active,
        featured,
      };
      if (tab === "categories") {
        payload.typical_weight_kg = typicalWeight ? Number(typicalWeight) : null;
        payload.typical_volume_m3 = typicalVolume ? Number(typicalVolume) : null;
        payload.default_vehicles = row?.default_vehicles || [];
      } else if (tab === "vehicles") {
        payload.max_weight_kg = maxWeight ? Number(maxWeight) : 0;
        payload.max_volume_m3 = maxVolume ? Number(maxVolume) : null;
        payload.capabilities = row?.capabilities || [];
        payload.features = row?.features || [];
      }
      await onSave(payload);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{row ? "Edit" : "Create"} {TAB_META[tab].itemLabel}</Text>
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: spacing.md }}>
            <Field label="Name" value={name} onChange={setName} placeholder="Display name" />
            <Field label="Key (slug)" value={key} onChange={setKey} placeholder="auto if blank" disabled={!!row} />
            <Field label="Description" value={description} onChange={setDescription} placeholder="Short description" multiline />
            <Field label="Icon (Ionicons name)" value={icon} onChange={setIcon} placeholder="e.g. cube" />
            <Field label="Display order" value={order} onChange={setOrder} placeholder="0" keyboardType="numeric" />

            {tab === "categories" && (
              <>
                <Field label="Typical weight (kg)" value={typicalWeight} onChange={setTypicalWeight} placeholder="e.g. 500" keyboardType="numeric" />
                <Field label="Typical volume (m³)" value={typicalVolume} onChange={setTypicalVolume} placeholder="e.g. 3" keyboardType="numeric" />
              </>
            )}
            {tab === "vehicles" && (
              <>
                <Field label="Max weight (kg)" value={maxWeight} onChange={setMaxWeight} placeholder="e.g. 3000" keyboardType="numeric" />
                <Field label="Max volume (m³)" value={maxVolume} onChange={setMaxVolume} placeholder="e.g. 22" keyboardType="numeric" />
              </>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch value={active} onValueChange={setActive} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Featured</Text>
              <Switch value={featured} onValueChange={setFeatured} />
            </View>
            {err ? <Text style={{ color: colors.error, marginTop: spacing.xs }}>{err}</Text> : null}
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Button title={saving ? "Saving…" : "Save"} onPress={submit} disabled={!name.trim() || saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.field, multiline && { minHeight: 70, textAlignVertical: "top", paddingTop: spacing.sm }, disabled && { opacity: 0.5 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={!disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  title: { fontSize: 26, fontWeight: weight.bold, color: colors.text },
  sub: { color: colors.textSecondary, marginTop: spacing.xs },

  tabs: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.bgSecondary },
  tabActive: { backgroundColor: colors.text },
  tabText: { color: colors.textSecondary, fontWeight: weight.semibold, fontSize: font.sm },
  tabTextActive: { color: "#fff" },

  scroll: { padding: spacing.xl, paddingTop: 0 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  countText: { color: colors.textSecondary, fontSize: font.sm },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
  },
  addBtnText: { color: "#fff", fontWeight: weight.bold, fontSize: font.sm },

  list: { gap: spacing.sm },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, backgroundColor: "#fff", borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  rowHeadLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  rowName: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  rowKey: { fontSize: 11, color: colors.textSecondary, fontFamily: "monospace" as any },
  rowDesc: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBtn: { padding: 6 },
  featuredBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: spacing.xs, paddingVertical: 2,
    borderRadius: radius.pill, backgroundColor: colors.brand,
  },
  featuredText: { color: "#fff", fontSize: 10, fontWeight: weight.bold },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.md },
  modalCard: { backgroundColor: "#fff", borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 500, gap: spacing.md },
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
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  switchLabel: { fontSize: font.base, color: colors.text, fontWeight: weight.medium },
});
