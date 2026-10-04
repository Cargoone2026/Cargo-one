/**
 * LiveBottomSheet — lightweight bottom-sheet surface for Driver Live
 * Mode. Mirrors the visual rhythm of the web `AsapBottomSheet` without
 * pulling in a new native dep: it is a plain absolutely-positioned
 * View on top of the Mapbox canvas with three snap modes (peek, half,
 * full) controlled by the parent.
 *
 * The sheet does NOT drive its own gesture — the parent toggles snap
 * via the FAB stack / offer tap, exactly like the Driver web
 * Live.jsx does. This keeps the first version shippable with zero new
 * animation libraries.
 */
import React, { useMemo, useRef } from "react";
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon, colors, radius, space, typography } from "../ui";

export type SheetSnap = "peek" | "half" | "full";

export function LiveBottomSheet({
  snap,
  onSnapChange,
  headerLeft,
  headerRight,
  children,
  testID = "driver-live-sheet",
}: {
  snap: SheetSnap;
  onSnapChange: (next: SheetSnap) => void;
  headerLeft: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
}) {
  // Heights expressed as a fraction of the viewport. The parent screen
  // uses `calc(100% - 72px)` so these ratios match the web Live.jsx
  // snaps closely enough on phones.
  const heightPct = snap === "full" ? 0.86 : snap === "half" ? 0.46 : 0.16;

  const cycle = () => {
    const next: SheetSnap =
      snap === "peek" ? "half" : snap === "half" ? "full" : "peek";
    onSnapChange(next);
  };

  // --- Phase 9 drag gesture ---------------------------------------
  // Vertical pan on the handle region cycles snap levels. Upward drag
  // raises the sheet (peek→half→full); downward drag lowers it
  // (full→half→peek). Horizontal gestures are ignored so the Mapbox
  // canvas keeps its own pan/zoom handling. 24 px threshold prevents
  // accidental changes while scrolling list content.
  const snapRef = useRef<SheetSnap>(snap);
  snapRef.current = snap;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_e, g) => {
          const THRESH = 24;
          const current = snapRef.current;
          let next: SheetSnap = current;
          if (g.dy < -THRESH) {
            next = current === "peek" ? "half" : "full";
          } else if (g.dy > THRESH) {
            next = current === "full" ? "half" : "peek";
          } else {
            // Tap (no significant drag) — cycle like before.
            next =
              current === "peek"
                ? "half"
                : current === "half"
                  ? "full"
                  : "peek";
          }
          if (next !== current) onSnapChange(next);
        },
      }),
    [onSnapChange],
  );

  return (
    <View
      pointerEvents="box-none"
      style={styles.outer}
    >
      <View
        style={[styles.sheet, { height: `${heightPct * 100}%` }]}
        testID={testID}
      >
        <View
          {...panResponder.panHandlers}
          style={styles.handleHit}
          testID={`${testID}-handle`}
        >
          <View style={styles.handle} />
        </View>

        <View style={styles.headerRow}>
          <Pressable
            onPress={cycle}
            hitSlop={6}
            style={{ flex: 1, minWidth: 0 }}
            testID={`${testID}-header`}
          >
            {headerLeft}
          </Pressable>
          {headerRight ? (
            <View style={styles.headerRight}>{headerRight}</View>
          ) : null}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

/** Compact "chevron up / list / x" chip used by the parent FAB stack. */
export function SheetChevron({
  snap,
  onPress,
  testID,
}: {
  snap: SheetSnap;
  onPress: () => void;
  testID?: string;
}) {
  const glyph = snap === "full" ? "chevron-down" : "list";
  return (
    <Pressable
      onPress={onPress}
      style={styles.chevronBtn}
      testID={testID || "sheet-chevron"}
    >
      <Icon name={glyph as any} size={18} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[4],
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handleHit: { alignItems: "center", paddingVertical: 14 },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: space[2],
  },
  headerRight: { marginLeft: 8 },
  body: { paddingBottom: space[6] },
  chevronBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});

/** Keep `typography` export used in case parent wants shared text. */
export { typography };
