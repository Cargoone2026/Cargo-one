/**
 * CargoOne Driver — App root.
 *
 * Technical bootstrap MIRRORS the Customer app (which is a golden
 * checkpoint that boots cleanly on physical devices):
 *   - `initPushForegroundHandler()` and `SplashScreen.preventAutoHideAsync()`
 *     run at MODULE SCOPE so they take effect before the first render.
 *   - Single unbroken provider tree: SafeAreaProvider → AuthContext.Provider
 *     → StatusBar + (LoadingScreen | NavigationContainer). Providers never
 *     remount when hydration flips; the leaf swaps.
 *   - Native launch splash is dismissed inside a bootstrap `useEffect`
 *     on the App component; our branded <LoadingScreen /> covers any
 *     hydration wait.
 *
 * IDENTITY IS 100% DRIVER:
 *   - CargoOne Driver bundle id (`co.uk.cargoone.driver`), Driver icon,
 *     Driver splash background (`#111111`), Driver LoginScreen,
 *     DriverAPI, driver role gating (`user.role === "driver"`), driver
 *     approval gate (AwaitingApproval), driver navigator, driver push
 *     payload contract (`ActiveBooking` / `JobDetail` / `Home`).
 *   - No StripeProvider (driver app doesn't take payments).
 */
import React, { useCallback, useEffect, useRef } from "react";
import { Text, View } from "react-native"; // DIAG
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
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
import { LoadingScreen } from "./components/LoadingScreen";
import {
  initPushForegroundHandler,
  registerForPushNotifications,
  unregisterCurrentToken,
  usePushNavigation,
  type PushDataPayload,
} from "./pushNotifications";

// Foreground push handler must be configured before the first
// `Notifications.addNotificationReceivedListener` fires. Customer app
// does exactly the same at module scope.
initPushForegroundHandler();

// Hold the native launch splash until the React tree has mounted and
// hydration completes. iOS enforces a ~10-second fuse on this call so
// it can never strand the splash on-screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

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

/**
 * PushBridge — register the device token on login, unregister on
 * logout, and route notification taps into the Driver navigator.
 * Same shape as Customer's PushBridge.
 */
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
 * Wrap each primary destination inside <AppShell> so the CargoOne
 * responsive sidebar is present. Detail screens render without the
 * sidebar for focused workflows — same pattern as Customer.
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

export function App() {
  const authValue = useAuthValue();
  const { user, hydrated } = authValue;

  useEffect(() => {
    // Dismiss the native launch splash as soon as React commits.
    // <LoadingScreen /> below covers any remaining hydration wait,
    // so keeping the native splash alive here would just risk it
    // lingering forever if hydration ever hangs.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Backend stores approval status on `user.status`. Only `active`
  // drivers get the full app; every other status routes to
  // AwaitingApproval. Legacy `approval_state === "approved"` and
  // `verified_driver` are kept as fallbacks for pre-migration users.
  const status = (user as any)?.status as string | undefined;
  const approved =
    status === "active" ||
    (user as any)?.approval_state === "approved" ||
    (user as any)?.verified_driver === true;

  console.log("[DRIVER] render", { hydrated, user: !!user }); // DIAG

  return (
    <>
      <AppErrorBoundary>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <AuthContext.Provider value={authValue}>
            <StatusBar style={hydrated ? "dark" : "light"} />
            {!hydrated ? (
              <LoadingScreen />
            ) : (
              <NavigationContainer ref={navigationRef}>
                <Stack.Navigator
                  screenOptions={{ headerShown: false, animation: "slide_from_right" }}
                >
                  {!user ? (
                    <>
                      <Stack.Screen name="Login" component={LoginScreen} />
                      <Stack.Screen name="Register" component={RegisterScreen} />
                      <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
                    </>
                  ) : !approved ? (
                    <Stack.Screen
                      name="AwaitingApproval"
                      component={AwaitingApprovalScreen}
                    />
                  ) : (
                    <>
                      {/* Primary destinations — hosted inside the driver sidebar shell. */}
                      <Stack.Screen name="Home" component={withShell(HomeScreen)} />
                      <Stack.Screen
                        name="AvailableJobs"
                        component={withShell(AvailableJobsScreen)}
                      />
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
            )}
          </AuthContext.Provider>
        </SafeAreaProvider>
      </AppErrorBoundary>
      {/* DIAG */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          backgroundColor: "red",
          padding: 8,
          zIndex: 9999,
        }}
      >
        <Text style={{ color: "white" }}>{`hydrated=${hydrated} user=${!!user}`}</Text>
      </View>
    </>
  );
}
