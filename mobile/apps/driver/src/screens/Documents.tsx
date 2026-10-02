/**
 * DocumentsScreen — VIEW-ONLY. Lists the driver's verification documents
 * so they can see which required docs are approved / pending / rejected.
 * No upload / no image-picker in this pass (keeps Driver autolinking
 * exclude list intact — no expo-image-picker native module).
 *
 * Driver web counterpart offers upload/resubmit; mobile view-only
 * surfaces the same information cleanly without inventing endpoints.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DriverAPI, type DriverDocument } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import {
  Card, EmptyState, Icon, Page, PageHeader, Section,
  colors, radius, space, typography,
} from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Documents">;

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  approved: { bg: colors.successBg, fg: colors.successInk, label: "Approved" },
  pending: { bg: colors.warningBg, fg: colors.warningInk, label: "Pending review" },
  rejected: { bg: colors.errorBg, fg: colors.errorInk, label: "Rejected" },
};

export default function DocumentsScreen({ navigation }: P) {
  const [required, setRequired] = useState<string[]>([]);
  const [docs, setDocs] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await DriverAPI.listDocs();
      setRequired(r.required || []);
      setDocs(r.documents || []);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Profile"));

  const docsByType = new Map<string, DriverDocument>();
  for (const d of docs) if (d.doc_type && !docsByType.has(d.doc_type)) docsByType.set(d.doc_type, d);

  const items = (required.length > 0 ? required : docs.map((d) => d.doc_type))
    .map((type) => ({ type, doc: docsByType.get(type) || null }));

  return (
    <Page
      testID="documents-screen"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
    >
      <PageHeader title="Verification documents" onBack={goBack} />
      <Section gap={space[3]}>
        <View style={styles.info}>
          <Icon name="info" size={18} color={colors.infoInk} />
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.ink }}>
            Document upload is available from the Driver web portal. This view
            shows the status of your submitted documents.
          </Text>
        </View>

        {loading && items.length === 0 ? (
          <Text style={[typography.caption, { textAlign: "center", paddingVertical: space[6] }]}>
            Loading documents…
          </Text>
        ) : items.length === 0 ? (
          <EmptyState
            glyph="file-text"
            title="No documents required"
            body="Your account doesn't currently require verification documents."
            testID="documents-empty"
          />
        ) : (
          items.map(({ type, doc }) => {
            const s = STATUS_COLORS[doc?.status || ""] || {
              bg: colors.bgSecondary, fg: colors.inkMuted, label: "Not submitted",
            };
            return (
              <Card key={type} testID={`doc-${type}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                  <View style={styles.docIcon}>
                    <Icon name="file-text" size={18} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={typography.strong}>{humanize(type)}</Text>
                    <Text style={[typography.small, { marginTop: 2 }]}>
                      {doc?.uploaded_at
                        ? `Uploaded ${new Date(doc.uploaded_at).toLocaleDateString()}`
                        : doc?.created_at
                        ? `Submitted ${new Date(doc.created_at).toLocaleDateString()}`
                        : "Not yet submitted"}
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: s.bg }]}>
                    <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
                  </View>
                </View>
                {doc?.rejection_reason ? (
                  <Text style={[typography.caption, { marginTop: space[2], color: colors.errorInk }]}>
                    {doc.rejection_reason}
                  </Text>
                ) : null}
              </Card>
            );
          })
        )}
      </Section>
    </Page>
  );
}

function humanize(k: string): string {
  return (k || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = {
  info: {
    flexDirection: "row" as const,
    gap: space[3],
    padding: space[4],
    borderRadius: radius.base,
    backgroundColor: colors.infoBg,
    alignItems: "flex-start" as const,
  },
  docIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  pill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  pillText: {
    fontSize: 11, fontWeight: "800" as const,
    letterSpacing: 0.4, textTransform: "uppercase" as const,
  },
} as const;
