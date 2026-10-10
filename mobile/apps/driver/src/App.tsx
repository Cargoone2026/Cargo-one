/**
 * CargoOne Driver — App root.
 *
 * Navigation shell matches Customer mobile exactly: a single native
 * stack whose authenticated routes are wrapped in an `AppShell` that
 * renders the dark CargoOne sidebar as either a docked rail (wide
 * screens) or a slide-in drawer (phones). No bottom tab bar.
 *
 * The boot chain stays minimal (no splash JS, no mapbox, no diagnostic
 * overlays). Push is loaded lazily only after login (LazyPushBridge).
 */
import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./AuthContext";
import { AppShell } from "./components/AppShell";
import { DriverLoadingScreen } from "./components/DriverLoadingScreen";
import { DriverBiometricGate } from "./components/DriverBiometricGate";
import LoginScreen from "./screens/Login";
import HomeScreen from "./screens/Home";
import AvailableJobsScreen from "./screens/AvailableJobs";
import JobDetailScreen from "./screens/JobDetail";
import LiveModeScreen from "./screens/LiveMode";
import MyJobsScreen from "./screens/MyJobs";
import EarningsScreen from "./screens/Earnings";
import FleetScreen from "./screens/Fleet";
import VehicleEditScreen from "./screens/VehicleEdit";
import ProfileScreen from "./screens/Profile";
import EditProfileScreen from "./screens/EditProfile";
import ChangePasswordScreen from "./screens/ChangePassword";
import SettingsScreen from "./screens/Settings";
import NotificationsScreen from "./screens/Notifications";
import DocumentsScreen from "./screens/Documents";
import LegalScreen from "./screens/Legal";
import BookingDetailScreen from "./screens/BookingDetail";

export type RootStackParamList = {
  Home: undefined;
  AvailableJobs: undefined;
  JobDetail: { jobId: string };
  LiveMode: undefined;
  MyJobs: undefined;
  BookingDetail: { bookingId: string; initialTab?: "messages" | "pod" };
  Earnings: undefined;
  Fleet: undefined;
  VehicleEdit: { vehicleId?: string };
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Settings: undefined;
  Notifications: undefined;
  Documents: undefined;
  Legal: { slug: "terms" | "privacy" | "cookies" };
  Login: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Lazy require keeps expo-notifications out of the boot chain until after login.
function LazyPushBridge() {
  const { PushBridge } = require("./PushBridge") as typeof import("./PushBridge");
  return <PushBridge navigationRef={navigationRef} />;
}

function AuthenticatedStack() {
  return (
    <AppShell>
      <LazyPushBridge />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AvailableJobs" component={AvailableJobsScreen} />
        <Stack.Screen name="JobDetail" component={JobDetailScreen} />
        <Stack.Screen name="LiveMode" component={LiveModeScreen} />
        <Stack.Screen name="MyJobs" component={MyJobsScreen} />
        <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
        <Stack.Screen name="Earnings" component={EarningsScreen} />
        <Stack.Screen name="Fleet" component={FleetScreen} />
        <Stack.Screen name="VehicleEdit" component={VehicleEditScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
      </Stack.Navigator>
    </AppShell>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    // Driver-branded cube loader. Matches the native iOS LaunchScreen
    // backgroundColor (#0A0A0A) so the handoff from the static splash
    // storyboard → JS loader has zero visual flash. We intentionally
    // do NOT re-enable `expo-splash-screen` (it is still in the
    // autolinking exclude list) — the iOS static LaunchScreen already
    // provides the native splash, and keeping the module out
    // eliminates the ERR_SPLASH_SCREEN_CANNOT_HIDE class of error.
    return <DriverLoadingScreen />;
  }
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }
  // Face ID / passkey gate wraps the authenticated stack only.
  // Fresh (!user) users never see it. Fires once per cold start.
  return (
    <DriverBiometricGate>
      <AuthenticatedStack />
    </DriverBiometricGate>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
