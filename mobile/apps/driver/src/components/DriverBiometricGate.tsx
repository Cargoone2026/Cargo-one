/**
 * DriverBiometricGate — Face ID / Touch ID cold-start gate for the
 * Driver app. Ports the behaviour of
 * `mobile/apps/customer/src/components/BiometricGate.tsx` onto the
 * Driver AuthContext and Driver visual language.
 *
 * Behaviour contract (same as Customer):
 *   1. Wait for AuthContext to finish hydrating.
 *   2. If no `user`, resolve immediately (never block the Login flow).
 *   3. If a `user` exists, call `listPasskeys()` from `@cargoone/core`.
 *      Zero passkeys ⇒ resolve immediately (no biometric enrolment on
 *      the backend to enforce against).
 *   4. If ≥ 1 passkey AND the device has biometric hardware AND the
 *      user has enrolled a biometric, prompt via
 *      `LocalAuthentication.authenticateAsync({ promptMessage:
 *      "Unlock Cargo One Driver" })`.
 *   5. Success → render children. Any failure / cancel / exception →
 *      show a Driver-branded fallback with "Try Face ID again" and
 *      "Log out".
 *   6. Global 5-second fuse: if ANY native call stalls (module
 *      missing, prompt frozen, listPasskeys hangs on a slow network),
 *      resolve `unlocked` so the user can never be permanently locked
 *      out of their own app.
 *   7. One-shot per cold start — the effect only runs once, keyed on
 *      the mount of this gate component. Navigating around does NOT
 *      re-trigger.
 *
 * NOTE: `listPasskeys()` only hits the backend at /auth/passkey/list;
 * it does NOT require the `react-native-passkey` native module to be
 * loaded (that is lazy-required only by register/login flows). So the
 * Driver app can enforce passkey-gated Face ID without adding the
 * passkey native dep — matching the Phase-4 locked exclusion.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as LocalAuth from "expo-local-authentication";
import { listPasskeys } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius } from "../theme";

type Phase = "checking" | "prompting" | "unlocked" | "failed";

export function DriverBiometricGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const [phase, setPhase] = useState<Phase>("checking");

  const prompt = useCallback(async () => {
    setPhase("prompting");
    try {
      const res = await LocalAuth.authenticateAsync({
        promptMessage: "Unlock Cargo One Driver",
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
    // AuthContext uses `loading`; mirror Customer's `hydrated` by
    // waiting until the hydration pass completes.
    if (loading) return;
    if (!user) {
      setPhase("unlocked");
      return;
    }
    let cancelled = false;
    // 5-second global fuse — exactly like Customer. Guarantees the
    // Driver can never be permanently locked out of their own app if
    // a native call hangs.
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
    // Deliberately only re-run when the hydration flip or user id
    // changes — not on every re-render of children.
  }, [loading, user, prompt]);

  if (phase === "unlocked") return <>{children}</>;

  // `checking` keeps the previously-rendered DriverLoadingScreen
  // visible underneath (App.tsx stacks it beneath the authenticated
  // tree while loading). Rendering nothing here avoids a frame of
  // layout shift when the gate first mounts.
  if (phase === "checking") return null;

  return (
    <View style={styles.wrap} testID="driver-biometric-gate">
      <View style={styles.center}>
        <View style={styles.iconBadge} testID="driver-biometric-icon">
          <View style={styles.iconDot} />
          <View style={styles.iconRing} />
        </View>
        <Text style={styles.title}>Cargo One Driver is locked</Text>
        <Text style={styles.body}>
          Unlock with Face ID to continue. Your session is protected by the
          passkey you set on this device.
        </Text>
        <Pressable
          onPress={prompt}
          style={styles.primary}
          testID="driver-biometric-retry"
        >
          <Text style={styles.primaryText}>Try Face ID again</Text>
        </Pressable>
        <Pressable
          onPress={() => logout()}
          hitSlop={8}
          testID="driver-biometric-logout"
        >
          <Text style={styles.secondaryText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0A0A0A" },
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
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "rgba(214,40,40,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconRing: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
    borderTopColor: colors.brand,
  },
  iconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  secondaryText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    marginTop: 6,
  },
});
