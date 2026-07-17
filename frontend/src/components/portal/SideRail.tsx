import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type SideRailItem = {
  label: string;
  href: string;
  icon: IconName;
};

type Props = {
  role: "customer" | "driver" | "admin";
  items: SideRailItem[];
};

const BRAND_LABEL: Record<Props["role"], string> = {
  customer: "Customer",
  driver: "Driver",
  admin: "Admin",
};

const BRAND_ICON: Record<Props["role"], IconName> = {
  customer: "person",
  driver: "car-sport",
  admin: "shield-checkmark",
};

// Strip route groups so /(admin)/users vs /admin/users both compare cleanly
function normalize(p: string): string {
  return p.replace(/\/\([^)]+\)/g, "") || "/";
}

export function SideRail({ role, items }: Props) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const currentPath = normalize(pathname);

  const isActive = (href: string) => {
    const target = normalize(href);
    if (target === currentPath) return true;
    if (target === "/") return currentPath === "/";
    return currentPath === target || currentPath.startsWith(`${target}/`);
  };

  const doLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <View style={styles.rail} testID={`side-rail-${role}`}>
      <Pressable onPress={() => router.push("/" as any)} style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Ionicons name="cube" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>CARGO ONE</Text>
          <Text style={styles.role}>{BRAND_LABEL[role]} portal</Text>
        </View>
      </Pressable>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing.md }}>
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as any)}
              style={[styles.item, active ? styles.itemActive : null]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? colors.brand : colors.textSecondary}
              />
              <Text style={[styles.itemText, active ? styles.itemTextActive : null]}>
                {item.label}
              </Text>
              {active ? <View style={styles.activeDot} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => router.push("/" as any)} style={styles.footerRow}>
          <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.footerText}>Public site</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings" as any)} style={styles.footerRow}>
          <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.footerText}>Settings</Text>
        </Pressable>
      </View>

      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Ionicons name={BRAND_ICON[role]} size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name || "Signed in"}
          </Text>
          <Text style={styles.userMail} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <Pressable
          onPress={doLogout}
          style={styles.logoutBtn}
          hitSlop={8}
          testID="side-rail-logout"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 240,
    height: "100%",
    backgroundColor: "#0B0B0F",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    ...(Platform.OS === "web" ? ({ position: "sticky", top: 0 } as any) : {}),
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontWeight: weight.bold, fontSize: font.base, letterSpacing: 1.4 },
  role: { color: "rgba(255,255,255,0.55)", fontSize: font.sm, marginTop: 2 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    marginTop: 2,
  },
  itemActive: { backgroundColor: "rgba(214,40,40,0.15)" },
  itemText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: font.base,
    fontWeight: weight.medium,
    flex: 1,
  },
  itemTextActive: { color: "#fff", fontWeight: weight.semibold },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  footer: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    marginTop: spacing.sm,
    gap: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  footerText: { color: "rgba(255,255,255,0.72)", fontSize: font.base, fontWeight: weight.medium },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    marginTop: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: { color: "#fff", fontSize: font.sm, fontWeight: weight.semibold },
  userMail: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  logoutBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
});
