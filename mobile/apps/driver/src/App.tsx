import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { LoginScreen } from "./screens/Login";
import { RegisterScreen } from "./screens/Register";
import { PasswordResetScreen } from "./screens/PasswordReset";
import { AwaitingApprovalScreen } from "./screens/AwaitingApproval";
import { AvailableJobsScreen } from "./screens/AvailableJobs";
import { JobDetailScreen } from "./screens/JobDetail";
import { LiveModeScreen } from "./screens/LiveMode";
import { ActiveBookingScreen } from "./screens/ActiveBooking";
import { EarningsScreen } from "./screens/Earnings";
import { SettingsScreen } from "./screens/Settings";
import { PasskeysScreen } from "./screens/Passkeys";
import { AuthContext, useAuthValue } from "./AuthContext";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PasswordReset: undefined;
  AwaitingApproval: undefined;
  Tabs: undefined;
  JobDetail: { jobId: string };
  ActiveBooking: { bookingId: string };
  Passkeys: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

function TabsRoot() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: "#D62828" }}>
      <Tabs.Screen name="Live" component={LiveModeScreen} />
      <Tabs.Screen name="Jobs" component={AvailableJobsScreen} />
      <Tabs.Screen name="Earnings" component={EarningsScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export function App() {
  const authValue = useAuthValue();
  const { user, hydrated } = authValue;
  if (!hydrated) return null;
  const approved = user?.approval_state === "approved" || user?.verified_driver;
  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={authValue}>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
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
                <Stack.Screen name="Tabs" component={TabsRoot} />
                <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ headerShown: true, title: "Job" }} />
                <Stack.Screen name="ActiveBooking" component={ActiveBookingScreen} options={{ headerShown: true, title: "Active job" }} />
                <Stack.Screen name="Passkeys" component={PasskeysScreen} options={{ headerShown: true, title: "Passkeys" }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
