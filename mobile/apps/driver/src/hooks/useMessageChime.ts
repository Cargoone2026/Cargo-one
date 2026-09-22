/**
 * useMessageChime — driver-side global polling hook.
 *
 * Port of frontend/src/hooks/useMessageChime.js adapted to React
 * Native + Expo:
 *
 *   • Polls `GET /messages/unread-count` every 15 seconds.
 *   • Chimes when the total *increases* since the previous poll (the
 *     first poll is silent — otherwise a driver would feel a buzz on
 *     every launch when they already have unread threads).
 *   • Chime is delivered as a short haptic pulse via React Native's
 *     built-in `Vibration` API — no native modules to install and no
 *     Web Audio hacks. This is the mobile equivalent of the web's
 *     Web-Audio two-note ping.
 *   • Enabled/disabled preference is persisted to AsyncStorage under
 *     the same key the web uses (`cargoone_chime_enabled`) so a driver
 *     who muted on desktop stays muted on the phone if they share the
 *     same account. Falls back to enabled if nothing is stored.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Vibration } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DriverAPI } from "@cargoone/core";

export const CHIME_STORAGE_KEY = "cargoone_chime_enabled";
export const NOTIFICATION_CHIME_STORAGE_KEY = "cargoone_notification_chime_enabled";
const POLL_INTERVAL_MS = 15_000; // matches web

const VIBRATION_PATTERN = [0, 60, 60, 60]; // short-short — mimics web two-note ping

function playHapticChime() {
  try {
    Vibration.vibrate(VIBRATION_PATTERN);
  } catch {
    /* silent */
  }
}

export function useMessageChime({ enabled = true } = {}) {
  const [enabledPref, setEnabledPrefState] = useState(true);
  const [unread, setUnread] = useState(0);
  const lastCountRef = useRef<number | null>(null);
  const primedRef = useRef(false);

  // Hydrate persisted preference.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(CHIME_STORAGE_KEY)
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
    AsyncStorage.setItem(CHIME_STORAGE_KEY, v ? "1" : "0").catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await DriverAPI.messagesUnreadCount();
        if (cancelled) return;
        const count = Number(res?.total || 0);
        setUnread(count);
        const prev = lastCountRef.current;
        if (prev != null && count > prev && enabledPref && primedRef.current) {
          playHapticChime();
        }
        lastCountRef.current = count;
        // After the first poll completes, allow the chime to sound on
        // subsequent increases.
        primedRef.current = true;
      } catch {
        /* silent — offline is fine, keep last known count */
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
    // Skip the "primed" gate so drivers can preview the buzz.
    playHapticChime();
  }, []);

  return {
    unread,
    enabled: enabledPref,
    setEnabled,
    test,
  };
}
