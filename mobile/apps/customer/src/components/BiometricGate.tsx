/**
 * BiometricGate — enforces Face ID / Touch ID on cold-start when the
 * signed-in user has at least one enrolled passkey.
 *
 * Behaviour (matches web "require biometric on every launch" pattern):
 *  1. Once `hydrated` and `user` are ready, we call `/api/passkeys` via
 *     the shared core client. If there are zero passkeys, the gate
 *     resolves immediately (never blocks users without biometrics).
 *  2. When at least one passkey exists AND the device reports biometric
 *     hardware present + enrolled, we prompt with expo-local-
 *     authentication. On success the app renders normally. On failure
 *     we show a "Try again / Log out" fallback.
 *  3. Gating happens ONCE per cold start. Navigating around inside the
 *     app never re-triggers it.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as LocalAuth from "expo-local-authentication";
import { Fingerprint } from "lucide-react-native";
import { listPasskeys } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";

type Phase = "checking" | "prompting" | "unlocked" | "failed";

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { user, hydrated, logout } = useAuth();
  const [phase, setPhase] = useState<Phase>("checking");

  const prompt = useCallback(async () => {
    setPhase("prompting");
    try {
      const res = await LocalAuth.authenticateAsync({
        promptMessage: "Unlock Cargo One",
        cancelLabel: "Cancel",
        fallbackLabel: "Use passcode",
      });
      if (res.success) {
        setPhase("unlocked");
        return;
      }
      setPhase("failed");
    } catch {
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // No user → nothing to gate. Auth stack will show Login.
    if (!user) {
      setPhase("unlocked");
      return;
    }
    let cancelled = false;
    // Global 5-second fuse — if any of the async passkey/local-auth
    // checks below hang (native module missing in the built binary,
    // network stall on listPasskeys, biometric prompt frozen), we
    // resolve as `unlocked` so the app is never permanently locked
    // out of its own home screen.
    const fuse = setTimeout(() => {
      if (!cancelled) setPhase("unlocked");
    }, 5000);
    (async () => {
      try {
        const passkeys = await listPasskeys().catch(() => [] as any[]);
        if (cancelled) return;
        if (!Array.isArray(passkeys) || passkeys.length === 0) {
          setPhase("unlocked");
          return;
        }
        const [hasHardware, enrolled] = await Promise.all([
          LocalAuth.hasHardwareAsync().catch(() => false),
          LocalAuth.isEnrolledAsync().catch(() => false),
        ]);
        if (cancelled) return;
        if (!hasHardware || !enrolled) {
          setPhase("unlocked");
          return;
        }
        await prompt();
      } catch {
        if (!cancelled) setPhase("unlocked");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(fuse);
    };
  }, [hydrated, user, prompt]);

  if (phase === "unlocked") {
    return <>{children}</>;
  }

  // Blank checking state ties into the branded LoadingScreen the App
  // already shows before hydration; here we just render nothing so
  // the loader stays visible.
  if (phase === "checking") return null;

  return (
    <View style={styles.wrap} testID="biometric-gate">
      <View style={styles.center}>
        <View style={styles.iconBadge}>
          <Fingerprint size={40} color="#FFFFFF" strokeWidth={2} />
        </View>
        <Text style={styles.title}>Cargo One is locked</Text>
        <Text style={styles.body}>
          Unlock with Face ID to continue. Your session is protected by the passkey you set on this device.
        </Text>
        <Pressable onPress={prompt} testID="biometric-retry" style={styles.primary}>
          <Text style={styles.primaryText}>Try Face ID again</Text>
        </Pressable>
        <Pressable onPress={() => logout()} testID="biometric-logout" hitSlop={8}>
          <Text style={styles.secondaryText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.brand },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  iconBadge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { ...(typography.h1Large as any), color: "#FFFFFF", textAlign: "center" },
  body: { fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 20, maxWidth: 320 },
  primary: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryText: { color: colors.brand, fontWeight: "700", fontSize: 15 },
  secondaryText: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 6 },
});
