import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors } from "@/src/theme";

export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
