/**
 * useNotificationChime — driver-side global polling hook for
 * *notifications* (as opposed to booking messages). Mirrors
 * frontend/src/hooks/useNotificationChime.js:
 *
 *   • Polls `GET /notifications` every 15 seconds.
 *   • Chimes when the *unread* count increases since the previous
 *     poll. The chime is a short haptic buzz — see useMessageChime.ts
 *     for the rationale.
 *   • Enabled/disabled preference is persisted under a separate
 *     AsyncStorage key so a driver can silence the message chime
 *     while keeping notifications audible (or vice-versa).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Vibration } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DriverAPI, type DriverNotification } from "@cargoone/core";
import { NOTIFICATION_CHIME_STORAGE_KEY } from "./useMessageChime";

const POLL_INTERVAL_MS = 15_000;
const VIBRATION_PATTERN = [0, 40, 40, 40, 40, 40];

function playHapticChime() {
  try {
    Vibration.vibrate(VIBRATION_PATTERN);
  } catch {
    /* silent */
  }
}

function unreadOf(list: DriverNotification[]): number {
  return list.filter((n) => !n.read && !n.read_at).length;
}

export function useNotificationChime({ enabled = true } = {}) {
  const [enabledPref, setEnabledPrefState] = useState(true);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<DriverNotification[]>([]);
  const lastCountRef = useRef<number | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(NOTIFICATION_CHIME_STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw !== null) setEnabledPrefState(raw === "1");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledPrefState(v);
    AsyncStorage.setItem(NOTIFICATION_CHIME_STORAGE_KEY, v ? "1" : "0").catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const list = await DriverAPI.listNotifications();
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setItems(arr);
        const count = unreadOf(arr);
        setUnread(count);
        const prev = lastCountRef.current;
        if (prev != null && count > prev && enabledPref && primedRef.current) {
          playHapticChime();
        }
        lastCountRef.current = count;
        primedRef.current = true;
      } catch {
        /* silent */
      }
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, enabledPref]);

  const test = useCallback(() => {
    playHapticChime();
  }, []);

  return {
    unread,
    items,
    enabled: enabledPref,
    setEnabled,
    test,
  };
}
