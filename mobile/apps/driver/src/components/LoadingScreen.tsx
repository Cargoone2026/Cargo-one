/**
 * LoadingScreen — CargoOne Driver branded launch treatment.
 *
 * Mirrors the Customer LoadingScreen technical structure (edge-to-edge
 * SafeAreaView + animated badge + spinner) but keeps 100% Driver
 * identity: dark charcoal fill (#111111) that matches the native
 * splash `backgroundColor` in app.json so the crossfade from the
 * native launch storyboard into this JS loader is imperceptible, and
 * the role label reads "Driver".
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#111111";
const ACCENT = "#D62828";

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
    <View style={styles.root} testID="driver-loading-screen">
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <View style={styles.badge}>
            <Image
              source={require("../../assets/loading-mark.png")}
              style={styles.mark}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brandTitle}>CARGO ONE</Text>
          <Text style={styles.brandRole}>Driver</Text>
          <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  badge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#1B1B1B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  mark: { width: 82, height: 82, borderRadius: 18 },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginTop: 8,
  },
  brandRole: { color: "rgba(255,255,255,0.7)", fontSize: 13, letterSpacing: 0.4 },
  spinner: {
    marginTop: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    borderTopColor: ACCENT,
  },
});
