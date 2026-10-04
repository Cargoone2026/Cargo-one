/**
 * SignaturePad — Phase 11 Driver POD.
 *
 * Mirrors the Driver Web SignaturePad component
 * (frontend/src/pages/portal/driver/BookingDetail.jsx) using
 * react-native-signature-canvas. Emits a base64 PNG via `onChange`
 * matching the backend contract (PODUpload.signature).
 *
 * Rendered inside a Card by the PODPane; keeps its own Clear control
 * (parity with the Web pad's "Clear" affordance).
 */
import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import SignatureCanvas, { type SignatureViewRef } from "react-native-signature-canvas";
import { Icon, colors, radius, space, typography } from "../ui";

type Props = {
  onChange: (base64: string | null) => void;
  testID?: string;
};

export function SignaturePad({ onChange, testID }: Props) {
  const ref = useRef<SignatureViewRef>(null);
  const [hasInk, setHasInk] = useState(false);

  const handleOK = useCallback((signature: string) => {
    // react-native-signature-canvas returns a data URL (e.g.
    // "data:image/png;base64,...") which is exactly what the backend
    // POD upload expects (same shape as Driver Web output).
    onChange(signature || null);
  }, [onChange]);

  const handleEmpty = useCallback(() => {
    onChange(null);
    setHasInk(false);
  }, [onChange]);

  // react-native-signature-canvas needs an explicit `readSignature()`
  // call to emit the base64 result; firing on every stroke-end keeps
  // the parent state in sync without a manual "Save" button.
  const handleEnd = useCallback(() => {
    setHasInk(true);
    ref.current?.readSignature();
  }, []);

  const handleClear = useCallback(() => {
    ref.current?.clearSignature();
    setHasInk(false);
    onChange(null);
  }, [onChange]);

  // Minimal web styling piped into the embedded canvas so it visually
  // matches the Cargo One card system — no inner UI chrome.
  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; margin: 0; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; margin: 0; }
    body, html { background: transparent; }
    canvas { background: transparent; }
  `;

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.canvasBox}>
        <SignatureCanvas
          ref={ref}
          onOK={handleOK}
          onEmpty={handleEmpty}
          onEnd={handleEnd}
          webStyle={webStyle}
          backgroundColor="rgba(0,0,0,0)"
          penColor="#111111"
          minWidth={1.6}
          maxWidth={2.6}
          descriptionText=""
          autoClear={false}
          imageType="image/png"
        />
        {!hasInk ? (
          <View pointerEvents="none" style={styles.placeholderOverlay}>
            <Icon name="edit-3" size={16} color={colors.inkMuted} />
            <Text style={styles.placeholderText}>Sign here</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          style={styles.clearBtn}
          testID={testID ? `${testID}-clear` : undefined}
        >
          <Icon name="rotate-ccw" size={14} color={colors.inkMuted} />
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space[2] },
  canvasBox: {
    height: 180,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    overflow: "hidden",
    position: "relative",
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: space[2],
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bgSecondary,
  },
  clearText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.inkMuted,
  },
});
