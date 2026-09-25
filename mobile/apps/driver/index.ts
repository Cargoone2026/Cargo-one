// -----------------------------------------------------------------------------
// TEMPORARY DIAGNOSTIC — boot checkpoints (Driver R71.16.4 startup debug).
//
// Every console.log(...) below writes to the React Native bridge, which surfaces
// on-device via Xcode → Devices & Simulators → Open Console. Filter by the tag
// `[Driver:boot]` (or by the RN JS-thread category `RCTLog`) — a plain process
// filter of `CargoOneDriver` also works.
//
// These logs pinpoint the exact hang between:
//   (a) native app launched, JS bundle downloaded, but JS never runs
//   (b) JS started but imports failed to resolve
//   (c) imports resolved but registerRootComponent never returned
//   (d) registerRootComponent returned but React never invoked App()
//   (e) React invoked App() but auth-hydration/useEffect never fired
//   (f) useEffect fired but SplashScreen.hideAsync never resolved
//
// Remove this block once the boot problem is diagnosed.
// -----------------------------------------------------------------------------

// eslint-disable-next-line no-console
console.log("[Driver:boot] step 0 — index.ts is executing (before any import)");

import "react-native-gesture-handler";
// eslint-disable-next-line no-console
console.log("[Driver:boot] step 1 — react-native-gesture-handler resolved");

import { registerRootComponent } from "expo";
// eslint-disable-next-line no-console
console.log("[Driver:boot] step 2 — expo.registerRootComponent resolved");

import * as SplashScreen from "expo-splash-screen";
// eslint-disable-next-line no-console
console.log("[Driver:boot] step 3 — expo-splash-screen resolved");

// Eagerly hide the native splash BEFORE App is even loaded. If JS is running
// at all, this guarantees the launch storyboard is dismissed and any
// subsequent visual state (LoginScreen / AppErrorBoundary fallback / white /
// red-box) becomes visible on the device. This is safe: SplashScreen.hideAsync
// is idempotent, and if a user-defined `preventAutoHideAsync` is called later
// (or the hide fails), Expo simply logs a warning without crashing.
SplashScreen.hideAsync()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("[Driver:boot] step 4 — SplashScreen.hideAsync resolved (native splash released)");
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.log("[Driver:boot] step 4 FAILED — SplashScreen.hideAsync rejected:", String(err));
  });

import { App } from "./src/App";
// eslint-disable-next-line no-console
console.log("[Driver:boot] step 5 — ./src/App module resolved, App component loaded");

try {
  registerRootComponent(App);
  // eslint-disable-next-line no-console
  console.log("[Driver:boot] step 6 — registerRootComponent(App) returned");
} catch (err) {
  // eslint-disable-next-line no-console
  console.log("[Driver:boot] step 6 FAILED — registerRootComponent threw:", String(err));
  throw err;
}
