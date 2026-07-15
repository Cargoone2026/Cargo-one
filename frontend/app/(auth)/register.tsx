import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Input } from "@/src/components/Input";
import { useAuth } from "@/src/context/AuthContext";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole = params.role === "driver" ? "driver" : "customer";
  const [role, setRole] = useState<"customer" | "driver">(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr(null);
    if (!name.trim() || !email.trim() || !password) {
      setErr("All fields required");
      return;
    }
    setLoading(true);
    try {
      await register({ email: email.trim(), password, name: name.trim(), phone, role });
    } catch (e: any) {
      setErr(e.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => router.back()}
            style={styles.back}
            testID="back-button"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>Join the Cargo One marketplace.</Text>

          <View style={styles.tabs}>
            <Pressable
              onPress={() => setRole("customer")}
              style={[styles.tab, role === "customer" && styles.tabActive]}
              testID="role-customer-tab"
            >
              <Ionicons
                name="person"
                size={18}
                color={role === "customer" ? "#fff" : colors.textSecondary}
              />
              <Text style={[styles.tabText, role === "customer" && styles.tabTextActive]}>
                I need to ship
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setRole("driver")}
              style={[styles.tab, role === "driver" && styles.tabActive]}
              testID="role-driver-tab"
            >
              <Ionicons
                name="car-sport"
                size={18}
                color={role === "driver" ? "#fff" : colors.textSecondary}
              />
              <Text style={[styles.tabText, role === "driver" && styles.tabTextActive]}>
                I&apos;m a driver
              </Text>
            </Pressable>
          </View>

          <View style={{ height: spacing.lg }} />

          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            testID="register-name-input"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="register-email-input"
          />
          <Input
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="+44 700 900 000"
            keyboardType="phone-pad"
            testID="register-phone-input"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            testID="register-password-input"
          />

          {role === "driver" ? (
            <View style={styles.notice}>
              <Ionicons name="information-circle" size={18} color={colors.accent} />
              <Text style={styles.noticeText}>
                Driver accounts require admin approval and document upload after registration.
              </Text>
            </View>
          ) : null}

          {err ? <Text style={styles.err} testID="register-error">{err}</Text> : null}

          <Button
            title={role === "driver" ? "Create driver account" : "Create account"}
            onPress={onSubmit}
            loading={loading}
            testID="register-submit-button"
            style={{ marginTop: spacing.md }}
          />

          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            style={styles.reg}
            testID="go-login-button"
          >
            <Text style={styles.regText}>
              Have an account? <Text style={styles.regLink}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  back: { alignSelf: "flex-start", marginBottom: spacing.lg, padding: spacing.xs },
  title: { fontSize: 32, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: font.lg, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  tabActive: { backgroundColor: colors.text },
  tabText: { fontSize: font.base, fontWeight: weight.medium, color: colors.textSecondary },
  tabTextActive: { color: "#fff" },
  err: { color: colors.error, marginBottom: spacing.md, fontSize: font.base },
  reg: { alignItems: "center", marginTop: spacing.xl, paddingVertical: spacing.sm },
  regText: { color: colors.textSecondary },
  regLink: { color: colors.brand, fontWeight: weight.semibold },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "#FFF7ED",
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
});
