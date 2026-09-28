/**
 * MinimalApp — R71.16.8 diagnostic root.
 *
 * The purpose of this component is one thing only: prove that the Driver
 * JS bundle reaches `registerRootComponent()` AND that React actually
 * mounts a root view on the physical iPhone.
 *
 * Strict rules:
 *   • No provider imports.
 *   • No navigation imports.
 *   • No @cargoone/core (backend/network) imports.
 *   • No auth, no push notifications, no location, no Mapbox.
 *   • No expo-splash-screen imports (native splash auto-hides on iOS
 *     within its ~10s fuse — leaving it out of MinimalApp isolates the
 *     failure surface).
 *   • Only React + react-native primitives.
 *
 * Visual identity remains Driver:
 *   • Background `#111111` — matches Driver splash background so the
 *     transition from native splash is invisible.
 *   • Red accent (`#D62828`) — Cargo One brand red.
 *   • "CARGO ONE / Driver" text so we can distinguish this diagnostic
 *     from any accidental Customer boot.
 *
 * How to interpret:
 *   • If you SEE this screen after the launch splash, JS is reaching
 *     `App()` and React can render on-device. The failure is in the
 *     provider/navigation/auth tree that MinimalApp intentionally
 *     omits — flip `MINIMAL_BOOT` back to `false` and layer providers
 *     back in one at a time.
 *   • If you STILL see a blank white/gray screen, JS is NOT executing
 *     on-device (Metro not reachable, bundle load fails, native bridge
 *     misconfigured). That points at native/build/network — not JS.
 */
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

export function MinimalApp() {
  // Force a state update after mount so we know the reconciler committed
  // at least once and can re-render (a purely static render would still
  // pass even if RN's reconciler were wedged after the first commit).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.root} testID="driver-minimal-boot">
      <View style={styles.center}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>C1</Text>
        </View>
        <Text style={styles.brandTitle}>CARGO ONE</Text>
        <Text style={styles.brandRole}>Driver</Text>
        <Text style={styles.diagnostic}>
          MinimalApp mounted — JS reached App(){"\n"}
          Platform: {Platform.OS} {Platform.Version + ""}
          {"\n"}
          Re-render tick: {tick}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#111111" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  badge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#D62828",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  badgeText: { color: "#FFFFFF", fontSize: 32, fontWeight: "700", letterSpacing: 1 },
  brandTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 1.8 },
  brandRole: { color: "rgba(255,255,255,0.7)", fontSize: 13, letterSpacing: 0.4 },
  diagnostic: {
    marginTop: 24,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
