// -----------------------------------------------------------------------------
// CargoOne Driver — JS entry point.
//
// Layer bisect toggle (R71.16.8):
//   MINIMAL_BOOT = true   → registers <MinimalApp>. No providers, no auth,
//                           no navigation, no notifications, no Mapbox.
//                           Renders a plain dark <View> with a Driver-branded
//                           badge. Use this to prove JS is executing on the
//                           physical device.
//   MINIMAL_BOOT = false  → registers the real <App>. Full Driver bootstrap
//                           (SafeAreaProvider → AuthContext → NavigationContainer).
//
// Flip the constant below and rebuild. Do not add other diagnostic layers
// here — this file must stay tiny so a top-level throw is impossible.
// -----------------------------------------------------------------------------
import "react-native-gesture-handler";
import { registerRootComponent } from "expo";

const MINIMAL_BOOT = false;

if (MINIMAL_BOOT) {
  const { MinimalApp } = require("./src/MinimalApp") as typeof import("./src/MinimalApp");
  registerRootComponent(MinimalApp);
} else {
  const { App } = require("./src/App") as typeof import("./src/App");
  registerRootComponent(App);
}
