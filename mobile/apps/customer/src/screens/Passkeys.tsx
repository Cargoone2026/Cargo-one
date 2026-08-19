import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { deletePasskey, listPasskeys, registerPasskey } from "@cargoone/core";
import { Body, CARGO, Card, H1, PrimaryButton, Screen } from "../ui";

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
    <Screen>
      <H1>Passkeys</H1>
      <Body muted style={{ marginTop: 6, marginBottom: 12 }}>
        Sign in without typing your password using Face ID.
      </Body>
      <PrimaryButton title="Add a passkey" onPress={add} loading={busy} testID="add-passkey" />
      <View style={{ height: 12 }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }} testID={`passkey-row-${item.id.slice(0, 8)}`}>
            <Text style={{ fontWeight: "700" }}>{item.label || "Passkey"}</Text>
            <Text style={{ color: CARGO.muted, fontSize: 12, marginTop: 4 }}>
              Added {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
            </Text>
            <Text
              onPress={() => remove(item.id)}
              testID={`passkey-remove-${item.id.slice(0, 8)}`}
              style={{ color: CARGO.red, fontWeight: "700", marginTop: 8 }}
            >
              Remove
            </Text>
          </Card>
        )}
        ListEmptyComponent={<Body muted style={{ marginTop: 40, textAlign: "center" }}>No passkeys yet.</Body>}
      />
    </Screen>
  );
}
