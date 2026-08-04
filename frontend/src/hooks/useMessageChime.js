import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "cargoone_chime_enabled";
const POLL_INTERVAL_MS = 15000; // 15 s — balances "instant" feel vs. traffic

/**
 * useMessageChime — driver-side (or any-role) global polling hook that
 * plays a short audible chime whenever the caller's unread-message count
 * INCREASES since the previous poll. Also exposes a boolean toggle backed
 * by localStorage so drivers can silence it while off-shift without
 * losing the badge.
 *
 * Design notes:
 *  - We synthesize the chime with Web Audio at runtime (two-note ping);
 *    zero audio assets, zero CDN load, zero autoplay policy issues because
 *    the AudioContext is only resumed on user interaction.
 *  - We NEVER play a sound on the first poll — otherwise the driver would
 *    hear a chime on every page load if they already had 1+ unread.
 *  - We update `lastCount` on every poll so a burst of messages still
 *    plays only ONE chime (per poll window) — matches the messaging
 *    email throttle expectation of "notify without flooding".
 */
export function useMessageChime({ enabled = true } = {}) {
  const [enabledPref, setEnabledPref] = useState(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "1";
  });
  const [unread, setUnread] = useState(0);
  const audioCtxRef = useRef(null);
  const lastCountRef = useRef(null);
  const primedRef = useRef(false);

  // Persist preference.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, enabledPref ? "1" : "0");
  }, [enabledPref]);

  // Unlock the AudioContext on first user gesture — otherwise browsers
  // suspend the context and our chime is silent.
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

  // Poll the unread-count endpoint. Chime when it increases.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api("/messages/unread-count");
        const count = Number(res?.total || 0);
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
    /** Manually play the chime — useful for a settings-page "test" button. */
    test: () => playChime(audioCtxRef.current),
  };
}

/** Two-note "bing" chime, ~350 ms. */
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
