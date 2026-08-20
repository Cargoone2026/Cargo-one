import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { StripeProvider } from "@stripe/stripe-react-native";

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
import { LoadingScreen } from "./components/LoadingScreen";

// Hold the native splash until we've finished the auth-hydration pass.
// Any failure here is non-fatal — the JS LoadingScreen will still show
// once React mounts, so the user never sees a blank window.
SplashScreen.preventAutoHideAsync().catch(() => {});

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

  // The moment the auth hydration finishes we dismiss the native splash.
  // React then paints either the LoadingScreen (still fetching), the
  // Login stack (no session), or the Tabs stack (session restored).
  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated]);

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PK || ""}>
        <AuthContext.Provider value={authValue}>
          <StatusBar style={hydrated ? "dark" : "light"} />
          {!hydrated ? (
            // Branded loading screen — remains visible only while we're
            // restoring the session from AsyncStorage + /api/auth/me.
            <LoadingScreen />
          ) : (
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                  // CASE C — no valid session, show Login.
                  <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                    <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
                  </>
                ) : (
                  // CASE B — valid session restored, enter app directly.
                  // (CASE A "biometric on launch" hooks in here later
                  //  via a Settings toggle; the plumbing is ready.)
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
          )}
        </AuthContext.Provider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
