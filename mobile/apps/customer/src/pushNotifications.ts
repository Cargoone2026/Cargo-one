/**
 * pushNotifications.ts — thin wrapper around expo-notifications used by both
 * the customer and driver apps. Exposes:
 *
 *   • initPushForegroundHandler()  — call once at app startup
 *   • registerForPushNotifications(register, unregister?)
 *       — call after login. Runs the permission prompt, obtains the
 *         ExponentPushToken, and hands it to a caller-provided `register`
 *         function (typically `CustomerAPI.registerPushToken` or
 *         `DriverAPI.registerPushToken`). Returns the token so the caller
 *         can persist it for later unregister-on-logout.
 *   • unregisterCurrentToken(unregister, token) — call before logout.
 *   • usePushNavigation(navigate) — hook that wires notification-tap events
 *         (foreground, background AND cold-start) to a navigation callback.
 *
 * Payload contract mirrors the backend push_notification helper:
 *   data: { booking_id?: string, job_id?: string, type?: string, ... }
 *
 * NOTE (build): expo-notifications ships a config plugin that injects the
 * iOS "Push Notifications" capability and `aps-environment` entitlement at
 * `expo prebuild` time. This project uses a hand-managed `ios/` directory
 * (no prebuild). The first physical-device APNs build therefore needs the
 * following Xcode capability added ONCE, manually:
 *   Signing & Capabilities → + Capability → Push Notifications
 * The Expo Push Service (used server-side) then relays to APNs and FCM
 * without any per-app keys in the mobile source.
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

export type PushDataPayload = {
  booking_id?: string;
  job_id?: string;
  type?: string;
  [k: string]: unknown;
};

let handlerInitialised = false;
export function initPushForegroundHandler() {
  if (handlerInitialised) return;
  handlerInitialised = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // Show the OS banner + sound even while the app is foregrounded so
      // the customer/driver still sees status changes without in-app polling.
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Runs the OS permission prompt, obtains the ExponentPushToken, and calls
 * `register(token, platform)`. Safe to call on every login — Expo will
 * short-circuit permission requests that were already granted, and the
 * backend upsert removes prior copies of the token before attaching it to
 * the caller. Returns the token (or null if denied / simulator / error).
 */
export async function registerForPushNotifications(
  register: (token: string, platform: "ios" | "android") => Promise<unknown>,
): Promise<string | null> {
  try {
    // Expo push tokens require a real device — simulator returns undefined
    // and would spam permission prompts.
    if (!Device.isDevice) return null;
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#D62828",
      });
    }
    // projectId is only strictly required when running via EAS Build — the
    // native runtime resolves it from `Expo.modules.ExponentConstants` on
    // classic builds. Wrapping in try/catch keeps development builds happy.
    // projectId is required by expo-notifications SDK 51+. Sourced from
    // `app.json → expo.extra.eas.projectId` (set by `eas init`) so the
    // real UUID never lives in source control. Falling back to
    // `easConfig.projectId` covers app.config-based projects.
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp?.data;
    if (!token || !token.startsWith("ExponentPushToken[")) return null;
    await register(token, Platform.OS === "ios" ? "ios" : "android").catch(() => null);
    return token;
  } catch {
    return null;
  }
}

export async function unregisterCurrentToken(
  unregister: (token: string) => Promise<unknown>,
  token: string | null,
) {
  if (!token) return;
  try {
    await unregister(token);
  } catch {
    // silent — logout must never be blocked by a failing push unregister
  }
}

/**
 * Wires foreground + background + cold-start notification taps to a
 * `navigate(payload)` callback. Cold-start uses
 * `getLastNotificationResponseAsync` and is dispatched exactly ONCE per
 * mount to avoid re-navigating on every focus change.
 */
export function usePushNavigation(navigate: (data: PushDataPayload) => void) {
  const coldStartHandled = useRef(false);

  useEffect(() => {
    // 1. Cold-start — user tapped a notification while the app was killed.
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      Notifications.getLastNotificationResponseAsync().then((resp) => {
        const data = resp?.notification?.request?.content?.data as PushDataPayload | undefined;
        if (data) navigate(data);
      });
    }
    // 2. User tapped a notification while the app was background/foreground.
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp?.notification?.request?.content?.data as PushDataPayload | undefined;
      if (data) navigate(data);
    });
    return () => sub.remove();
  }, [navigate]);
}
