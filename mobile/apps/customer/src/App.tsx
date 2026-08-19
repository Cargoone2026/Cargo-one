import React, { useCallback, useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SharedAPI, User, saveToken } from "@cargoone/core";

import { LoginScreen } from "./screens/Login";
import { RegisterScreen } from "./screens/Register";
import { PasswordResetScreen } from "./screens/PasswordReset";
import { HomeScreen } from "./screens/Home";
import { BookingsScreen } from "./screens/Bookings";
import { BookingDetailScreen } from "./screens/BookingDetail";
import { CreateJobScreen } from "./screens/CreateJob";
import { BidsScreen } from "./screens/Bids";
import { PaymentScreen } from "./screens/Payment";
import { ReviewScreen } from "./screens/Review";
import { SettingsScreen } from "./screens/Settings";
import { PasskeysScreen } from "./screens/Passkeys";
import { AuthContext, useAuthValue } from "./AuthContext";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PasswordReset: undefined;
  Tabs: undefined;
  BookingDetail: { bookingId: string };
  CreateJob: { serviceTiming: "asap" | "scheduled"; serviceType: "transport" | "recovery" | "big" };
  Bids: { jobId: string };
  Payment: { bookingId: string };
  Review: { bookingId: string; driverId?: string };
  Passkeys: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

function TabsRoot() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: "#D62828" }}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Bookings" component={BookingsScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export function App() {
  const authValue = useAuthValue();
  const { user, hydrated } = authValue;
  if (!hydrated) return null; // splash / null screen
  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PK || ""}>
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
              ) : (
                <>
                  <Stack.Screen name="Tabs" component={TabsRoot} />
                  <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ headerShown: true, title: "Booking" }} />
                  <Stack.Screen name="CreateJob" component={CreateJobScreen} options={{ headerShown: true, title: "New booking" }} />
                  <Stack.Screen name="Bids" component={BidsScreen} options={{ headerShown: true, title: "Bids" }} />
                  <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: true, title: "Payment" }} />
                  <Stack.Screen name="Review" component={ReviewScreen} options={{ headerShown: true, title: "Leave a review" }} />
                  <Stack.Screen name="Passkeys" component={PasskeysScreen} options={{ headerShown: true, title: "Passkeys" }} />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </AuthContext.Provider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
