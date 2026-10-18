import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { DriverCancelReason } from "@cargoone/core";
import { Icon, PrimaryButton, SecondaryButton, colors, radius, space, typography } from "../ui";

type Props = {
  visible: boolean;
  title: string;
  subtitle: string;
  confirmLabel: string;
  loadReasons: () => Promise<DriverCancelReason[]>;
  // "other" = text required only for the Other reason; "always" = note always required.
  noteMode: "other" | "always";
  notePlaceholder: string;
  onSubmit: (reasonKey: string, note: string) => Promise<void>;
  onClose: () => void;
  testID: string;
};

// Full-screen sheet: pick a reason, add a note, confirm. Mirrors web DriverCancelModal.
export function ReasonSheet(p: Props) {
  const [reasons, setReasons] = useState<DriverCancelReason[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!p.visible) return;
    setPicked(null); setNote(""); setError(null); setReasons(null);
    p.loadReasons().then(setReasons).catch(() => setReasons([]));
  }, [p.visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsNote = p.noteMode === "always" || picked === "other";
  const canSubmit = !!picked && (!needsNote || note.trim().length > 0) && !busy;

  const submit = async () => {
    if (!picked) return;
    setBusy(true); setError(null);
    try {
      await p.onSubmit(picked, note);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={p.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={p.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }} testID={p.testID}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: space[4], gap: space[3] }}>
          <Text style={[typography.h2, { flex: 1 }]}>{p.title}</Text>
          <Pressable onPress={p.onClose} hitSlop={10} testID={`${p.testID}-close`}>
            <Icon name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: space[4], paddingTop: 0, gap: space[2] }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={typography.small}>{p.subtitle}</Text>
          {reasons === null ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: space[4] }} />
          ) : reasons.length === 0 ? (
            <Text style={[typography.small, { color: colors.errorInk }]}>Reasons are not available right now.</Text>
          ) : (
            reasons.map((r) => {
              const on = picked === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setPicked(r.key)}
                  testID={`${p.testID}-reason-${r.key}`}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3],
                    borderRadius: radius.md, borderWidth: 1.5,
                    borderColor: on ? colors.brand : colors.border,
                    backgroundColor: on ? colors.brandTint : colors.bg,
                  }}
                >
                  <Icon name={on ? "check-circle" : "circle"} size={18} color={on ? colors.brand : colors.inkFaint} />
                  <Text style={typography.body}>{r.label}</Text>
                </Pressable>
              );
            })
          )}
          {picked && needsNote ? (
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={p.notePlaceholder}
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={1000}
              testID={`${p.testID}-note`}
              style={{
                minHeight: 90, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
                padding: space[3], color: colors.ink, textAlignVertical: "top", marginTop: space[2],
              }}
            />
          ) : null}
          {error ? (
            <Text style={[typography.small, { color: colors.errorInk }]} testID={`${p.testID}-error`}>{error}</Text>
          ) : null}
          <PrimaryButton
            title={p.confirmLabel}
            onPress={submit}
            disabled={!canSubmit}
            loading={busy}
            testID={`${p.testID}-confirm`}
            style={{ marginTop: space[3] }}
          />
          <SecondaryButton title="Back" onPress={p.onClose} testID={`${p.testID}-back`} />
        </ScrollView>
      </View>
    </Modal>
  );
}
