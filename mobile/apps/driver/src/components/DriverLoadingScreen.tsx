/**
 * DriverLoadingScreen — Cargo One Driver branded cold-start / hydration
 * surface. Replaces the plain ActivityIndicator previously shown in
 * App.tsx while AuthContext hydrates.
 *
 * Visual language — Driver dark palette, NOT Customer red:
 *   • Full-bleed #0A0A0A background. Matches the Driver iOS LaunchScreen
 *     storyboard background (configured in app.json) so the handoff
 *     from native splash → JS loader has zero visual flash.
 *   • Literal animated cube rendered as an isometric projection:
 *     three parallelogram faces (top, right, front) built with the
 *     React Native transforms that are proven safe on Hermes / RN
 *     0.74 iOS — `skewX`, `skewY`, `scaleX`, `scaleY`, `rotate`,
 *     `translateX`, `translateY`, `perspective`.
 *   • `translateZ` is DELIBERATELY NOT USED. It is accepted by TS's
 *     widened cast but Hermes throws
 *     "Invariant Violation: Invalid transform translateZ" at runtime
 *     on physical devices with the installed RN version. The isometric
 *     approach gives an unambiguous "cube" silhouette without needing
 *     a true z-axis.
 *   • Front face displays the existing Driver `loading-mark.png` asset
 *     (same mark used by the LaunchScreen) with Cargo One red edges on
 *     every face for brand continuity.
 *   • CARGO ONE / Driver wordmark beneath; rhythm mirrors the Customer
 *     LoadingScreen without copying its colours or shapes.
 *
 * Animation (all `useNativeDriver: true`):
 *   • 320 ms opacity fade-in on first mount.
 *   • Container rotation 0° → 360° linear over 10 s, infinite loop.
 *   • Container scale 0.97 ↔ 1.03 over 2.4 s, ease-in-out, loop reverse.
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0A0A0A";
const BRAND = "#D62828";
const EDGE = "rgba(214,40,40,0.55)";

const S = 72;         // cube face size (front face square side)
const DEPTH = S / 2;  // visual depth projected onto the 2D plane

export function DriverLoadingScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

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
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fade, spin, breath]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.03],
  });

  return (
    <View style={styles.root} testID="driver-loading-screen">
      <SafeAreaView
        style={styles.safe}
        edges={["top", "bottom", "left", "right"]}
      >
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <View style={styles.stage}>
            <Animated.View
              style={[
                styles.cube,
                { transform: [{ rotate }, { scale }] },
              ]}
            >
              {/* Top face — parallelogram leaning right-and-up */}
              <View style={styles.topFace} testID="cube-top-face" />
              {/* Right face — parallelogram leaning right-and-down */}
              <View style={styles.rightFace} testID="cube-right-face" />
              {/* Front face — plain square with loading-mark */}
              <View style={styles.frontFace} testID="cube-front-face">
                <Image
                  source={require("../../assets/loading-mark.png")}
                  style={styles.mark}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>
            <View style={styles.shadow} />
          </View>

          <Text style={styles.brandTitle}>CARGO ONE</Text>
          <Text style={styles.brandRole}>Driver</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: "transparent" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  stage: {
    width: S + DEPTH + 20,
    height: S + DEPTH + 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cube: {
    width: S + DEPTH,
    height: S + DEPTH,
    position: "relative",
  },

  // Front face — plain square at bottom-left of the stage.
  frontFace: {
    position: "absolute",
    left: 0,
    top: DEPTH,
    width: S,
    height: S,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mark: {
    width: S - 20,
    height: S - 20,
    borderRadius: 12,
  },

  // Right face — square foreshortened (scaleX 0.5) + sheared vertically
  // via skewY(-45°). Positioned flush to the front face's right edge.
  rightFace: {
    position: "absolute",
    left: S - DEPTH / 2,
    top: DEPTH + DEPTH / 2,
    width: S,
    height: S,
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: EDGE,
    transform: [{ skewY: "-45deg" }, { scaleX: 0.5 }],
    transformOrigin: "left top",
  },

  // Top face — square flattened (scaleY 0.5) + sheared horizontally via
  // skewX(-45°). Sits atop the front face.
  topFace: {
    position: "absolute",
    left: DEPTH / 2,
    top: 0,
    width: S,
    height: S,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: EDGE,
    transform: [{ skewX: "-45deg" }, { scaleY: 0.5 }],
    transformOrigin: "left top",
  },

  shadow: {
    position: "absolute",
    bottom: 0,
    width: (S + DEPTH) * 0.75,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(214,40,40,0.08)",
  },

  brandTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2.0,
    marginTop: 10,
  },
  brandRole: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});

// Named export kept for callers that want to match the loader accent
// elsewhere (currently unused inside this file but part of the public
// surface established in the previous phase).
export { BRAND as DRIVER_LOADER_BRAND };
