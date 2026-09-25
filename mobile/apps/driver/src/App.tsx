import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { DriverAPI } from "@cargoone/core";

import { LoginScreen } from "./screens/Login";
import { RegisterScreen } from "./screens/Register";
import { PasswordResetScreen } from "./screens/PasswordReset";
import { AwaitingApprovalScreen } from "./screens/AwaitingApproval";
import { HomeScreen } from "./screens/Home";
import { AvailableJobsScreen } from "./screens/AvailableJobs";
import { JobDetailScreen } from "./screens/JobDetail";
import { LiveModeScreen } from "./screens/LiveMode";
import { ActiveBookingScreen } from "./screens/ActiveBooking";
import { EarningsScreen } from "./screens/Earnings";
import { SettingsScreen } from "./screens/Settings";
import { PasskeysScreen } from "./screens/Passkeys";
import { MyJobsScreen } from "./screens/MyJobs";
import { FleetScreen } from "./screens/Fleet";
import { ProfileScreen } from "./screens/Profile";
import { NotificationsScreen } from "./screens/Notifications";
import { DocumentsScreen } from "./screens/Documents";
import { AuthContext, useAuthValue } from "./AuthContext";
import { AppShell } from "./components/AppShell";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import {
  initPushForegroundHandler,
  registerForPushNotifications,
  unregisterCurrentToken,
  usePushNavigation,
  type PushDataPayload,
} from "./pushNotifications";

// Historically the two calls below (`initPushForegroundHandler()` and
// `SplashScreen.preventAutoHideAsync()`) executed at MODULE SCOPE — i.e.
// while App.tsx itself was being evaluated by the JS runtime. That's
// unsafe for the initial startup path on a physical device: if either
// side-effect throws synchronously (a native module not yet ready, an
// upstream shape change, a misconfigured entitlement, etc.), the App
// module fails to define and `registerRootComponent(App)` in index.ts
// is never reached. There is no React tree, no error boundary, no
// red-box — just the RN root view's white background — which matches
// exactly the "blank white after native splash" symptom seen on
// iPhone 14 device builds. Both calls are now performed inside a
// bootstrap `useEffect` on the App component itself, so any failure
// gets caught by <AppErrorBoundary> instead of nuking the tree, and
// the initial <View> render still commits regardless.

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PasswordReset: undefined;
  AwaitingApproval: undefined;
  Home: undefined;
  AvailableJobs: undefined;
  LiveMode: undefined;
  MyJobs: undefined;
  Earnings: undefined;
  Fleet: undefined;
  Profile: undefined;
  Settings: undefined;
  JobDetail: { jobId: string };
  ActiveBooking: { bookingId: string };
  Passkeys: undefined;
  Notifications: undefined;
  Documents: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** PushBridge — same shape as customer app: register on login, unregister
 *  on logout, route notification taps into the navigator. */
function PushBridge() {
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    registerForPushNotifications(DriverAPI.registerPushToken).then((tok) => {
      if (!cancelled) tokenRef.current = tok;
    });
    return () => {
      cancelled = true;
      unregisterCurrentToken(DriverAPI.unregisterPushToken, tokenRef.current);
      tokenRef.current = null;
    };
  }, []);
  const navigate = useCallback((data: PushDataPayload) => {
    if (!navigationRef.isReady()) {
      setTimeout(() => navigate(data), 300);
      return;
    }
    const nav = navigationRef as unknown as { navigate: (name: string, params?: any) => void };
    if (typeof data.booking_id === "string" && data.booking_id) {
      nav.navigate("ActiveBooking", { bookingId: data.booking_id });
    } else if (typeof data.job_id === "string" && data.job_id) {
      nav.navigate("JobDetail", { jobId: data.job_id });
    } else {
      nav.navigate("Home");
    }
  }, []);
  usePushNavigation(navigate);
  return null;
}

/**
 * Wrap each primary destination inside <AppShell> so the Cargo One
 * responsive sidebar is present. Detail screens (JobDetail /
 * ActiveBooking / Passkeys) render without the sidebar for focused
 * workflows — same pattern as the customer app.
 */
function withShell<C extends React.ComponentType<any>>(Component: C) {
  const Wrapped: React.FC<any> = (props) => (
    <AppShell>
      <Component {...props} />
    </AppShell>
  );
  Wrapped.displayName = `WithShell(${(Component as any).displayName || (Component as any).name || "Screen"})`;
  return Wrapped;
}

// Hold the native launch splash until the React tree mounts, then
// hide it immediately regardless of hydration. If hydration ever
// hangs, the fallback loader below still renders — the native splash
// never gets stranded on screen.
//
// Both `preventAutoHideAsync` and `initPushForegroundHandler` are now
// invoked from a bootstrap useEffect (see block above the App return),
// not at module scope, so a failure in either cannot prevent the
// initial React tree from rendering. Native iOS enforces its own
// ~10-second auto-hide fuse on `preventAutoHideAsync`, so skipping
// the call is a harmless degradation — the launch image simply hides
// on its own.

export function App() {
  const authValue = useAuthValue();
  const { user, hydrated } = authValue;

  useEffect(() => {
    // Bootstrap: run every side-effect that used to live at module
    // scope AFTER React has committed at least the initial render, and
    // silence any failure — the error boundary catches render errors,
    // but these two calls are safe to no-op if the underlying native
    // module isn't ready (Expo enforces its own splash-hide timeout on
    // iOS, and the push handler is only consulted when a notification
    // fires — never during first paint).
    try {
      initPushForegroundHandler();
    } catch {
      /* silent — best-effort, boundary catches render errors */
    }
    SplashScreen.preventAutoHideAsync().catch(() => {});
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!hydrated) {
    // Full-bleed dark surface while auth hydrates (matches native
    // splash `backgroundColor: #111111` so the transition is
    // invisible). Wrapped in the boundary for uniform safety even
    // though this branch renders a bare <View>.
    return (
      <AppErrorBoundary>
        <View
          style={{ flex: 1, backgroundColor: "#111111" }}
          testID="driver-loading-screen"
        />
      </AppErrorBoundary>
    );
  }
  // R71.16.3 (Driver P0-b) — Backend stores approval status on
  // `user.status`. Match the web Driver Dashboard's gate: only
  // `status === "active"` drivers get the full app; every other
  // status (`pending`, `changes_requested`, `suspended`) routes to
  // the AwaitingApproval screen where the correct message + resubmit
  // action are rendered. Legacy `approval_state === "approved"` and
  // `verified_driver` are kept as fallbacks for pre-migration users.
  const status = (user as any)?.status as string | undefined;
  const approved =
    status === "active" ||
    (user as any)?.approval_state === "approved" ||
    (user as any)?.verified_driver === true;

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AuthContext.Provider value={authValue}>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="dark" />
            <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
              {!user ? (
                <>
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="Register" component={RegisterScreen} />
                  <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
                </>
              ) : !approved ? (
                <Stack.Screen name="AwaitingApproval" component={AwaitingApprovalScreen} />
              ) : (
                <>
                  {/* Primary destinations — hosted inside the driver sidebar shell. */}
                  <Stack.Screen name="Home" component={withShell(HomeScreen)} />
                  <Stack.Screen name="AvailableJobs" component={withShell(AvailableJobsScreen)} />
                  <Stack.Screen name="LiveMode" component={withShell(LiveModeScreen)} />
                  <Stack.Screen name="MyJobs" component={withShell(MyJobsScreen)} />
                  <Stack.Screen name="Earnings" component={withShell(EarningsScreen)} />
                  <Stack.Screen name="Fleet" component={withShell(FleetScreen)} />
                  <Stack.Screen name="Profile" component={withShell(ProfileScreen)} />
                  <Stack.Screen name="Settings" component={withShell(SettingsScreen)} />

                  {/* Focused workflows */}
                  <Stack.Screen name="JobDetail" component={JobDetailScreen} />
                  <Stack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
                  <Stack.Screen name="Passkeys" component={PasskeysScreen} />
                  <Stack.Screen name="Notifications" component={NotificationsScreen} />
                  <Stack.Screen name="Documents" component={DocumentsScreen} />
                </>
              )}
            </Stack.Navigator>
            {user ? <PushBridge /> : null}
          </NavigationContainer>
        </AuthContext.Provider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
