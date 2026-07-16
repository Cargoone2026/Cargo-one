import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Band = {
  id: string;
  min_price: number;
  max_price: number | null;
  deposit_amount: number;
  enabled: boolean;
  label?: string | null;
};

function fmtRange(b: Band) {
  const min = `£${b.min_price.toFixed(2)}`;
  const max = b.max_price != null ? `£${b.max_price.toFixed(2)}` : "∞";
  return `${min} — ${max}`;
}

export default function DepositBandsScreen() {
  const router = useRouter();
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Band | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  // Preview calculator
  const [previewPrice, setPreviewPrice] = useState("500");
  const [previewResult, setPreviewResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<Band[]>("/admin/deposit-bands");
      setBands(list);
    } finally {
      setLoading(false);
    }
  }, []);

  const preview = useCallback(async () => {
    const p = Number(previewPrice);
    if (Number.isNaN(p) || p < 0) {
      setPreviewResult(null);
      return;
    }
    try {
      const r = await api(`/deposit-bands/preview?price=${p}`);
      setPreviewResult(r);
    } catch {
      setPreviewResult(null);
    }
  }, [previewPrice]);

  useFocusEffect(useCallback(() => { load(); preview(); }, [load, preview]));

  function openCreate() {
    setEditing({
      id: "",
      min_price: 0,
      max_price: null,
      deposit_amount: 0,
      enabled: true,
      label: "",
    });
    setShowEditor(true);
  }

  function openEdit(b: Band) {
    setEditing({ ...b });
    setShowEditor(true);
  }

  async function toggleEnabled(b: Band) {
    await api(`/admin/deposit-bands/${b.id}`, {
      method: "PUT",
      body: {
        min_price: b.min_price,
        max_price: b.max_price,
        deposit_amount: b.deposit_amount,
        enabled: !b.enabled,
        label: b.label,
      },
    });
    load();
    preview();
  }

  async function saveBand(b: Band) {
    const body = {
      min_price: b.min_price,
      max_price: b.max_price,
      deposit_amount: b.deposit_amount,
      enabled: b.enabled,
      label: b.label || null,
    };
    if (b.id) {
      await api(`/admin/deposit-bands/${b.id}`, { method: "PUT", body });
    } else {
      await api("/admin/deposit-bands", { method: "POST", body });
    }
    setShowEditor(false);
    setEditing(null);
    load();
    preview();
  }

  async function deleteBand(b: Band) {
    await api(`/admin/deposit-bands/${b.id}`, { method: "DELETE" });
    setShowEditor(false);
    setEditing(null);
    load();
    preview();
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="bands-back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Fee Bands</Text>
        <Pressable onPress={openCreate} hitSlop={12} testID="bands-add-button">
          <Ionicons name="add" size={26} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={bands}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View>
            <View style={styles.intro}>
              <Ionicons name="information-circle" size={22} color={colors.info} />
              <Text style={styles.introText}>
                Configure Cargo One&apos;s booking fee tiers. The fee is added on top of the driver&apos;s bid; the first enabled band matching the driver&apos;s charge is applied.
              </Text>
            </View>

            <View style={styles.calcCard} testID="deposit-preview-card">
              <Text style={styles.calcTitle}>Live Preview</Text>
              <View style={styles.calcRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calcLabel}>Driver charge (£)</Text>
                  <View style={styles.calcInputWrap}>
                    <Input
                      value={previewPrice}
                      onChangeText={setPreviewPrice}
                      keyboardType="numeric"
                      placeholder="500"
                      testID="preview-price-input"
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                </View>
                <Button
                  title="Calculate"
                  small
                  onPress={preview}
                  fullWidth={false}
                  testID="preview-calc-button"
                  style={{ marginTop: 20 }}
                />
              </View>
              {previewResult && (
                <View style={styles.calcResult}>
                  <View style={styles.calcResultRow}>
                    <Text style={styles.calcResultLabel}>Driver receives</Text>
                    <Text style={styles.calcResultBalance}>
                      £{Number(previewResult.driver_charge ?? previewResult.balance_due).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.calcResultRow}>
                    <Text style={styles.calcResultLabel}>Cargo One Booking Fee</Text>
                    <Text style={styles.calcResultDeposit}>
                      £{Number(previewResult.booking_fee ?? previewResult.deposit_amount).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.calcResultRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 8 }]}>
                    <Text style={styles.calcResultLabel}>Customer pays total</Text>
                    <Text style={styles.calcResultBalance}>
                      £{Number(previewResult.customer_total ?? previewResult.total_price).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>All Bands ({bands.length})</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No bands configured</Text>
            <Text style={styles.emptySub}>Tap + to create your first tier.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.bandCard, !item.enabled && styles.bandCardDisabled]}
            onPress={() => openEdit(item)}
            testID={`band-${item.id}`}
          >
            <View style={styles.bandHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bandLabel}>{item.label || "Tier"}</Text>
                <Text style={styles.bandRange}>{fmtRange(item)}</Text>
              </View>
              <Switch
                value={item.enabled}
                onValueChange={() => toggleEnabled(item)}
                trackColor={{ false: colors.borderStrong, true: colors.brand }}
                thumbColor="#fff"
                testID={`band-toggle-${item.id}`}
              />
            </View>
            <View style={styles.bandFoot}>
              <View>
                <Text style={styles.depositLabel}>Booking Fee</Text>
                <Text style={styles.depositValue}>£{item.deposit_amount.toFixed(2)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </Pressable>
        )}
      />

      {/* Editor Modal */}
      <Modal
        visible={showEditor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditor(false)}
      >
        {editing && (
          <BandEditor
            band={editing}
            onSave={saveBand}
            onDelete={editing.id ? deleteBand : undefined}
            onCancel={() => { setShowEditor(false); setEditing(null); }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function BandEditor({
  band,
  onSave,
  onDelete,
  onCancel,
}: {
  band: Band;
  onSave: (b: Band) => Promise<void>;
  onDelete?: (b: Band) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(band.label || "");
  const [minP, setMinP] = useState(String(band.min_price));
  const [maxP, setMaxP] = useState(band.max_price != null ? String(band.max_price) : "");
  const [deposit, setDeposit] = useState(String(band.deposit_amount));
  const [enabled, setEnabled] = useState(band.enabled);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const min = Number(minP);
    const max = maxP.trim() === "" ? null : Number(maxP);
    const dep = Number(deposit);
    if (Number.isNaN(min) || Number.isNaN(dep) || min < 0 || dep < 0) {
      setErr("Values must be non-negative numbers");
      return;
    }
    if (max !== null && (Number.isNaN(max) || max <= min)) {
      setErr("Max price must be greater than min price");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...band,
        label,
        min_price: min,
        max_price: max,
        deposit_amount: dep,
        enabled,
      });
    } catch (e: any) {
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onCancel} hitSlop={12} testID="editor-cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>{band.id ? "Edit Band" : "New Band"}</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.editorScroll} keyboardShouldPersistTaps="handled">
          <Input
            label="Label (optional)"
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Tier 1 — Small items"
            testID="editor-label"
          />
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Input
                label="Min price (£)"
                value={minP}
                onChangeText={setMinP}
                keyboardType="numeric"
                placeholder="0"
                testID="editor-min-price"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Max price (£, blank = ∞)"
                value={maxP}
                onChangeText={setMaxP}
                keyboardType="numeric"
                placeholder="100"
                testID="editor-max-price"
              />
            </View>
          </View>
          <Input
            label="Deposit amount (£)"
            value={deposit}
            onChangeText={setDeposit}
            keyboardType="numeric"
            placeholder="25"
            testID="editor-deposit"
          />
          <View style={styles.enableRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.enableTitle}>Enabled</Text>
              <Text style={styles.enableSub}>Disabled bands are skipped during checkout.</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.borderStrong, true: colors.brand }}
              thumbColor="#fff"
              testID="editor-enabled-toggle"
            />
          </View>
          {err ? <Text style={styles.err} testID="editor-error">{err}</Text> : null}
          <Button
            title={band.id ? "Save changes" : "Create band"}
            onPress={submit}
            loading={saving}
            testID="editor-save"
            style={{ marginTop: spacing.md }}
          />
          {onDelete && (
            <Pressable
              style={styles.deleteBtn}
              onPress={() => onDelete(band)}
              testID="editor-delete"
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.deleteText}>Delete band</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  intro: {
    flexDirection: "row", gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.infoBg, borderRadius: radius.md, alignItems: "center",
    marginBottom: spacing.md,
  },
  introText: { flex: 1, color: colors.text, fontSize: font.sm, lineHeight: 20 },
  calcCard: {
    padding: spacing.lg, backgroundColor: colors.text, borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  calcTitle: {
    fontSize: font.sm, color: "rgba(255,255,255,0.6)", fontWeight: weight.bold,
    letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.md,
  },
  calcRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-end" },
  calcLabel: {
    fontSize: font.sm, color: "rgba(255,255,255,0.7)", marginBottom: spacing.xs,
    fontWeight: weight.medium,
  },
  calcInputWrap: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.md,
  },
  calcResult: {
    marginTop: spacing.md, padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.md, gap: spacing.sm,
  },
  calcResultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  calcResultLabel: { color: "rgba(255,255,255,0.75)", fontSize: font.base, flex: 1, marginRight: spacing.sm },
  calcResultDeposit: { color: colors.accent, fontSize: font.xxl, fontWeight: weight.bold },
  calcResultBalance: { color: "#fff", fontSize: font.lg, fontWeight: weight.semibold },
  sectionTitle: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.semibold,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.sm,
  },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginTop: spacing.md },
  emptySub: { fontSize: font.base, color: colors.textSecondary },
  bandCard: {
    padding: spacing.lg, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.bg, gap: spacing.md,
  },
  bandCardDisabled: { opacity: 0.5, backgroundColor: colors.bgSecondary },
  bandHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bandLabel: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  bandRange: { fontSize: font.base, color: colors.textSecondary, marginTop: 2 },
  bandFoot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  depositLabel: { fontSize: font.sm, color: colors.textSecondary },
  depositValue: { fontSize: font.xxl, fontWeight: weight.bold, color: colors.brand, letterSpacing: -0.3 },
  // Modal
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  modalTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  cancelText: { fontSize: font.base, color: colors.brand, fontWeight: weight.medium, width: 60 },
  editorScroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  row2: { flexDirection: "row", gap: spacing.md },
  enableRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.bgSecondary,
    marginTop: spacing.sm,
  },
  enableTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  enableSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  err: { color: colors.error, marginTop: spacing.sm },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.lg,
  },
  deleteText: { color: colors.error, fontSize: font.base, fontWeight: weight.semibold },
});
