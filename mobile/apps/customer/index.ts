console.log("[DIAG] index.ts top — before any imports");
import "react-native-gesture-handler";
console.log("[DIAG] after gesture-handler import");
import { registerRootComponent } from "expo";
import { App } from "./src/App";
console.log("[DIAG] before registerRootComponent");
registerRootComponent(App);
console.log("[DIAG] after registerRootComponent");
