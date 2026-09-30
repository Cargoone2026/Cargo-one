/**
 * CargoOne Driver — App root.
 *
 * Minimal boot chain — matches what the Customer app does and only
 * what Phase 1 requires:
 *   • SafeAreaProvider (must wrap navigation for insets to work)
 *   • AuthProvider (hydrates the bearer token from AsyncStorage)
 *   • NavigationContainer with a native-stack that flips between the
 *     unauthenticated screen (Login) and the authenticated shell
 *     (Home) purely on `user` presence — no imperative navigate().
 *
 * No JS-side splash management. No error-boundary overlay. No push /
 * mapbox / location — those come back in later phases behind the
 * feature that actually needs them.
 */
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginScreen from "./screens/Login";
import HomeScreen from "./screens/Home";
import { colors } from "./theme";

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash} testID="driver-boot-splash">
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Home" component={HomeScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
