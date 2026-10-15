import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { DriverAPI } from "@cargoone/core";
import type { RootStackParamList } from "./App";

// App-level ASAP tracking: posts foreground location to /tracking/{booking_id}
// for the driver's active paid ASAP booking, whichever screen is open.
const ACTIVE_STATUSES = new Set(["confirmed", "deposit_paid", "travelling", "arrived", "collected", "on_route"]);
const MIN_DISTANCE_METERS = 30;
const MIN_INTERVAL_MS = 45_000;
const ACTIVE_RECHECK_MS = 30_000;
const IDLE_TRIGGER_MIN_GAP_MS = 20_000;

function pickActiveAsap(rows: any[] | null | undefined): string | null {
  const b = (rows || []).find(
    (x) =>
      x?.payment_status === "paid" &&
      (x.service_timing || x.job?.service_timing) === "asap" &&
      ACTIVE_STATUSES.has(x.status) &&
      !x.cancelled_at,
  );
  return b?.id ?? null;
}

export function AsapTrackingBridge({
  navigationRef,
}: {
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const lastCheckRef = useRef(0);
  const lastPushRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

  const check = useCallback(async () => {
    lastCheckRef.current = Date.now();
    try {
      setBookingId(pickActiveAsap(await DriverAPI.myBookings()));
    } catch {
      /* keep previous value; next trigger retries */
    }
  }, []);

  // Idle triggers (no interval): login, return to foreground, screen changes.
  useEffect(() => {
    check();
    const appSub = AppState.addEventListener("change", (s) => {
      setForeground(s === "active");
      if (s === "active") check();
    });
    const navUnsub = navigationRef.addListener("state", () => {
      if (Date.now() - lastCheckRef.current >= IDLE_TRIGGER_MIN_GAP_MS) check();
    });
    return () => {
      appSub.remove();
      navUnsub();
    };
  }, [check, navigationRef]);

  // 30 s re-check only while an active ASAP booking exists and the app is foregrounded.
  useEffect(() => {
    if (!bookingId || !foreground) return;
    const iv = setInterval(check, ACTIVE_RECHECK_MS);
    return () => clearInterval(iv);
  }, [bookingId, foreground, check]);

  // Foreground-only location watch (When-In-Use).
  useEffect(() => {
    if (!bookingId || !foreground) return;
    let sub: Location.LocationSubscription | null = null;
    let stopped = false;
    (async () => {
      let granted = (await Location.getForegroundPermissionsAsync()).granted;
      if (!granted) granted = (await Location.requestForegroundPermissionsAsync()).granted;
      if (!granted || stopped) return;
      try {
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 20 },
          async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            const now = Date.now();
            const last = lastPushRef.current;
            if (last) {
              const dLat = (lat - last.lat) * 111000;
              const dLng = (lng - last.lng) * 111000 * Math.cos((lat * Math.PI) / 180);
              if (Math.sqrt(dLat * dLat + dLng * dLng) < MIN_DISTANCE_METERS && now - last.t < MIN_INTERVAL_MS) return;
            }
            try {
              await DriverAPI.pushTracking(bookingId, lat, lng);
              lastPushRef.current = { lat, lng, t: now };
            } catch {
              /* next fix retries */
            }
          },
        );
        if (stopped) s.remove();
        else sub = s;
      } catch {
        /* location unavailable — stop silently */
      }
    })();
    return () => {
      stopped = true;
      try { sub?.remove(); } catch { /* noop */ }
    };
  }, [bookingId, foreground]);

  return null;
}
