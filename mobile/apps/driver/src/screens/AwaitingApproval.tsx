/**
 * AwaitingApprovalScreen — driver account not yet ready to accept jobs.
 *
 * Mirrors the web Driver Dashboard's account-state banners
 * (frontend/src/pages/portal/driver/Dashboard.jsx) but as a gated
 * full-screen. Reads `user.status` and renders:
 *
 *   • "pending"            — first-time reviewers; upload docs CTA.
 *   • "changes_requested"  — admin returned the application; shows
 *                            the reason + doc types, plus a resubmit
 *                            button that hits /auth/me/resubmit-verification.
 *   • "suspended"          — final state; no resubmit; contact support.
 *   • fallback             — generic "in review".
 */
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { AlertTriangle, Ban, ShieldCheck, UploadCloud } from "lucide-react-native";
import { DriverAPI } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { Page, PrimaryButton, SecondaryButton } from "../ui";
import { colors, radius, typography } from "../theme";

type Variant = "pending" | "changes_requested" | "suspended";

function statusVariant(status: string | undefined): Variant {
  if (status === "suspended") return "suspended";
  if (status === "changes_requested") return "changes_requested";
  return "pending"; // default
}

export function AwaitingApprovalScreen() {
  const { user, logout, refresh } = useAuth();
  const variant = statusVariant(user?.status);
  const [busy, setBusy] = useState<null | "resubmit" | "refresh">(null);

  const onResubmit = useCallback(async () => {
    setBusy("resubmit");
    try {
      await DriverAPI.resubmitVerification();
      await refresh();
      Alert.alert(
        "Submitted for review",
        "Thanks — our team will re-check your details shortly.",
      );
    } catch (e: any) {
      Alert.alert("Could not resubmit", e?.message || "Please try again in a moment.");
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    setBusy("refresh");
    try {
      await refresh();
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const docTypes = user?.changes_requested_doc_types || [];
  const reason = user?.changes_requested_reason || null;

  return (
    <Page testID="driver-awaiting-approval">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>C1</Text>
          </View>
          <Text style={styles.brandTitle}>CARGO ONE</Text>
          <Text style={styles.brandRole}>Driver</Text>
        </View>

        {variant === "suspended" ? (
          <View style={[styles.hero, { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }]}
                testID="driver-suspended-card">
            <Ban size={36} color={colors.errorInk} strokeWidth={2} />
            <Text style={[typography.h1Large, { textAlign: "center" }]}>Account suspended</Text>
            <Text
              style={[
                typography.body,
                { textAlign: "center", color: colors.inkMuted, lineHeight: 22 },
              ]}
            >
              Contact support if you believe this is a mistake.
            </Text>
          </View>
        ) : variant === "changes_requested" ? (
          <View style={[styles.hero, { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }]}
                testID="driver-changes-card">
            <AlertTriangle size={36} color={colors.errorInk} strokeWidth={2} />
            <Text style={[typography.h1Large, { textAlign: "center" }]}>
              Admin has requested changes
            </Text>
            {reason ? (
              <Text
                style={[
                  typography.body,
                  { textAlign: "center", color: "#78350F", lineHeight: 22 },
                ]}
                testID="driver-changes-reason"
              >
                {reason}
              </Text>
            ) : null}
            {docTypes.length > 0 ? (
              <Text
                style={[typography.body, { textAlign: "center", color: "#78350F" }]}
                testID="driver-changes-doctypes"
              >
                Please re-upload:{" "}
                {docTypes.map((k) => k.replace(/_/g, " ")).join(", ")}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.hero}>
            <ShieldCheck size={36} color={colors.brand} strokeWidth={2} />
            <Text style={[typography.h1Large, { textAlign: "center" }]}>
              Application in review
            </Text>
            <Text
              style={[
                typography.body,
                { textAlign: "center", color: colors.inkMuted, lineHeight: 22 },
              ]}
            >
              Our team is checking your details. You'll get an email as soon as you're approved — then you
              can start accepting jobs.
            </Text>
          </View>
        )}

        <View style={{ gap: 12 }}>
          {variant === "changes_requested" ? (
            <PrimaryButton
              title="Re-submit for review"
              onPress={onResubmit}
              loading={busy === "resubmit"}
              testID="driver-changes-resubmit"
            />
          ) : null}
          {variant !== "suspended" ? (
            <PrimaryButton
              title="Check status"
              onPress={onRefresh}
              loading={busy === "refresh"}
              testID="approval-refresh"
            />
          ) : null}
          <SecondaryButton
            title="Log out"
            onPress={() => logout()}
            testID="approval-logout"
          />
        </View>

        {variant === "pending" ? (
          <View style={styles.footerNote} testID="driver-warning-card">
            <UploadCloud size={16} color={colors.brand} />
            <Text style={{ fontSize: 13, color: colors.inkMuted, flex: 1 }}>
              Upload driving licence, insurance, ID and vehicle photos from the Documents screen once
              you're approved so we can verify you quickly.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Page>
  );
}

const styles = {
  brand: { alignItems: "center" as const, gap: 8, marginTop: 20 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  markText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  brandTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 1.6,
    marginTop: 6,
  },
  brandRole: { color: colors.inkMuted, fontSize: 12, letterSpacing: 0.4 },
  hero: {
    alignItems: "center" as const,
    gap: 12,
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  footerNote: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#FFFBEB",
  },
};
