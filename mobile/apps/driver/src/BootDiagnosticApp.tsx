/**
 * BootDiagnosticApp — R71.16.5 temporary on-device diagnostic root.
 *
 * Registered by `index.ts` in place of the real `App` component so that:
 *
 *   1. If JS is executing at all, the user sees THIS screen on the
 *      iPhone (native splash is released by `index.ts` before this
 *      component mounts).
 *   2. Every checkpoint recorded by `BootRecorder` is rendered live
 *      as a scrolling list — including the outcome of the deferred
 *      `require("./App")` call below.
 *   3. If `./App` module evaluation throws (which cannot be caught by
 *      any React ErrorBoundary because the throw happens BEFORE React
 *      renders), we catch it here at require-time and display the
 *      error name / message / stack directly on the phone.
 *   4. Real Driver behaviour is preserved: after the diagnostic loads
 *      the real `App` successfully, tapping "Continue to real app"
 *      renders it inline — the actual auth/navigation tree takes over.
 *
 * Remove this file, `BootRecorder.ts`, and the imports in `index.ts`
 * once the root cause is identified.
 */
import React, { useEffect, useMemo, useReducer, useState } from "react";
import {
  DevSettings,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { bootRecorder, type BootStep } from "./BootRecorder";

type AppComponent = React.ComponentType<Record<string, unknown>>;

interface LoadState {
  AppComp?: AppComponent;
  error?: { name: string; message: string; stack?: string };
}

/**
 * Class boundary that catches synchronous throws from the real App's
 * initial render tree. `AppErrorBoundary` inside App.tsx should
 * normally handle these, but if App.tsx module load succeeds and then
 * something throws during React's first commit for App itself, this
 * outer boundary is our last chance to display it.
 */
class AppRenderBoundary extends React.Component<
  { children: React.ReactNode; onError: (e: Error) => void },
  { errored: boolean }
> {
  state = { errored: false };
  static getDerivedStateFromError() {
    return { errored: true };
  }
  componentDidCatch(err: Error) {
    this.props.onError(err);
  }
  render() {
    if (this.state.errored) return null;
    return this.props.children;
  }
}

export function BootDiagnosticApp() {
  bootRecorder.record(
    7,
    "BootDiagnosticApp() function entered (React invoked our root)",
    true,
  );
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [load, setLoad] = useState<LoadState>({});
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    const unsub = bootRecorder.subscribe(force);
    bootRecorder.record(
      9,
      "bootstrap useEffect fired (React committed at least one render)",
      true,
    );
    try {
      // Deferred module load — Metro's `require()` evaluates ./App and
      // its transitive imports NOW. Any module-scope throw in a screen
      // or provider propagates here and is displayed on-device.
      const mod = require("./App") as { App: AppComponent };
      if (!mod.App) throw new Error("./App module has no `App` named export");
      bootRecorder.record(
        12,
        "./App module require() succeeded, App component located",
        true,
      );
      setLoad({ AppComp: mod.App });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      bootRecorder.record(
        12,
        "./App require() FAILED — module evaluation threw",
        false,
        `${err.name}: ${err.message}`,
      );
      setLoad({
        error: { name: err.name, message: err.message, stack: err.stack },
      });
    }
    return unsub;
  }, []);

  const handleContinue = () => {
    if (load.AppComp) setShowApp(true);
  };
  const handleRetry = () => {
    try {
      DevSettings.reload();
    } catch {
      /* release builds have no DevSettings — silently no-op */
    }
  };

  if (showApp && load.AppComp) {
    const RealApp = load.AppComp;
    return (
      <AppRenderBoundary
        onError={(e) =>
          bootRecorder.record(
            13,
            "Real App render threw — caught by outer boundary",
            false,
            `${e.name}: ${e.message}`,
          )
        }
      >
        <RealApp />
      </AppRenderBoundary>
    );
  }

  return <DiagnosticUI load={load} onContinue={handleContinue} onRetry={handleRetry} />;
}

function DiagnosticUI({
  load,
  onContinue,
  onRetry,
}: {
  load: LoadState;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const steps = bootRecorder.steps;
  const currentStep = steps[steps.length - 1];
  const summary = useMemo(
    () => ({
      indexStarted: bootRecorder.hasStep(0),
      appModuleLoaded: bootRecorder.hasStep(12),
      appFnReached: bootRecorder.hasStep(14),
      useAuthValueReached: bootRecorder.hasStep(15),
      firstCommitReached: bootRecorder.hasStep(16),
      splashHidden: bootRecorder.hasStep(4),
      pushHandlerOk: bootRecorder.hasStep(17),
    }),
    [steps.length],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0a" }} testID="driver-boot-diagnostic">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 14 }}>
        <View>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.2 }}>
            CargoOne Driver — Startup Diagnostic
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
            If you can read this, JS is executing on the device. Native splash was released.
          </Text>
        </View>

        {currentStep ? (
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 14,
              gap: 4,
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600" }}>
              CURRENT CHECKPOINT
            </Text>
            <Text style={{ color: currentStep.ok ? "#4ade80" : "#f87171", fontSize: 15, fontWeight: "700" }}>
              #{currentStep.n} — {currentStep.ok ? "OK" : "FAILED"}
            </Text>
            <Text style={{ color: "#fff", fontSize: 13 }}>{currentStep.msg}</Text>
            {currentStep.err ? (
              <Text style={{ color: "#fca5a5", fontSize: 11, fontFamily: "Menlo" }}>{currentStep.err}</Text>
            ) : null}
          </View>
        ) : null}

        {load.error ? <ErrorCard error={load.error} /> : null}

        <SummaryBlock summary={summary} />

        <View style={{ gap: 4, marginTop: 6 }}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", marginBottom: 4 }}>
            BOOT LOG
          </Text>
          {steps.map((s, i) => (
            <StepRow key={i} step={s} />
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <Pressable
            testID="boot-diag-retry"
            onPress={onRetry}
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#B01F1F" : "#D62828",
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 999,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Retry Startup</Text>
          </Pressable>
          {load.AppComp ? (
            <Pressable
              testID="boot-diag-continue"
              onPress={onContinue}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#0e6d3a" : "#12b055",
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 999,
              })}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Continue to real app</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function StepRow({ step }: { step: BootStep }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Text style={{ color: step.ok ? "#4ade80" : "#f87171", fontSize: 12, width: 16 }}>{step.ok ? "✓" : "✗"}</Text>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, width: 28 }}>#{step.n}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 12 }}>{step.msg}</Text>
        {step.err ? (
          <Text style={{ color: "#fca5a5", fontSize: 11, fontFamily: "Menlo", marginTop: 2 }}>{step.err}</Text>
        ) : null}
      </View>
    </View>
  );
}

function SummaryBlock({
  summary,
}: {
  summary: {
    indexStarted: boolean;
    appModuleLoaded: boolean;
    appFnReached: boolean;
    useAuthValueReached: boolean;
    firstCommitReached: boolean;
    splashHidden: boolean;
    pushHandlerOk: boolean;
  };
}) {
  const row = (label: string, ok: boolean) => (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Text style={{ color: ok ? "#4ade80" : "#f87171", fontSize: 12, width: 16 }}>{ok ? "✓" : "○"}</Text>
      <Text style={{ color: "#fff", fontSize: 12 }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", padding: 12, borderRadius: 8, gap: 6 }}>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600" }}>SUMMARY</Text>
      {row("index.ts began executing", summary.indexStarted)}
      {row("./src/App module loaded", summary.appModuleLoaded)}
      {row("App() function reached", summary.appFnReached)}
      {row("useAuthValue() reached", summary.useAuthValueReached)}
      {row("First React commit / useEffect fired", summary.firstCommitReached)}
      {row("SplashScreen.hideAsync succeeded", summary.splashHidden)}
      {row("initPushForegroundHandler succeeded", summary.pushHandlerOk)}
    </View>
  );
}

function ErrorCard({
  error,
}: {
  error: { name: string; message: string; stack?: string };
}) {
  const shortStack = error.stack ? error.stack.split("\n").slice(0, 15).join("\n") : undefined;
  return (
    <View
      style={{
        backgroundColor: "#2a0808",
        borderColor: "#8f1d1d",
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 6,
      }}
    >
      <Text style={{ color: "#fca5a5", fontSize: 12, fontWeight: "700" }}>MODULE EVALUATION ERROR</Text>
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{error.name}</Text>
      <Text style={{ color: "#fff", fontSize: 13 }}>{error.message}</Text>
      {shortStack ? (
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Menlo", marginTop: 4 }}>
          {shortStack}
        </Text>
      ) : null}
    </View>
  );
}
