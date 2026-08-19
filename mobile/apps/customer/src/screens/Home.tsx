import React from "react";
import { ScrollView, View, Pressable, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Body, Card, CARGO, H1, PrimaryButton, Screen } from "../ui";
import { useAuth } from "../AuthContext";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Tabs">;

/**
 * Customer home — quick actions for the 4 main booking flows plus a
 * summary line for the active booking (if any). Keeps the same
 * information hierarchy as the web /customer landing screen.
 */
export function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 13, color: CARGO.muted, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" }}>
          Cargo One
        </Text>
        <H1>Hi {user?.name?.split(" ")[0] || "there"} 👋</H1>
        <Body muted style={{ marginTop: 6, marginBottom: 24 }}>
          What are you shipping today?
        </Body>

        <QuickAction
          title="Book an ASAP transport"
          subtitle="Right now — nearest driver dispatched instantly"
          testID="home-asap-transport"
          onPress={() => navigation.navigate("CreateJob", { serviceTiming: "asap", serviceType: "transport" })}
        />
        <QuickAction
          title="Book ASAP recovery"
          subtitle="Broken-down vehicle recovery within minutes"
          testID="home-asap-recovery"
          onPress={() => navigation.navigate("CreateJob", { serviceTiming: "asap", serviceType: "recovery" })}
        />
        <QuickAction
          title="Post a Big Job / Bidding"
          subtitle="Get bids from vetted drivers — pick the best offer"
          testID="home-bid"
          onPress={() => navigation.navigate("CreateJob", { serviceTiming: "scheduled", serviceType: "big" })}
        />
        <QuickAction
          title="Fixed Price marketplace"
          subtitle="Set your price — first available driver claims it"
          testID="home-fixed-price"
          onPress={() => navigation.navigate("CreateJob", { serviceTiming: "scheduled", serviceType: "transport" })}
        />
      </ScrollView>
    </Screen>
  );
}

function QuickAction({ title, subtitle, onPress, testID }: { title: string; subtitle: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={{ marginBottom: 12 }}>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: "700", color: CARGO.ink }}>{title}</Text>
        <Text style={{ fontSize: 13, color: CARGO.muted, marginTop: 4 }}>{subtitle}</Text>
      </Card>
    </Pressable>
  );
}
