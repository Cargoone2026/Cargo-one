import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="welcome-screen">
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1620455800201-7f00aeef12ed?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMGRlbGl2ZXJ5JTIwdmFufGVufDB8fHx8MTc4NDEzNjI1MHww&ixlib=rb-4.1.0&q=85",
        }}
        style={styles.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.85)", "#000"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="cube" size={22} color="#fff" />
            </View>
            <Text style={styles.brand}>CARGO ONE</Text>
          </View>

          <View style={styles.center}>
            <Text style={styles.headline}>Ship Anything.{"\n"}Anywhere.</Text>
            <Text style={styles.subline}>Instant Quotes. Trusted Drivers. Live Tracking.</Text>
          </View>

          <View style={styles.actions}>
            <Button
              title="Get Started"
              onPress={() => router.push("/(auth)/register?role=customer")}
              testID="get-started-button"
            />
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              style={styles.loginRow}
              testID="have-account-button"
            >
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginLink}>Log in</Text>
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(auth)/register?role=driver")}
              style={styles.driverRow}
              testID="become-driver-button"
            >
              <Ionicons name="car-sport" size={18} color="#fff" />
              <Text style={styles.driverText}>Become a Driver</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#fff", fontSize: font.lg, fontWeight: weight.bold, letterSpacing: 2 },
  center: { flex: 1, justifyContent: "flex-end", paddingBottom: spacing.xl },
  headline: {
    color: "#fff",
    fontSize: 44,
    fontWeight: weight.bold,
    lineHeight: 50,
    letterSpacing: -1,
  },
  subline: {
    color: "rgba(255,255,255,0.75)",
    fontSize: font.lg,
    marginTop: spacing.md,
    lineHeight: 24,
  },
  actions: { paddingBottom: spacing.md, gap: spacing.lg },
  loginRow: { alignItems: "center", paddingVertical: spacing.sm },
  loginText: { color: "rgba(255,255,255,0.7)", fontSize: font.base },
  loginLink: { color: "#fff", fontWeight: weight.semibold },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  driverText: { color: "#fff", fontSize: font.base, fontWeight: weight.semibold },
});
