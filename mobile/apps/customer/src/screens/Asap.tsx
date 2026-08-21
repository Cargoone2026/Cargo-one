/**
 * AsapScreen — native equivalent of frontend AsapRequest.jsx.
 * The full ASAP wizard with address autocomplete + live map + quote
 * requires native modules that land in a follow-up commit. This
 * screen preserves the entry point (Transport vs. Vehicle Recovery)
 * and hands off to CreateJob for the form.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Zap, Truck, AlertTriangle, ChevronRight } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";

export function AsapScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();
  return (
    <Page testID="asap-hub-screen">
      <ScrollView>
        <PageHeader
          large
          title={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Zap size={22} color={colors.accent} />
              <Text style={typography.pageTitle}>Request now — ASAP</Text>
            </View>
          }
          subtitle="Find a nearby Cargo One driver in real time."
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <Tile
            title="Transport"
            body="Urgent parcel, consignment or same-day movement"
            Icon={Truck}
            testID="asap-mode-transport"
            onPress={() => nav.navigate("CreateJob", { serviceTiming: "asap", serviceType: "transport" })}
          />
          <Tile
            title="Vehicle Recovery"
            body="Stranded vehicle, breakdown or recovery"
            Icon={AlertTriangle}
            testID="asap-mode-recovery"
            onPress={() => nav.navigate("CreateJob", { serviceTiming: "asap", serviceType: "recovery" })}
          />
        </View>
      </ScrollView>
    </Page>
  );
}

function Tile({
  title,
  body,
  Icon,
  onPress,
  testID,
}: {
  title: string;
  body: string;
  Icon: any;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        {
          padding: 20,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: pressed ? colors.ink : colors.border,
          backgroundColor: colors.bg,
          gap: 12,
        },
      ]}
    >
      <Icon size={24} color={colors.ink} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[typography.cardTitle, { flex: 1 }]}>{title}</Text>
        <ChevronRight size={20} color={colors.inkFaint} />
      </View>
      <Text style={typography.caption}>{body}</Text>
    </Pressable>
  );
}
