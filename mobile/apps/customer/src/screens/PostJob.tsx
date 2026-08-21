/**
 * PostJobScreen — native equivalent of frontend PostJob.jsx.
 *
 * The full 5-step web wizard requires native AddressAutocomplete +
 * RouteMap + PhotoUpload components which will land in a follow-up
 * commit. This screen preserves the entry point (chooser for scheduled
 * service types) and hands off to CreateJob for the form. Visual
 * treatment matches web: page header, category tiles, secondary CTA
 * strip.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Truck, Wrench, Gavel, ChevronRight } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme";
import { Page, PageHeader } from "../ui";
import { useShellMenu } from "../components/AppShell";

const OPTIONS = [
  {
    key: "transport",
    label: "Transport",
    hint: "Furniture, parcels, house moves — schedule ahead.",
    Icon: Truck,
    testID: "postjob-transport",
  },
  {
    key: "recovery",
    label: "Vehicle Recovery",
    hint: "Move a car, van or motorcycle to a workshop or home.",
    Icon: Wrench,
    testID: "postjob-recovery",
  },
  {
    key: "big",
    label: "Big Job / Bidding",
    hint: "Open your delivery to bids from vetted operators.",
    Icon: Gavel,
    testID: "postjob-big",
  },
] as const;

export function PostJobScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openDrawer, showMenu } = useShellMenu();
  return (
    <Page testID="postjob-hub-screen">
      <ScrollView>
        <PageHeader
          large
          title="Post a Job"
          subtitle="Pick a service — set your own pickup date & time."
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          {OPTIONS.map(({ key, label, hint, Icon, testID }) => (
            <Pressable
              key={key}
              onPress={() =>
                nav.navigate("CreateJob", {
                  serviceTiming: "scheduled",
                  serviceType: key as any,
                })
              }
              testID={testID}
              style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.ink }]}
            >
              <View style={styles.iconWrap}>
                <Icon size={22} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.cardTitle}>{label}</Text>
                <Text style={[typography.caption, { marginTop: 2 }]}>{hint}</Text>
              </View>
              <ChevronRight size={20} color={colors.inkFaint} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  tile: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
