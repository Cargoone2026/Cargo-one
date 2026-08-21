/**
 * AppShell — the native equivalent of frontend/src/layouts/CustomerLayout
 * + components/portal/SideRail. Renders a dark CargoOne sidebar with
 * the same items, icons and active treatment as the web SideRail
 * (240 px width; #0B0B0F background; #D62828/15 selected pill; red
 * end-dot; Public site + Settings section; account footer with
 * avatar initial + name + email + logout).
 *
 * Responsive:
 *   width >= 900  ->  sidebar is docked permanently to the left,
 *                     main content sits next to it (iPad / iPad Pro)
 *   width <  900  ->  sidebar is a slide-in drawer that overlays
 *                     ~78 % of the screen from the left. A compact
 *                     CargoOne "menu" button is shown top-left of the
 *                     main content to open it.
 *
 * There is NO bottom tab bar anywhere.
 */
import React, { useRef, useState, useEffect } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Home, PlusCircle, Zap, Package, MessagesSquare, User as UserIcon, Globe, Settings, LogOut, Menu, Package as PackageMark } from "lucide-react-native";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";

const RED = "#D62828";
const SIDEBAR_BG = "#0B0B0F";
const SIDEBAR_WIDTH = 240;

const NAV: { label: string; route: keyof RootStackParamList; Icon: any }[] = [
  { label: "Home", route: "Home" as any, Icon: Home },
  { label: "Post Job", route: "PostJob" as any, Icon: PlusCircle },
  { label: "ASAP", route: "Asap" as any, Icon: Zap },
  { label: "Bookings", route: "Bookings" as any, Icon: Package },
  { label: "Messages", route: "Messages", Icon: MessagesSquare },
  { label: "Profile", route: "Profile", Icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const docked = width >= 900;
  const drawerWidth = Math.min(320, Math.round(width * 0.78));
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: open ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, anim]);

  const drawerTx = anim.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] });
  const scrimOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  if (docked) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#FFFFFF" }}>
        <SidebarContent onNavigate={() => {}} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1 }}>{children}</View>
      <SafeAreaView edges={["top"]} style={styles.menuBtnWrap} pointerEvents="box-none">
        <Pressable onPress={() => setOpen(true)} style={styles.menuBtn} testID="app-shell-menu">
          <Menu color="#111111" size={22} />
        </Pressable>
      </SafeAreaView>

      {open ? (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: scrimOpacity }]} pointerEvents={open ? "auto" : "none"}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} testID="app-shell-scrim" />
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX: drawerTx }] }]}>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </Animated.View>
    </View>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
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
        <View style={styles.brandBadge}><PackageMark color="#FFFFFF" size={18} strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandTitle}>CARGO ONE</Text>
          <Text style={styles.brandRole}>Customer portal</Text>
        </View>
      </Pressable>

      <View style={{ flex: 1, marginTop: 12, gap: 2 }}>
        {NAV.map(({ label, route, Icon }) => {
          const active = current === route;
          return (
            <Pressable
              key={label}
              onPress={() => go(route)}
              style={[styles.item, active && styles.itemActive]}
              testID={`side-rail-item-${label.toLowerCase().replace(" ", "-")}`}
            >
              <Icon size={20} color={active ? RED : "rgba(255,255,255,0.72)"} />
              <Text style={[styles.itemLabel, active && { color: "#FFFFFF" }]}>{label}</Text>
              {active ? <View style={styles.activeDot} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionDivider} />
      <Pressable style={styles.item} onPress={() => { onNavigate(); }} testID="side-rail-public">
        <Globe size={18} color="rgba(255,255,255,0.72)" /><Text style={styles.itemLabel}>Public site</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={() => go("Settings")} testID="side-rail-settings">
        <Settings size={18} color="rgba(255,255,255,0.72)" /><Text style={styles.itemLabel}>Settings</Text>
      </Pressable>

      <View style={styles.sectionDivider} />
      <View style={styles.footer}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || "?").slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerName} numberOfLines={1}>{user?.name || "Signed in"}</Text>
          <Text style={styles.footerEmail} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Pressable onPress={() => logout()} testID="sidebar-logout" hitSlop={10}>
          <LogOut size={18} color="rgba(255,255,255,0.72)" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: SIDEBAR_WIDTH, backgroundColor: SIDEBAR_BG, paddingHorizontal: 12, paddingVertical: 12, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.08)" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 8 },
  brandBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: RED, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: 1.4 },
  brandRole: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  itemActive: { backgroundColor: "rgba(214,40,40,0.15)" },
  itemLabel: { flex: 1, color: "rgba(255,255,255,0.72)", fontSize: 14, fontWeight: "500" },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  sectionDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 8 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  footerName: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  footerEmail: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
  drawer: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: SIDEBAR_BG, zIndex: 40, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 4, height: 0 } },
  menuBtnWrap: { position: "absolute", top: 0, left: 0 },
  menuBtn: { width: 44, height: 44, marginLeft: 12, marginTop: 8, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)" },
});
