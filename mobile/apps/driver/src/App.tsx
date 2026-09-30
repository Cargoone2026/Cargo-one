/**
 * CargoOne Driver — App root.
 *
 * Boot chain (kept minimal — no JS splash management, no push, no
 * mapbox, no diagnostic overlays):
 *   SafeAreaProvider
 *     └── AuthProvider (hydrates bearer token from AsyncStorage)
 *          └── NavigationContainer
 *               └── Root native-stack, gated on user presence:
 *                    • No user  → Login screen
 *                    • Signed-in → DriverTabs (bottom-tab shell mirroring
 *                                  the web DriverLayout nav items)
 */
import React from "react";
import { ActivityIndicator, StyleSheet, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginScreen from "./screens/Login";
import HomeScreen from "./screens/Home";
import AvailableJobsScreen from "./screens/AvailableJobs";
import LiveModeScreen from "./screens/LiveMode";
import MyJobsScreen from "./screens/MyJobs";
import EarningsScreen from "./screens/Earnings";
import FleetScreen from "./screens/Fleet";
import ProfileScreen from "./screens/Profile";
import { colors } from "./theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

/**
 * Tab icon rendered from a single glyph so we can match the web nav
 * without adding an icon-font native module in Phase 2. Icons come
 * back in a later phase once `@expo/vector-icons` (or an equivalent)
 * is required by another feature.
 */
function TabGlyph({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

function DriverTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          height: 70,
          paddingTop: 6,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarTestID: "tab-home",
          tabBarIcon: ({ color }) => <TabGlyph glyph="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="AvailableJobs"
        component={AvailableJobsScreen}
        options={{
          title: "Available",
          tabBarTestID: "tab-available",
          tabBarIcon: ({ color }) => <TabGlyph glyph="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="LiveMode"
        component={LiveModeScreen}
        options={{
          title: "Live",
          tabBarTestID: "tab-live",
          tabBarIcon: ({ color }) => <TabGlyph glyph="⚡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="MyJobs"
        component={MyJobsScreen}
        options={{
          title: "My Jobs",
          tabBarTestID: "tab-myjobs",
          tabBarIcon: ({ color }) => <TabGlyph glyph="▤" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          title: "Earnings",
          tabBarTestID: "tab-earnings",
          tabBarIcon: ({ color }) => <TabGlyph glyph="£" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Fleet"
        component={FleetScreen}
        options={{
          title: "Fleet",
          tabBarTestID: "tab-fleet",
          tabBarIcon: ({ color }) => <TabGlyph glyph="🚚" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarTestID: "tab-profile",
          tabBarIcon: ({ color }) => <TabGlyph glyph="◉" color={color} />,
        }}
      />
    </Tabs.Navigator>
  );
}

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
        <Stack.Screen name="DriverTabs" component={DriverTabs} />
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
