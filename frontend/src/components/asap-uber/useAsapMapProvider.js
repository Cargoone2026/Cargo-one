/**
 * useAsapMapProvider — ASAP UX map abstraction hook.
 *
 * Returns the current map provider ("mapbox" or "google") along with a
 * capabilities object. This hook exists so the shared ASAP Uber-style
 * components (`AsapMapCanvas`, driver Live, customer Dispatch) never
 * import a concrete map SDK directly — they consume this abstraction.
 *
 * Native (iOS/Android) can later reimplement this hook with the same
 * shape to return `native-mapbox` without touching the ASAP UI code.
 *
 * Web behaviour today (unchanged from R27):
 *   • If REACT_APP_MAPBOX_TOKEN is set → prefer "mapbox" (real Mapbox GL).
 *   • Else fall back to "google" (Google Maps JS SDK, iOS Safari safe).
 *   • The actual map component (`DriverLiveMap` / future canvas) still
 *     performs the same runtime fallback on Mapbox init failure — this
 *     hook only reports the *preferred* provider.
 */
import { useMemo } from "react";

export function useAsapMapProvider() {
  return useMemo(() => {
    const hasToken = Boolean(process.env.REACT_APP_MAPBOX_TOKEN);
    const provider = hasToken ? "mapbox" : "google";
    return {
      provider,
      // Web browsers can always show a full-screen map. Native later can
      // add capabilities like offline tiles or turn-by-turn without any
      // UI change on our side.
      capabilities: {
        fullScreen: true,
        markers: true,
        sweep: provider === "mapbox",
        route: true,
        recenter: true,
      },
    };
  }, []);
}

export default useAsapMapProvider;
