import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "cargoone_notification_chime_enabled";
const POLL_INTERVAL_MS = 15000;

/**
 * useNotificationChime — driver-side (or customer-side) global polling
 * hook that plays a short audible chime whenever the count of unread
 * notifications on GET /notifications INCREASES since the previous poll.
 *
 * Mirrors `useMessageChime` (2-note bing, localStorage toggle, unlock-on-
 * gesture) but reads a DIFFERENT endpoint so message- and notification-
 * chimes never fight each other. Keeps its own persisted preference key.
 */
export function useNotificationChime({ enabled = true } = {}) {
  const [enabledPref, setEnabledPref] = useState(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "1";
  });
  const [unread, setUnread] = useState(0);
  const audioCtxRef = useRef(null);
  const lastCountRef = useRef(null);
  const primedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, enabledPref ? "1" : "0");
  }, [enabledPref]);

  useEffect(() => {
    if (!enabled) return undefined;
    const unlock = () => {
      if (!audioCtxRef.current) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) audioCtxRef.current = new Ctx();
        } catch { /* ignored */ }
      }
      audioCtxRef.current?.resume?.().catch(() => {});
      primedRef.current = true;
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const list = await api("/notifications");
        const arr = Array.isArray(list) ? list : [];
        const count = arr.filter((n) => !n.read).length;
        if (cancelled) return;
        setUnread(count);
        const prev = lastCountRef.current;
        if (prev != null && count > prev && enabledPref && primedRef.current) {
          playChime(audioCtxRef.current);
        }
        lastCountRef.current = count;
      } catch { /* silent */ }
    };
    tick();
    const iv = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [enabled, enabledPref]);

  return {
    unread,
    enabled: enabledPref,
    setEnabled: setEnabledPref,
    test: () => playChime(audioCtxRef.current),
  };
}

/** Two-note "bing" chime, ~350 ms. Kept in sync with useMessageChime. */
function playChime(ctx) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.001, now);
  master.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  master.connect(ctx.destination);
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, now + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.25);
    osc.connect(g);
    g.connect(master);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.3);
  });
}
