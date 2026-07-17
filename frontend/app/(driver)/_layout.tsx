import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { SideRail, SideRailItem } from "@/src/components/portal/SideRail";
import { usePortalLayout } from "@/src/components/portal/usePortalLayout";
import { colors } from "@/src/theme";

const NAV: SideRailItem[] = [
  { label: "Home", href: "/(driver)", icon: "home" },
  { label: "Nearby Jobs", href: "/(driver)/jobs", icon: "compass" },
  { label: "My Jobs", href: "/(driver)/my-jobs", icon: "cube" },
  { label: "My Fleet", href: "/(driver)/fleet", icon: "car-sport" },
  { label: "Earnings", href: "/(driver)/earnings", icon: "wallet" },
  { label: "Documents", href: "/(driver)/documents", icon: "document-text" },
  { label: "Profile", href: "/(driver)/profile", icon: "person" },
];

export default function DriverTabs() {
  const { isWebDesktop } = usePortalLayout();

  return (
    <View style={styles.root}>
      {isWebDesktop ? <SideRail role="driver" items={NAV} /> : null}
      <View style={styles.main}>
        <Tabs
          tabBar={isWebDesktop ? () => null : undefined}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.brand,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: {
              backgroundColor: colors.bg,
              borderTopColor: colors.divider,
              height: Platform.OS === "ios" ? 88 : 64,
              paddingTop: 8,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
          <Tabs.Screen name="jobs" options={{ title: "Nearby Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} /> }} />
          <Tabs.Screen name="my-jobs" options={{ title: "My Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }} />
          <Tabs.Screen name="earnings" options={{ title: "Earnings", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
          <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
          <Tabs.Screen name="job/[id]" options={{ href: null }} />
          <Tabs.Screen name="booking/[id]" options={{ href: null }} />
          <Tabs.Screen name="documents" options={{ href: null }} />
          <Tabs.Screen name="fleet" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.bg },
  main: { flex: 1, backgroundColor: colors.bg, maxWidth: 1200, alignSelf: "stretch", width: "100%" },
});
