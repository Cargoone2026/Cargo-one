/**
 * LoadingScreen — CargoOne branded initial loader.
 *
 * Renders full-bleed CargoOne red with a white circular badge and the
 * red parcel mark inside, matching the reference for the customer app.
 * Respects safe-area insets on iPhone / iPad.
 *
 * Kept purely presentational — the caller decides when to unmount it.
 * It never runs its own timer.
 */
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RED = "#D62828";

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <SafeAreaView style={styles.root} testID="customer-loading-screen">
      <View style={styles.center}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.badge}>
          <Image
            source={require("../../assets/loading-mark.png")}
            style={styles.mark}
            resizeMode="contain"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: RED,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  badge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // subtle depth so the badge doesn't merge with the red bg on OLED
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  mark: {
    width: 60,
    height: 60,
  },
});
