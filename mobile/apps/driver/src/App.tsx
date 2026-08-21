import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

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

export function App() {
  const authValue = useAuthValue();
  const { user, hydrated } = authValue;
  if (!hydrated) return null;
  const approved = (user as any)?.approval_state === "approved" || (user as any)?.verified_driver;

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={authValue}>
        <NavigationContainer>
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
        </NavigationContainer>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
