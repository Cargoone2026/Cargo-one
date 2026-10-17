// DocumentsScreen — lists verification docs; upload/replace via camera or library.
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ActivityIndicator, RefreshControl, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { DriverAPI, type DriverDocument } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import {
  Card, EmptyState, Icon, Page, PageHeader, PrimaryButton, Section, SecondaryButton,
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
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [resubmitting, setResubmitting] = useState(false);
  const { user, refresh } = useAuth();
  const changesRequested = user?.status === "changes_requested";
  const requestedTypes = user?.changes_requested_doc_types || [];

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

  const setErr = (type: string, msg: string | null) =>
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[type] = msg; else delete next[type];
      return next;
    });

  const pick = async (type: string, source: "camera" | "library") => {
    setErr(type, null);
    setDone((d) => ({ ...d, [type]: false }));
    let res: ImagePicker.ImagePickerResult;
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setErr(type, "Camera permission is required to photograph documents.");
        res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5, allowsEditing: false });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return setErr(type, "Photo library permission is required to attach photos.");
        res = await ImagePicker.launchImageLibraryAsync({
          base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      }
    } catch (e: any) {
      return setErr(type, e?.message || (source === "camera" ? "Couldn't open camera." : "Couldn't open photo library."));
    }
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.base64) return setErr(type, "Couldn't read that photo. Please try another.");
    setBusy(type);
    try {
      await DriverAPI.submitDoc({
        doc_type: type,
        base64: `data:image/jpeg;base64,${asset.base64}`,
        filename: `${type}_${Date.now()}.jpg`,
      });
      setDone((d) => ({ ...d, [type]: true }));
      await load();
    } catch (e: any) {
      setErr(type, e?.message || "Upload failed. Please check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const chooseSource = (type: string) =>
    Alert.alert(humanize(type), "Add a clear photo of this document.", [
      { text: "Take photo", onPress: () => pick(type, "camera") },
      { text: "Choose from library", onPress: () => pick(type, "library") },
      { text: "Cancel", style: "cancel" },
    ]);

  const submitForReview = async () => {
    setResubmitting(true);
    try {
      await DriverAPI.resubmitVerification();
      await refresh();
      Alert.alert("Submitted", "Your documents have been sent for review.");
    } catch (e: any) {
      Alert.alert("Could not submit", e?.message || "Please try again.");
    } finally {
      setResubmitting(false);
    }
  };

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
            Upload a clear photo of each document. You can also upload PDFs from the web portal.
          </Text>
        </View>

        {changesRequested ? (
          <Card testID="documents-changes-requested">
            <Text style={typography.strong}>Changes requested</Text>
            {user?.changes_requested_reason ? (
              <Text style={[typography.small, { marginTop: 4 }]}>{user.changes_requested_reason}</Text>
            ) : null}
            <Text style={[typography.caption, { marginTop: space[2] }]}>
              Upload the updated documents below, then submit them for review.
            </Text>
            <PrimaryButton
              title="Submit for review"
              onPress={submitForReview}
              loading={resubmitting}
              disabled={!!busy}
              testID="documents-submit-review"
              style={{ marginTop: space[3] }}
            />
          </Card>
        ) : null}

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
                {busy === type ? (
                  <View style={styles.statusRow} testID={`doc-${type}-uploading`}>
                    <ActivityIndicator color={colors.brand} />
                    <Text style={typography.small}>Uploading…</Text>
                  </View>
                ) : done[type] && !errors[type] ? (
                  <View style={styles.statusRow} testID={`doc-${type}-success`}>
                    <Icon name="check-circle" size={16} color={colors.successInk} />
                    <Text style={[typography.small, { color: colors.successInk }]}>Uploaded – pending review</Text>
                  </View>
                ) : null}
                {errors[type] ? (
                  <Text style={[typography.caption, { marginTop: space[2], color: colors.errorInk }]} testID={`doc-${type}-error`}>
                    {errors[type]}
                  </Text>
                ) : null}
                <SecondaryButton
                  title={actionLabel(doc, changesRequested && requestedTypes.includes(type))}
                  onPress={() => chooseSource(type)}
                  disabled={!!busy}
                  testID={`doc-${type}-upload`}
                  style={{ marginTop: space[3] }}
                />
              </Card>
            );
          })
        )}
      </Section>
    </Page>
  );
}

function actionLabel(doc: DriverDocument | null, requested: boolean): string {
  if (!doc) return "Upload";
  if (doc.status === "rejected" || requested) return "Resubmit";
  return "Replace";
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
  statusRow: {
    flexDirection: "row" as const, alignItems: "center" as const,
    gap: space[2], marginTop: space[2],
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
