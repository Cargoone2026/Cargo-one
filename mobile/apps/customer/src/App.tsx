/**
 * DIAGNOSTIC (TEMPORARY) — minimum-boot Customer app.
 *
 * The device log shows AppRegistry.runApplication(), HMRClient.setup()
 * and RCTDeviceEventEmitter.emit() all firing against a JS runtime that
 * has registered zero callable modules — i.e. the JS bundle is not
 * completing its earliest bootstrap. That is incompatible with a module
 * executing cleanly through to `registerRootComponent(App)`.
 *
 * The most likely trigger is one of the many module-scope side effects
 * reached by importing the real App.tsx: initPushForegroundHandler(),
 * SplashScreen.preventAutoHideAsync(), and the transitive
 * Mapbox.setAccessToken() calls that fire the moment screens like
 * Dispatch.tsx and RouteMap.tsx are imported. If any of these throws
 * during Hermes evaluation, `registerRootComponent(App)` never runs,
 * AppRegistry gets no registered component, and native's call to
 * `runApplication` lands on a runtime with zero callable modules.
 *
 * This file strips App.tsx to the smallest tree that still mounts the
 * EXISTING LoginScreen so we can observe whether the base RN handoff
 * can render ANY content.
 *
 * Removed for this diagnostic:
 *   - expo-splash-screen JS (preventAutoHideAsync, hideAsync)
 *   - BiometricGate wrapper
 *   - PushBridge + initPushForegroundHandler + CustomerAPI
 *   - StripeProvider
 *   - LoadingScreen
 *   - AppShell wrapper
 *   - All screen imports except LoginScreen (RegisterScreen,
 *     HomeScreen, Dispatch, BookingDetail, …) so their module-scope
 *     side effects (Mapbox.setAccessToken etc.) are not executed.
 *   - useAuthValue() → avoids SharedAPI.me() API call + 6s fuse.
 *
 * Kept (unmodified):
 *   - index.ts entry (unchanged — still `registerRootComponent(App)`)
 *   - LoginScreen (imported from "./screens/Login", not modified)
 *   - AuthContext (imported but driven with a static stub value; its
 *     own file is not touched)
 *   - NavigationContainer + Stack.Navigator (LoginScreen is a Screen
 *     component so it needs the navigator wrapper)
 *   - SafeAreaProvider + StatusBar
 *
 * No native, Podfile, app.json, package.json, or dependency changes.
 * Not committed; not pushed; not rebuilt. Revert this file to restore
 * the full Customer app.
 */
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthContext, type AuthState } from "./AuthContext";
import { LoginScreen } from "./screens/Login";

// RootStackParamList: kept complete (type-only) so that the other
// Customer screens — which are NOT imported by this diagnostic App but
// are still type-checked by tsc — continue to resolve their
// NativeStackScreenProps<RootStackParamList, ...> references. None of
// these routes are mounted in the Navigator below; only Login is.
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PasswordReset: undefined;
  Home: undefined;
  PostJob: { rebookFromJob?: any } | undefined;
  Asap: { rebookFromJob?: any } | undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  BookingDetail: { bookingId: string };
  CreateJob: { serviceTiming: "asap" | "scheduled"; serviceType: "transport" | "recovery" | "big" };
  Bids: { jobId: string };
  Payment: { bookingId: string };
  Review: { bookingId: string; driverId?: string };
  Passkeys: undefined;
  Settings: undefined;
  Legal: { slug: "terms" | "privacy" | "cookies" };
  About: undefined;
  Support: undefined;
  DeleteAccount: undefined;
  BookingConfirmed: { bookingId: string };
  JobDetail: { jobId: string };
  Dispatch: { jobId: string };
  DriverProfile: { driverId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// DIAGNOSTIC-only stub so LoginScreen's `useAuth()` hook resolves
// without running the real AuthContext hydration (which would call
// SharedAPI.me and arm the 6s fuse). All auth methods throw/no-op —
// this is NOT a working auth state; submitting Login will not work.
// That is intentional for this diagnostic; we only care whether the
// Login UI mounts and paints.
const DIAGNOSTIC_AUTH: AuthState = {
  user: null,
  loading: false,
  hydrated: true,
  login: async () => {
    throw new Error("DIAGNOSTIC: auth disabled");
  },
  register: async () => {
    throw new Error("DIAGNOSTIC: auth disabled");
  },
  logout: async () => {},
  refresh: async () => {},
};

export function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthContext.Provider value={DIAGNOSTIC_AUTH}>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{ headerShown: false, animation: "slide_from_right" }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
