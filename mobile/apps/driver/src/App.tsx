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
import { AuthContext, useAuthValue } from "./AuthContext";
import { AppShell } from "./components/AppShell";
import {
  initPushForegroundHandler,
  registerForPushNotifications,
  unregisterCurrentToken,
  usePushNavigation,
  type PushDataPayload,
} from "./pushNotifications";

initPushForegroundHandler();

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
SplashScreen.preventAutoHideAsync().catch(() => {});

export function App() {
  const authValue = useAuthValue();
  const { user, hydrated } = authValue;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!hydrated) {
    // Full-bleed dark surface while auth hydrates (matches native
    // splash `backgroundColor: #111111` so the transition is
    // invisible).
    return <View style={{ flex: 1, backgroundColor: "#111111" }} testID="driver-loading-screen" />;
  }
  const approved = (user as any)?.approval_state === "approved" || (user as any)?.verified_driver;

  return (
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
              </>
            )}
          </Stack.Navigator>
          {user ? <PushBridge /> : null}
        </NavigationContainer>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
