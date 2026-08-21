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
import { MoreScreen } from "./screens/More";
import { LegalScreen } from "./screens/Legal";import { AboutScreen } from "./screens/About";
import { SupportScreen } from "./screens/Support";
import { DeleteAccountScreen } from "./screens/DeleteAccount";
import { BookingConfirmedScreen } from "./screens/BookingConfirmed";
import { JobDetailScreen } from "./screens/JobDetail";
import { DispatchScreen } from "./screens/Dispatch";
import { DriverProfileScreen } from "./screens/DriverProfile";
import { AuthContext, useAuthValue } from "./AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { AppShell } from "./components/AppShell";

// Hold the native splash until we've finished the auth-hydration pass.
// Any failure here is non-fatal — the JS LoadingScreen will still show
// once React mounts, so the user never sees a blank window.
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
 * TabsRoot has been removed — the customer app no longer uses a
 * bottom tab bar. Every primary destination (Home / Post Job / ASAP
 * / Bookings / Messages / Profile) is now a plain Stack route
 * wrapped by <AppShell>, which mirrors the web SideRail as either a
 * docked sidebar (iPad width >= 900) or a slide-in drawer (iPhone /
 * smaller iPad orientations). See components/AppShell.tsx.
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
                    <Stack.Screen name="Home" component={withShell(HomeScreen)} />
                    <Stack.Screen name="PostJob" component={withShell(PostJobScreen)} />
                    <Stack.Screen name="Asap" component={withShell(AsapScreen)} />
                    <Stack.Screen name="Bookings" component={withShell(BookingsScreen)} />
                    <Stack.Screen name="Messages" component={withShell(MessagesScreen)} />
                    <Stack.Screen name="Profile" component={withShell(ProfileScreen)} />
                    <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ headerShown: true, title: "Booking" }} />
                    <Stack.Screen name="CreateJob" component={CreateJobScreen} options={{ headerShown: true, title: "New booking" }} />
                    <Stack.Screen name="Bids" component={BidsScreen} options={{ headerShown: true, title: "Bids" }} />
                    <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: true, title: "Payment" }} />
                    <Stack.Screen name="Review" component={ReviewScreen} options={{ headerShown: true, title: "Leave a review" }} />
                    <Stack.Screen name="Passkeys" component={PasskeysScreen} options={{ headerShown: true, title: "Passkeys" }} />
                    <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Settings" }} />
                    <Stack.Screen name="Legal" component={LegalScreen} options={{ headerShown: true, title: "Legal" }} />
                    <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: true, title: "About" }} />
                    <Stack.Screen name="Support" component={SupportScreen} options={{ headerShown: true, title: "Help & Support" }} />
                    <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ headerShown: true, title: "Delete account" }} />
                    <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} options={{ headerShown: true, title: "Booked" }} />
                    <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ headerShown: true, title: "Job" }} />
                    <Stack.Screen name="Dispatch" component={DispatchScreen} options={{ headerShown: true, title: "Live" }} />
                    <Stack.Screen name="DriverProfile" component={DriverProfileScreen} options={{ headerShown: true, title: "Driver" }} />
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
