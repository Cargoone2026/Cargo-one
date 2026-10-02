/**
 * VehicleEditScreen — mobile port of the vehicle-edit modal inside
 * frontend/src/pages/portal/driver/Fleet.jsx. New or existing vehicle;
 * if `vehicleId` is passed we load the current record from
 * DriverAPI.listVehicles so the user can edit; otherwise it's an add.
 *
 * Visual pattern follows Customer EditProfile.tsx (Label + Input +
 * chip row + PrimaryButton).
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DriverAPI, SharedAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import {
  Icon, Page, PageHeader, PrimaryButton,
  colors, radius, space, typography,
} from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "VehicleEdit">;

type VType = { key: string; name: string };
type Cap = { key: string; name: string };

type Form = {
  id?: string;
  vehicle_type_key: string;
  registration: string;
  make: string;
  model: string;
  year: string;
  payload_kg: string;
  capabilities: string[];
  is_default: boolean;
};

const emptyForm = (): Form => ({
  vehicle_type_key: "",
  registration: "",
  make: "",
  model: "",
  year: "",
  payload_kg: "",
  capabilities: [],
  is_default: false,
});

export default function VehicleEditScreen({ route, navigation }: P) {
  const { vehicleId } = route.params || {};
  const isEdit = !!vehicleId;
  const [types, setTypes] = useState<VType[]>([]);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [form, setForm] = useState<Form>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, c, existing] = await Promise.all([
          SharedAPI.vehicles(),
          DriverAPI.capabilities(),
          isEdit ? DriverAPI.listVehicles() : Promise.resolve([]),
        ]);
        if (!alive) return;
        const vehicleTypes: VType[] = Array.isArray(t)
          ? t.map((x: any) => ({ key: x.key, name: x.name }))
          : [];
        setTypes(vehicleTypes);
        setCaps(Array.isArray(c) ? c : []);
        if (isEdit) {
          const found = (existing as any[]).find((v: any) => v.id === vehicleId);
          if (found) {
            setForm({
              id: found.id,
              vehicle_type_key: found.vehicle_type_key || vehicleTypes[0]?.key || "",
              registration: found.registration || "",
              make: found.make || "",
              model: found.model || "",
              year: found.year ? String(found.year) : "",
              payload_kg: found.payload_kg ? String(found.payload_kg) : "",
              capabilities: Array.isArray(found.capabilities) ? found.capabilities : [],
              is_default: !!found.is_default,
            });
          }
        } else if (vehicleTypes.length > 0) {
          setForm((f) => ({ ...f, vehicle_type_key: vehicleTypes[0].key }));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [vehicleId, isEdit]);

  const toggleCap = useCallback((k: string) => {
    setForm((f) => {
      const set = new Set(f.capabilities);
      if (set.has(k)) set.delete(k); else set.add(k);
      return { ...f, capabilities: Array.from(set) };
    });
  }, []);

  const canSave = !!form.vehicle_type_key && !!form.registration.trim();

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      await DriverAPI.saveVehicle({
        id: form.id,
        vehicle_type_key: form.vehicle_type_key,
        registration: form.registration.trim().toUpperCase(),
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number(form.year) || null : null,
        payload_kg: form.payload_kg ? Number(form.payload_kg) || null : null,
        capabilities: form.capabilities,
        is_default: form.is_default,
      });
      Alert.alert(isEdit ? "Vehicle updated" : "Vehicle added", "Your fleet has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      setErr(e?.message || "Could not save vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Fleet"));

  const currentTypeName = types.find((t) => t.key === form.vehicle_type_key)?.name || "Register vehicle";

  return (
    <Page testID="vehicle-edit-screen" scroll={false}>
      <PageHeader title={isEdit ? "Edit vehicle" : "Add vehicle"} onBack={goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[8], gap: space[4] }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topCard}>
            <Text style={typography.micro}>{isEdit ? "EDIT VEHICLE" : "NEW VEHICLE"}</Text>
            <Text style={[typography.h2, { marginTop: 4 }]}>{currentTypeName}</Text>
          </View>

          {loading ? (
            <Text style={[typography.caption, { textAlign: "center", paddingVertical: space[4] }]}>
              Loading catalog…
            </Text>
          ) : null}

          <View>
            <Label>Vehicle type</Label>
            <View style={styles.chipWrap}>
              {types.map((t) => {
                const active = form.vehicle_type_key === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setForm((f) => ({ ...f, vehicle_type_key: t.key }))}
                    testID={`vehicle-type-${t.key}`}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && { color: "#FFFFFF" }]}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field
            label="Registration"
            value={form.registration}
            onChangeText={(v) => setForm((f) => ({ ...f, registration: v.toUpperCase() }))}
            placeholder="AB12 CDE"
            autoCapitalize="characters"
            testID="vehicle-registration"
          />

          <View style={{ flexDirection: "row", gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Make"
                value={form.make}
                onChangeText={(v) => setForm((f) => ({ ...f, make: v }))}
                placeholder="Ford"
                testID="vehicle-make"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Model"
                value={form.model}
                onChangeText={(v) => setForm((f) => ({ ...f, model: v }))}
                placeholder="Transit"
                testID="vehicle-model"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Year"
                value={form.year}
                onChangeText={(v) => setForm((f) => ({ ...f, year: v.replace(/[^0-9]/g, "") }))}
                keyboardType="number-pad"
                placeholder="2022"
                testID="vehicle-year"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Payload (kg)"
                value={form.payload_kg}
                onChangeText={(v) => setForm((f) => ({ ...f, payload_kg: v.replace(/[^0-9]/g, "") }))}
                keyboardType="number-pad"
                placeholder="1200"
                testID="vehicle-payload"
              />
            </View>
          </View>

          {caps.length > 0 ? (
            <View>
              <Label>Capabilities</Label>
              <View style={styles.chipWrap}>
                {caps.map((c) => {
                  const on = form.capabilities.includes(c.key);
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => toggleCap(c.key)}
                      testID={`vehicle-cap-${c.key}`}
                      style={[styles.chip, on && styles.chipDark]}
                    >
                      <Text style={[styles.chipText, on && { color: "#FFFFFF" }]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => setForm((f) => ({ ...f, is_default: !f.is_default }))}
            testID="vehicle-default"
            style={styles.checkRow}
          >
            <View style={[styles.checkbox, form.is_default && styles.checkboxOn]}>
              {form.is_default ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
            </View>
            <Text style={{ fontSize: 14, color: colors.ink }}>Set as default vehicle</Text>
          </Pressable>

          {err ? (
            <Text style={{ color: colors.error, fontSize: 12 }} testID="vehicle-error">{err}</Text>
          ) : null}

          <PrimaryButton
            title={isEdit ? "Save changes" : "Add vehicle"}
            onPress={save}
            disabled={!canSave}
            loading={saving}
            testID="vehicle-save"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Field({
  label, testID, ...props
}: {
  label: string;
  testID?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Label>{label}</Label>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={colors.inkMuted}
        testID={testID}
      />
    </View>
  );
}

const styles = {
  topCard: {
    marginTop: space[2],
    padding: space[4],
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: colors.ink,
    marginBottom: 6,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    fontSize: 14,
    color: colors.ink,
  },
  chipWrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipDark: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: { fontSize: 13, fontWeight: "600" as const, color: colors.ink },
  checkRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space[3],
    paddingVertical: 6,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: colors.bg,
  },
  checkboxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
} as const;
