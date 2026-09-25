// -----------------------------------------------------------------------------
// TEMPORARY DIAGNOSTIC — R71.16.5 physical-device startup trace.
//
// index.ts is the FIRST file the RN JS runtime evaluates. It must not throw,
// so every step below is wrapped in an explicit try/catch and its outcome is
// recorded in the BootRecorder singleton. The BootRecorder is imported first
// (before ANY React Native module) so a downstream failure can still be
// captured and later rendered on-device by `BootDiagnosticApp`.
//
// On-device output paths (both active simultaneously):
//   (a) console.log with the `[Driver:boot]` prefix — visible in Xcode Console
//       (Devices & Simulators → Open Console, filter process `CargoOneDriver`).
//   (b) BootRecorder — mirrored on-screen by `BootDiagnosticApp` so we can
//       diagnose without needing a Mac console attached.
//
// If checkpoint 0 does NOT appear on either channel after a rebuild, the JS
// runtime is not executing at all — that points at native / signing /
// entitlements / bundle-delivery, not at any JS-side fix.
//
// DELETE THIS FILE'S TEMPORARY SCAFFOLDING AND RESTORE THE ORIGINAL 4-LINE
// `index.ts` ONCE THE ROOT CAUSE IS IDENTIFIED. The original was:
//
//   import "react-native-gesture-handler";
//   import { registerRootComponent } from "expo";
//   import { App } from "./src/App";
//   registerRootComponent(App);
// -----------------------------------------------------------------------------

import { bootRecorder } from "./src/BootRecorder";

// Global JS error handler — must be installed BEFORE any other module load so
// that any uncaught throw from a subsequent require() ends up on-screen.
try {
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (err: Error, isFatal?: boolean) => void;
      setGlobalHandler?: (fn: (err: Error, isFatal?: boolean) => void) => void;
    };
  };
  const prev = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((err, isFatal) => {
    const e = err instanceof Error ? err : new Error(String(err));
    bootRecorder.record(
      -1,
      `Uncaught (fatal=${String(isFatal)}) ${e.name}: ${e.message}`,
      false,
      e.stack,
    );
    if (prev) {
      try {
        prev(err, isFatal);
      } catch {
        /* silent */
      }
    }
  });
} catch {
  /* silent — never let error-handler setup itself abort boot */
}

bootRecorder.record(0, "index.ts is executing (before any RN import)", true);

// Step 1 — gesture handler must load first for react-navigation gestures.
try {
  require("react-native-gesture-handler");
  bootRecorder.record(1, "react-native-gesture-handler required", true);
} catch (err) {
  const e = err instanceof Error ? err : new Error(String(err));
  bootRecorder.record(1, "react-native-gesture-handler FAILED", false, `${e.name}: ${e.message}`);
}

// Step 2 — Expo's registerRootComponent.
let registerRootComponent: ((c: React.ComponentType<Record<string, unknown>>) => void) | undefined;
try {
  registerRootComponent = require("expo").registerRootComponent;
  bootRecorder.record(2, "expo.registerRootComponent resolved", true);
} catch (err) {
  const e = err instanceof Error ? err : new Error(String(err));
  bootRecorder.record(2, "expo import FAILED", false, `${e.name}: ${e.message}`);
}

// Step 3 — expo-splash-screen (needed to release the native splash so the
// diagnostic UI can be seen).
let SplashScreen:
  | { hideAsync: () => Promise<void>; preventAutoHideAsync?: () => Promise<void> }
  | undefined;
try {
  SplashScreen = require("expo-splash-screen");
  bootRecorder.record(3, "expo-splash-screen resolved", true);
} catch (err) {
  const e = err instanceof Error ? err : new Error(String(err));
  bootRecorder.record(3, "expo-splash-screen import FAILED", false, `${e.name}: ${e.message}`);
}

// Step 4 — release the native splash IMMEDIATELY. This is the crucial
// diagnostic step: if this resolves, JS is alive AND expo-splash-screen's
// native module is wired correctly. If the device still shows the launch
// storyboard after this fires, the failure is native-side (Info.plist,
// entitlements, LaunchScreen re-shown, etc.).
if (SplashScreen && typeof SplashScreen.hideAsync === "function") {
  SplashScreen.hideAsync()
    .then(() => {
      bootRecorder.record(4, "SplashScreen.hideAsync (index.ts side) resolved", true);
    })
    .catch((err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err));
      bootRecorder.record(4, "SplashScreen.hideAsync FAILED", false, `${e.name}: ${e.message}`);
    });
} else {
  bootRecorder.record(4, "SplashScreen.hideAsync unavailable (module not loaded)", false);
}

// Step 5 — load the diagnostic root component. This file has minimal imports
// (React, RN primitives, BootRecorder) so it should not itself fail.
let BootDiagnosticApp: React.ComponentType<Record<string, unknown>> | undefined;
try {
  BootDiagnosticApp = require("./src/BootDiagnosticApp").BootDiagnosticApp;
  bootRecorder.record(5, "./src/BootDiagnosticApp module resolved", true);
} catch (err) {
  const e = err instanceof Error ? err : new Error(String(err));
  bootRecorder.record(5, "./src/BootDiagnosticApp FAILED", false, `${e.name}: ${e.message}`);
}

// Step 6 — hand our diagnostic root to Expo. The real App is loaded lazily
// inside BootDiagnosticApp via require("./App") at render time so that any
// module-eval failure in App.tsx or its transitive imports is caught and
// displayed on-device rather than aborting boot.
if (registerRootComponent && BootDiagnosticApp) {
  try {
    registerRootComponent(BootDiagnosticApp);
    bootRecorder.record(6, "registerRootComponent(BootDiagnosticApp) returned", true);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    bootRecorder.record(6, "registerRootComponent FAILED", false, `${e.name}: ${e.message}`);
    throw err;
  }
} else {
  bootRecorder.record(
    6,
    "Cannot register root — missing registerRootComponent or BootDiagnosticApp",
    false,
  );
}
