import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
import { MessagesScreen } from "./screens/Messages";
import { ProfileScreen } from "./screens/Profile";
import { PostJobScreen } from "./screens/PostJob";
import { AsapScreen } from "./screens/Asap";
import { LegalScreen } from "./screens/Legal";
import { AboutScreen } from "./screens/About";
import { SupportScreen } from "./screens/Support";
import { DeleteAccountScreen } from "./screens/DeleteAccount";
import { BookingConfirmedScreen } from "./screens/BookingConfirmed";
import { JobDetailScreen } from "./screens/JobDetail";
import { DispatchScreen } from "./screens/Dispatch";
import { DriverProfileScreen } from "./screens/DriverProfile";
import { AuthContext, useAuthValue } from "./AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { AppShell } from "./components/AppShell";
import { BiometricGate } from "./components/BiometricGate";

// Hold the native splash until we've finished the auth-hydration pass.
SplashScreen.preventAutoHideAsync().catch(() => {});

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PasswordReset: undefined;
  Home: undefined;
  PostJob: undefined;
  Asap: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
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
  Dispatch: { bookingId: string };
  DriverProfile: { driverId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * withShell wraps a route inside <AppShell> so the Cargo One
 * responsive sidebar is present on primary destinations. Detail
 * screens (Booking / Job / Dispatch / Payment / etc.) render without
 * the sidebar for a focused workflow, matching the pattern used on
 * the web portal where those pages consume the full content width.
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
    // Dismiss the *native* Expo launch splash immediately after the
    // React tree mounts. Our own <LoadingScreen> covers any remaining
    // hydration wait, so keeping the native splash alive here would
    // just risk it lingering forever if hydration ever hangs.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PK || ""}>
        <AuthContext.Provider value={authValue}>
          <StatusBar style={hydrated ? "dark" : "light"} />
          {!hydrated ? (
            <LoadingScreen />
          ) : (
            <BiometricGate>
              <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
                {!user ? (
                  <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                    <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
                  </>
                ) : (
                  <>
                    {/* Primary destinations — hosted inside the Cargo One sidebar shell. */}
                    <Stack.Screen name="Home" component={withShell(HomeScreen)} />
                    <Stack.Screen name="PostJob" component={withShell(PostJobScreen)} />
                    <Stack.Screen name="Asap" component={withShell(AsapScreen)} />
                    <Stack.Screen name="Bookings" component={withShell(BookingsScreen)} />
                    <Stack.Screen name="Messages" component={withShell(MessagesScreen)} />
                    <Stack.Screen name="Profile" component={withShell(ProfileScreen)} />

                    {/* Focused workflows — full-width without the sidebar. */}
                    <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
                    <Stack.Screen name="CreateJob" component={CreateJobScreen} />
                    <Stack.Screen name="Bids" component={BidsScreen} />
                    <Stack.Screen name="Payment" component={PaymentScreen} />
                    <Stack.Screen name="Review" component={ReviewScreen} />
                    <Stack.Screen name="Passkeys" component={PasskeysScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="Legal" component={LegalScreen} />
                    <Stack.Screen name="About" component={AboutScreen} />
                    <Stack.Screen name="Support" component={SupportScreen} />
                    <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
                    <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
                    <Stack.Screen name="JobDetail" component={JobDetailScreen} />
                    <Stack.Screen name="Dispatch" component={DispatchScreen} />
                    <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
                  </>
                )}
              </Stack.Navigator>
            </NavigationContainer>
            </BiometricGate>
          )}
        </AuthContext.Provider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
