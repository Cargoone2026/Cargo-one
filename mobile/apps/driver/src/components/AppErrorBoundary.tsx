/**
 * AppErrorBoundary — top-level render safety net for the Driver app.
 *
 * The previous Driver App.tsx returned a completely bare `<View>` when
 * `hydrated === false`. If ANY part of the post-hydration tree throws
 * synchronously during its first render (a missing native module, a
 * malformed screen import, a peer-dependency shape mismatch, etc.),
 * React silently unmounts the tree and the underlying RN root view
 * background — white on iOS — is what the user sees. There is no
 * red-box for a synchronous render throw in production/release builds,
 * and Xcode's console filter can miss it if the error is emitted on a
 * non-app subsystem. Result: the "gets past the native splash then
 * blank white" symptom you're observing on iPhone.
 *
 * This component is the last line of defence — it renders a *visible*
 * fallback with the actual error message so the same failure surfaces
 * as text on-device instead of a blank screen. The fallback is
 * intentionally self-contained: no NavigationContainer, no
 * SafeAreaProvider, no lucide icons — just React Native primitives so
 * that even if the surrounding tree can't mount, this can.
 *
 * Design notes:
 *   • Dark charcoal background (#111111) matches the native launch
 *     splash and the driver hydration screen, so the transition is
 *     imperceptible when there IS no error.
 *   • Includes a "Try again" button that resets the boundary. This is
 *     safe because the underlying <App> tree is memoised only by React
 *     — resetting `state.error = null` triggers a fresh render pass.
 *   • Never touches AsyncStorage / backend / auth so it works offline
 *     and during cold-start before hydration.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Best-effort console output for Xcode / Metro tail. Never throw
    // from here — a boundary that throws inside componentDidCatch
    // takes the whole app down.
    try {
      // eslint-disable-next-line no-console
      console.error("[Driver App] top-level render error:", error, info.componentStack);
    } catch {
      /* silent */
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: "#111111" }} testID="driver-error-boundary">
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 96, gap: 16 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700" }}>
            Cargo One couldn&apos;t start
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 20 }}>
            The driver app hit an unexpected error while loading. The details below help
            engineering diagnose it — please share them if you email support.
          </Text>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 16,
              gap: 8,
            }}
          >
            <Text style={{ color: "#FCA5A5", fontSize: 13, fontWeight: "600" }}>
              {this.state.error.name}
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 13 }}>
              {this.state.error.message || "(no message)"}
            </Text>
          </View>
          <Pressable
            onPress={this.reset}
            testID="driver-error-boundary-retry"
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              backgroundColor: pressed ? "#B01F1F" : "#D62828",
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 999,
              marginTop: 8,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}
