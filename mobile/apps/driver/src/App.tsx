/**
 * CargoOne Driver — App root.
 *
 * Boot chain remains minimal (no splash JS, no push, no mapbox, no
 * diagnostic overlays). The bottom-tab bar is styled with the shared
 * CargoOne mobile tokens so it matches Customer polish while keeping
 * the Driver-specific 7-item nav order.
 */
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
import { Glyph, colors } from "./ui";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

type GlyphName = React.ComponentProps<typeof Glyph>["name"];

function TabIcon({ name, color }: { name: GlyphName; color: string }) {
  return <Glyph name={name} size={22} color={color} />;
}

function DriverTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 14,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarTestID: "tab-home",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="AvailableJobs"
        component={AvailableJobsScreen}
        options={{
          title: "Available",
          tabBarTestID: "tab-available",
          tabBarIcon: ({ color }) => <TabIcon name="compass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="LiveMode"
        component={LiveModeScreen}
        options={{
          title: "Live",
          tabBarTestID: "tab-live",
          tabBarIcon: ({ color }) => <TabIcon name="zap" color={color} />,
        }}
      />
      <Tabs.Screen
        name="MyJobs"
        component={MyJobsScreen}
        options={{
          title: "My Jobs",
          tabBarTestID: "tab-myjobs",
          tabBarIcon: ({ color }) => <TabIcon name="box" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          title: "Earnings",
          tabBarTestID: "tab-earnings",
          tabBarIcon: ({ color }) => <TabIcon name="coin" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Fleet"
        component={FleetScreen}
        options={{
          title: "Fleet",
          tabBarTestID: "tab-fleet",
          tabBarIcon: ({ color }) => <TabIcon name="truck" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarTestID: "tab-profile",
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
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
