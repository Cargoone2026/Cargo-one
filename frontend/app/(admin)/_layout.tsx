import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { SideRail, SideRailItem } from "@/src/components/portal/SideRail";
import { usePortalLayout } from "@/src/components/portal/usePortalLayout";
import { colors } from "@/src/theme";

const NAV: SideRailItem[] = [
  { label: "Dashboard", href: "/(admin)", icon: "grid" },
  { label: "Users", href: "/(admin)/users", icon: "people" },
  { label: "Drivers", href: "/(admin)/manage-drivers", icon: "car-sport" },
  { label: "Jobs", href: "/(admin)/jobs", icon: "cube" },
  { label: "Booking Fees", href: "/(admin)/deposit-bands", icon: "pricetags" },
  { label: "Settings", href: "/(admin)/profile", icon: "settings" },
];

export default function AdminTabs() {
  const { isWebDesktop } = usePortalLayout();

  return (
    <View style={styles.root}>
      {isWebDesktop ? <SideRail role="admin" items={NAV} /> : null}
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
          <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
          <Tabs.Screen name="users" options={{ title: "Users", tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
          <Tabs.Screen name="manage-drivers" options={{ title: "Drivers", tabBarIcon: ({ color, size }) => <Ionicons name="car-sport" size={size} color={color} /> }} />
          <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }} />
          <Tabs.Screen name="profile" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
          <Tabs.Screen name="deposit-bands" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.bg },
  main: { flex: 1, backgroundColor: colors.bg, maxWidth: 1200, alignSelf: "stretch", width: "100%" },
});
