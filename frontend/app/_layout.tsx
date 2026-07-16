import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Public marketing routes accessible without authentication (web + native)
const PUBLIC_SEGMENTS = new Set([
  "(marketing)",
  "how-it-works",
  "services",
  "business",
  "drivers",
  "trust-safety",
  "faq",
  "contact",
  "about",
]);

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    const inAuth = first === "(auth)";
    const inMarketing = first === "(marketing)" || PUBLIC_SEGMENTS.has(first || "");
    const inCustomer = first === "(customer)";
    const inDriver = first === "(driver)";
    const inAdmin = first === "(admin)";
    const inSettings = first === "settings"; // legal/privacy pages accessible during marketing
    const inDriverProfile = first === "driver-profile";

    if (!user) {
      // On web: default to marketing site. On native: default to auth welcome.
      const publicOK = inAuth || inMarketing || inSettings || inDriverProfile;
      if (publicOK) return;
      if (Platform.OS === "web") router.replace("/(marketing)");
      else router.replace("/(auth)/welcome");
      return;
    }

    // Authed users on marketing pages: allow them to browse; do not force-redirect.
    if (inMarketing || inSettings || inDriverProfile) return;

    // Redirect by role
    if (user.role === "customer" && !inCustomer) router.replace("/(customer)");
    else if (user.role === "driver" && !inDriver) router.replace("/(driver)");
    else if (user.role === "admin" && !inAdmin) router.replace("/(admin)");
  }, [user, loading, segments, router]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Gate />
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(marketing)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(driver)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="driver-profile/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="settings/index" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="settings/[slug]" options={{ animation: "slide_from_right" }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
