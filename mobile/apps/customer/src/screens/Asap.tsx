/**
 * AsapScreen — first-class native tab mirroring web /customer/asap.
 * ASAP Transport + ASAP Recovery entry points. Routes into CreateJob
 * with serviceTiming='asap' and the chosen serviceType.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { MenuRow } from "../ui";

export function AsapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.root} testID="asap-hub-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>ASAP dispatch</Text>
        <Text style={styles.subtitle}>The nearest available driver, right now.</Text>
        <View style={styles.card}>
          <MenuRow label="ASAP Transport" onPress={() => navigation.navigate("CreateJob", { serviceTiming: "asap", serviceType: "transport" })} testID="asap-transport" />
          <MenuRow label="ASAP Recovery" onPress={() => navigation.navigate("CreateJob", { serviceTiming: "asap", serviceType: "recovery" })} testID="asap-recovery" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
});
