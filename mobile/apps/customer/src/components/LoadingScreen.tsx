/**
 * LoadingScreen — CargoOne branded launch/splash treatment.
 *
 * The outer <View> is intentionally edge-to-edge with the Cargo One
 * red brand fill, so on iPad / iPhone / notch / rounded-corner devices
 * the surface bleeds to every physical edge. Content (badge + lockup
 * + spinner) is inset by the safe-area via <SafeAreaView> so it never
 * clips into the notch/home-indicator regions.
 *
 * The `StatusBar` sibling is set to translucent light content by the
 * calling App component so the top edge stays clean.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RED = "#D62828";

export function LoadingScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [fade, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    // Full-bleed red surface — reaches every physical edge on iPad,
    // iPhone with a notch, and all Android form factors.
    <View style={styles.root} testID="customer-loading-screen">
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <View style={styles.badge}>
            <Image source={require("../../assets/loading-mark.png")} style={styles.mark} resizeMode="cover" />
          </View>
          <Text style={styles.brandTitle}>CARGO ONE</Text>
          <Text style={styles.brandRole}>Customer</Text>
          <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: RED },
  safe: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  badge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  mark: { width: 82, height: 82, borderRadius: 18 },
  brandTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 1.8, marginTop: 8 },
  brandRole: { color: "rgba(255,255,255,0.7)", fontSize: 13, letterSpacing: 0.4 },
  spinner: {
    marginTop: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    borderTopColor: "#FFFFFF",
  },
});
