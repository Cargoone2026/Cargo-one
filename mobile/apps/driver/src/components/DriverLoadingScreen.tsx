/**
 * DriverLoadingScreen — Cargo One Driver branded cold-start / hydration
 * surface. Replaces the plain ActivityIndicator previously shown in
 * App.tsx while AuthContext hydrates.
 *
 * Visual language — Driver dark palette, NOT Customer red:
 *   • Full-bleed #0A0A0A background. Matches the Driver iOS LaunchScreen
 *     storyboard background (configured in app.json) so the handoff
 *     from native splash → JS loader has zero visual flash.
 *   • Literal animated cube built from six absolutely-positioned RN
 *     <View>s inside an <Animated.View> whose container rotates on two
 *     axes. CSS 3D via standard React Native transform properties
 *     (perspective + translateZ + rotateX/rotateY + backfaceVisibility:
 *     hidden). No reanimated, no gesture handler, no new native dep.
 *   • Front face displays the existing Driver `loading-mark.png` asset
 *     (same mark used by the LaunchScreen) with a thin Cargo One red
 *     edge treatment for brand continuity.
 *   • CARGO ONE / Driver wordmark beneath; rhythm mirrors the Customer
 *     LoadingScreen without copying any of its colours or shapes.
 *
 * Performance: every transform uses useNativeDriver=true so the UI
 * thread never blocks on the hydration pass. Two parallel animated
 * values (tumble X ~6s linear loop, tumble Y ~8s linear loop) produce
 * a slow premium tumble that reads as intentional, not frantic.
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0A0A0A";
const FACE_SIZE = 92;
const FACE_HALF = FACE_SIZE / 2;
const BRAND = "#D62828";
const DARK_SURFACE = "#141414";
const EDGE = "rgba(214,40,40,0.55)";

type FaceTransform = NonNullable<ViewStyle["transform"]>;
type Face = {
  key: "front" | "back" | "right" | "left" | "top" | "bottom";
  transform: FaceTransform;
  tint: string;
};

// `translateZ` is accepted by React Native's iOS transform runtime
// (processTransform.js converts it to a CATransform3D) but is missing
// from the typed discriminated union in @types/react-native 0.74.x.
// We build each face's transform array as plain data and cast the
// whole array as `FaceTransform` so TS is happy without disabling
// strict mode across the file.
const faceTransform = (parts: Array<Record<string, number | string>>): FaceTransform =>
  parts as unknown as FaceTransform;

const FACES: Face[] = [
  { key: "front",  transform: faceTransform([{ translateZ: FACE_HALF }]),                        tint: DARK_SURFACE },
  { key: "back",   transform: faceTransform([{ rotateY: "180deg" }, { translateZ: FACE_HALF }]), tint: "#101010" },
  { key: "right",  transform: faceTransform([{ rotateY: "90deg" },  { translateZ: FACE_HALF }]), tint: "#121212" },
  { key: "left",   transform: faceTransform([{ rotateY: "-90deg" }, { translateZ: FACE_HALF }]), tint: "#121212" },
  { key: "top",    transform: faceTransform([{ rotateX: "90deg" },  { translateZ: FACE_HALF }]), tint: "#161616" },
  { key: "bottom", transform: faceTransform([{ rotateX: "-90deg" }, { translateZ: FACE_HALF }]), tint: "#0D0D0D" },
];

export function DriverLoadingScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const tumbleX = useRef(new Animated.Value(0)).current;
  const tumbleY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.loop(
      Animated.timing(tumbleX, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.timing(tumbleY, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [fade, tumbleX, tumbleY]);

  const rotateX = tumbleX.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const rotateY = tumbleY.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
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
                {
                  transform: [
                    { perspective: 900 },
                    { rotateX },
                    { rotateY },
                  ],
                },
              ]}
            >
              {FACES.map((f) => (
                <View
                  key={f.key}
                  style={[
                    styles.face,
                    { backgroundColor: f.tint, transform: f.transform },
                  ]}
                >
                  {f.key === "front" ? (
                    <Image
                      source={require("../../assets/loading-mark.png")}
                      style={styles.mark}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              ))}
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
    width: FACE_SIZE + 40,
    height: FACE_SIZE + 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cube: {
    width: FACE_SIZE,
    height: FACE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    position: "absolute",
    width: FACE_SIZE,
    height: FACE_SIZE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: EDGE,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
    overflow: "hidden",
  },
  mark: {
    width: FACE_SIZE - 24,
    height: FACE_SIZE - 24,
    borderRadius: 14,
  },
  shadow: {
    position: "absolute",
    bottom: 0,
    width: FACE_SIZE * 0.9,
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

// Avoid an unused-import complaint if BRAND is tree-shaken in minified
// builds — it is referenced via styles above but kept as a named export
// so callers can match the loader shade elsewhere if needed.
export { BRAND as DRIVER_LOADER_BRAND };
