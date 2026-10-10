/**
 * Driver push wrapper — same logic as apps/customer/src/pushNotifications.ts
 * (permission → ExponentPushToken → backend register, cold-start/foreground
 * tap handling with 60s freshness + response-id dedupe).
 * Loaded lazily from App.tsx only after login, never at boot.
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import type { DriverPushData } from "./pushRoutes";

let handlerInitialised = false;
export function initPushForegroundHandler() {
  if (handlerInitialised) return;
  handlerInitialised = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    } as any),
  });
}

export async function registerForPushNotifications(
  register: (token: string, platform: "ios" | "android") => Promise<unknown>,
): Promise<string | null> {
  try {
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
    // logout must never be blocked by a failing unregister
  }
}

export function usePushNavigation(navigate: (data: DriverPushData) => void) {
  const coldStartHandled = useRef(false);
  const lastHandledResponseId = useRef<string | null>(null);

  useEffect(() => {
    // Ignore stale (>60s) cached cold-start responses and double-dispatch of the same tap.
    const STALE_THRESHOLD_MS = 60_000;
    function shouldProcess(resp: Notifications.NotificationResponse | null): boolean {
      if (!resp) return false;
      const id = resp.notification?.request?.identifier;
      if (typeof id === "string" && id && lastHandledResponseId.current === id) return false;
      const rawDate = (resp.notification as any)?.date;
      const dateMs =
        typeof rawDate === "number" && Number.isFinite(rawDate)
          ? rawDate < 1e12
            ? rawDate * 1000
            : rawDate
          : NaN;
      const ageMs = Number.isFinite(dateMs) ? Date.now() - dateMs : NaN;
      if (!Number.isFinite(ageMs) || ageMs > STALE_THRESHOLD_MS) return false;
      if (typeof id === "string" && id) lastHandledResponseId.current = id;
      return true;
    }

    const handle = (resp: Notifications.NotificationResponse | null) => {
      const content = resp?.notification?.request?.content;
      if (!content) return;
      if (!shouldProcess(resp)) return;
      navigate({ ...((content.data as DriverPushData) || {}), title: content.title ?? undefined });
    };

    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      Notifications.getLastNotificationResponseAsync().then(handle);
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [navigate]);
}
