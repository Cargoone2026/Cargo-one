import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { spacing } from "@/src/theme";

import { CONTENT_MAX_WIDTH, useResponsive } from "./breakpoints";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  bg?: string;
  narrow?: boolean;
  paddedY?: boolean;
};

export function Section({ children, style, bg, narrow = false, paddedY = true }: Props) {
  const { isMobile } = useResponsive();
  return (
    <View style={[bg ? { backgroundColor: bg } : null, styles.wrap]}>
      <View
        style={[
          {
            width: "100%",
            maxWidth: narrow ? 820 : CONTENT_MAX_WIDTH,
            marginHorizontal: "auto",
            paddingHorizontal: isMobile ? spacing.lg : spacing.xxl,
            paddingVertical: paddedY ? (isMobile ? spacing.xxl : spacing.xxxl + spacing.md) : 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center" },
});
