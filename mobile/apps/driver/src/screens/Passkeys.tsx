/**
 * PasskeysScreen — driver passkey management.
 * Same shared Cargo One design system as the customer app.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { deletePasskey, listPasskeys, registerPasskey } from "@cargoone/core";
import { Fingerprint } from "lucide-react-native";
import { colors, radius, typography } from "../theme";
import { EmptyState, Page, PageHeader, PrimaryButton } from "../ui";

export function PasskeysScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRows((await listPasskeys()) as any[]);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function add() {
    setBusy(true);
    try {
      await registerPasskey("iPhone");
      Alert.alert("Passkey added", "You can now sign in with Face ID.");
      refresh();
    } catch (e: any) {
      Alert.alert("Could not add passkey", e?.message || "");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deletePasskey(id);
      refresh();
    } catch (e: any) {
      Alert.alert("Could not remove", e?.message || "");
    }
  }

  return (
    <Page testID="driver-passkeys">
      <ScrollView>
        <PageHeader title="Passkeys" subtitle="Sign in without typing your password using Face ID." />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <PrimaryButton title="Add a passkey" onPress={add} loading={busy} testID="add-passkey" />
          {rows.length === 0 ? (
            <EmptyState Icon={Fingerprint} title="No passkeys yet" body="Add one to sign in with Face ID next time." />
          ) : (
            rows.map((item) => (
              <View key={item.id} style={styles.row} testID={`passkey-row-${item.id.slice(0, 8)}`}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.cardTitle}>{item.label || "Passkey"}</Text>
                  <Text style={[typography.small, { marginTop: 2 }]}>
                    Added {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                  </Text>
                </View>
                <Text
                  onPress={() => remove(item.id)}
                  testID={`passkey-remove-${item.id.slice(0, 8)}`}
                  style={{ color: colors.brand, fontWeight: "700", fontSize: 14 }}
                >
                  Remove
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  row: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
};
