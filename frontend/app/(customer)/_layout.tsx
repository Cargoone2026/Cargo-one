import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { SideRail, SideRailItem } from "@/src/components/portal/SideRail";
import { usePortalLayout } from "@/src/components/portal/usePortalLayout";
import { colors } from "@/src/theme";

const NAV: SideRailItem[] = [
  { label: "Home", href: "/(customer)", icon: "home" },
  { label: "Post Job", href: "/(customer)/post-job", icon: "add-circle" },
  { label: "Bookings", href: "/(customer)/bookings", icon: "cube" },
  { label: "Messages", href: "/(customer)/messages", icon: "chatbubbles" },
  { label: "Profile", href: "/(customer)/profile", icon: "person" },
];

export default function CustomerTabs() {
  const { isWebDesktop } = usePortalLayout();

  return (
    <View style={styles.root}>
      {isWebDesktop ? <SideRail role="customer" items={NAV} /> : null}
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
          <Tabs.Screen name="post-job" options={{ title: "Post Job", tabBarIcon: ({ size }) => <Ionicons name="add-circle" size={size + 8} color={colors.brand} /> }} />
          <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }} />
          <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} /> }} />
          <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
          <Tabs.Screen name="booking/[id]" options={{ href: null }} />
          <Tabs.Screen name="job/[id]" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.bg },
  main: { flex: 1, backgroundColor: colors.bg, maxWidth: 1200, alignSelf: "stretch", width: "100%" },
});
