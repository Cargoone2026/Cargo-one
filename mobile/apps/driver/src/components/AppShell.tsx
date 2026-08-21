/**
 * AppShell — Cargo One driver-side sidebar shell. Mirrors
 * frontend/src/layouts/DriverLayout.jsx exactly: seven-item nav in
 * this order — Home / Available / Live Mode / My Jobs / Earnings /
 * Fleet / Profile — with the same dark #0B0B0F sidebar, red brand
 * badge, red-tinted active pill and account footer as the customer
 * app. Responsive: docked with collapse toggle ≥ 900 px; off-canvas
 * drawer < 900 px. No bottom tabs.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Home,
  Compass,
  Zap,
  Package,
  PoundSterling,
  Truck,
  User as UserIcon,
  Globe,
  Settings as SettingsIcon,
  LogOut,
  Package as PackageMark,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { colors, radius, shadow } from "../theme";

const SIDEBAR_WIDTH_OPEN = 240;
const SIDEBAR_WIDTH_RAIL = 72;
const BREAKPOINT_DOCKED = 900;

const NAV: { label: string; route: keyof RootStackParamList; Icon: any }[] = [
  { label: "Home", route: "Home" as any, Icon: Home },
  { label: "Available", route: "AvailableJobs" as any, Icon: Compass },
  { label: "Live Mode", route: "LiveMode" as any, Icon: Zap },
  { label: "My Jobs", route: "MyJobs" as any, Icon: Package },
  { label: "Earnings", route: "Earnings" as any, Icon: PoundSterling },
  { label: "Fleet", route: "Fleet" as any, Icon: Truck },
  { label: "Profile", route: "Profile" as any, Icon: UserIcon },
];

export const AppShellContext = React.createContext<{ openDrawer: () => void; showMenu: boolean }>({
  openDrawer: () => {},
  showMenu: false,
});

export function useShellMenu() {
  return React.useContext(AppShellContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const docked = width >= BREAKPOINT_DOCKED;
  const drawerWidth = Math.min(320, Math.round(width * 0.82));

  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const target = docked ? (collapsed ? 0 : 1) : open ? 1 : 0;
    Animated.timing(progress, {
      toValue: target,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [docked, collapsed, open, progress]);

  const shellCtx = React.useMemo(() => ({ openDrawer: () => setOpen(true), showMenu: !docked }), [docked]);

  if (docked) {
    const sidebarWidth = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [SIDEBAR_WIDTH_RAIL, SIDEBAR_WIDTH_OPEN],
    });
    return (
      <AppShellContext.Provider value={shellCtx}>
        <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.bg }}>
          <Animated.View style={{ width: sidebarWidth }}>
            <SidebarContent collapsed={collapsed} onNavigate={() => {}} onToggle={() => setCollapsed((c) => !c)} showToggle />
          </Animated.View>
          <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        </View>
      </AppShellContext.Provider>
    );
  }

  const drawerTx = progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] });
  const scrimOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  return (
    <AppShellContext.Provider value={shellCtx}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>{children}</View>
        {open ? (
          <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: scrimOpacity }]}>
            <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} testID="app-shell-scrim" />
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX: drawerTx }] }]}>
          <SidebarContent collapsed={false} onNavigate={() => setOpen(false)} />
        </Animated.View>
      </View>
    </AppShellContext.Provider>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
  onToggle,
  showToggle,
}: {
  collapsed: boolean;
  onNavigate: () => void;
  onToggle?: () => void;
  showToggle?: boolean;
}) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const state = useNavigationState((s) => s);
  const current = state?.routes?.[state.index]?.name;

  const go = (route: keyof RootStackParamList) => {
    onNavigate();
    (nav as any).navigate(route);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.sidebar}>
      <Pressable onPress={() => go("Home" as any)} style={styles.brand} testID="sidebar-brand">
        <View style={styles.brandBadge}>
          <PackageMark color="#FFFFFF" size={18} strokeWidth={2.4} />
        </View>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>CARGO ONE</Text>
            <Text style={styles.brandRole}>Driver portal</Text>
          </View>
        )}
        {showToggle && !collapsed ? (
          <Pressable onPress={onToggle} hitSlop={8} testID="sidebar-collapse" style={styles.toggle}>
            <ChevronLeft size={16} color="rgba(255,255,255,0.72)" />
          </Pressable>
        ) : null}
      </Pressable>
      {showToggle && collapsed ? (
        <Pressable onPress={onToggle} testID="sidebar-expand" style={styles.toggleRow}>
          <ChevronRight size={16} color="rgba(255,255,255,0.72)" />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, marginTop: 12, gap: 2 }}>
        {NAV.map(({ label, route, Icon }) => {
          const active = current === route;
          return (
            <Pressable
              key={label}
              onPress={() => go(route)}
              style={[styles.item, active && styles.itemActive, collapsed && styles.itemCollapsed]}
              testID={`side-rail-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon size={20} color={active ? colors.brand : "rgba(255,255,255,0.72)"} />
              {!collapsed && (
                <>
                  <Text style={[styles.itemLabel, active && { color: "#FFFFFF" }]}>{label}</Text>
                  {active ? <View style={styles.activeDot} /> : null}
                </>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.sectionDivider} />
      <Pressable
        onPress={() => {
          onNavigate();
          Linking.openURL("https://cargoone.co.uk").catch(() => {});
        }}
        testID="side-rail-public"
        style={[styles.item, collapsed && styles.itemCollapsed]}
      >
        <Globe size={18} color="rgba(255,255,255,0.72)" />
        {!collapsed && <Text style={styles.itemLabel}>Public site</Text>}
      </Pressable>
      <Pressable
        onPress={() => go("Settings" as any)}
        testID="side-rail-settings"
        style={[styles.item, collapsed && styles.itemCollapsed]}
      >
        <SettingsIcon size={18} color="rgba(255,255,255,0.72)" />
        {!collapsed && <Text style={styles.itemLabel}>Settings</Text>}
      </Pressable>
      <View style={styles.sectionDivider} />
      <View style={[styles.footer, collapsed && { flexDirection: "column", alignItems: "center", gap: 8 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || "?").slice(0, 1).toUpperCase()}</Text>
        </View>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.footerName} numberOfLines={1}>{user?.name || "Signed in"}</Text>
            <Text style={styles.footerEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
        )}
        <Pressable onPress={() => logout()} testID="sidebar-logout" hitSlop={10}>
          <LogOut size={18} color="rgba(255,255,255,0.72)" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sidebar: { flex: 1, backgroundColor: colors.sidebarBg, paddingHorizontal: 12, paddingVertical: 12, borderRightWidth: 1, borderRightColor: colors.sidebarBorder },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 8 },
  brandBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: 1.4 },
  brandRole: { color: colors.sidebarMuted, fontSize: 12, marginTop: 2 },
  toggle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  toggleRow: { alignSelf: "center", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", marginTop: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.base },
  itemCollapsed: { justifyContent: "center", gap: 0 },
  itemActive: { backgroundColor: colors.sidebarActiveBg },
  itemLabel: { flex: 1, color: colors.sidebarInk, fontSize: 14, fontWeight: "500" },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  sectionDivider: { height: 1, backgroundColor: colors.sidebarBorder, marginVertical: 8 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  footerName: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  footerEmail: { color: colors.sidebarMuted, fontSize: 11, marginTop: 2 },
  drawer: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: colors.sidebarBg, zIndex: 40, ...shadow.drawer },
});
