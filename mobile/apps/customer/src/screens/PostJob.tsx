/**
 * PostJobHub — first-class native tab mirroring web /customer/post-job.
 * Presents the three scheduled service types (Transport, Recovery,
 * Big / Bidding) and routes into the existing CreateJob screen with
 * the right params. Matches the web page's role: a chooser, not a
 * form — the form lives in CreateJob.
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { MenuRow } from "../ui";

export function PostJobScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.root} testID="postjob-hub-screen">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Post a scheduled job</Text>
        <Text style={styles.subtitle}>Pick a service — set your own pickup date & time.</Text>
        <View style={styles.card}>
          <MenuRow label="Transport" onPress={() => navigation.navigate("CreateJob", { serviceTiming: "scheduled", serviceType: "transport" })} testID="postjob-transport" />
          <MenuRow label="Recovery" onPress={() => navigation.navigate("CreateJob", { serviceTiming: "scheduled", serviceType: "recovery" })} testID="postjob-recovery" />
          <MenuRow label="Big Job / Bidding" onPress={() => navigation.navigate("CreateJob", { serviceTiming: "scheduled", serviceType: "big" })} testID="postjob-big" />
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
