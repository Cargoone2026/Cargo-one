import { Slot } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { CookieBanner } from "@/src/components/marketing/CookieBanner";
import { MarketingFooter } from "@/src/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/src/components/marketing/MarketingHeader";
import { colors } from "@/src/theme";

export default function MarketingLayout() {
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        // Sticky header on web via CSS position: sticky (see MarketingHeader)
        showsVerticalScrollIndicator={false}
      >
        <MarketingHeader />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
        <MarketingFooter />
      </ScrollView>
      <CookieBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
});
