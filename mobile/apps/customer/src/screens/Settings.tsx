import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../AuthContext";
import { Body, CARGO, Card, H1, PrimaryButton, Screen } from "../ui";

export function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  return (
    <Screen>
      <ScrollView>
        <H1>Settings</H1>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: CARGO.muted, textTransform: "uppercase" }}>Signed in as</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 4 }}>{user?.name}</Text>
          <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 2 }}>{user?.email}</Text>
        </Card>

        <Pressable onPress={() => navigation.navigate("Passkeys")} testID="settings-passkeys" style={{ marginTop: 12 }}>
          <Card>
            <Text style={{ fontSize: 15, fontWeight: "700" }}>Passkeys (Face ID / Touch ID)</Text>
            <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 4 }}>Manage your saved passkeys.</Text>
          </Card>
        </Pressable>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            title="Log out"
            variant="secondary"
            onPress={() =>
              Alert.alert("Log out?", "You can sign in again anytime.", [
                { text: "Cancel", style: "cancel" },
                { text: "Log out", style: "destructive", onPress: logout },
              ])
            }
            testID="settings-logout"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
