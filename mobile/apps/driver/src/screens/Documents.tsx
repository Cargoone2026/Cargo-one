/**
 * DocumentsScreen — driver verification documents.
 *
 * R71.16.10 (Driver P2) — ports the web
 * `frontend/src/pages/portal/driver/Documents.jsx`:
 *   • GET /users/me/documents → { required, documents }.
 *   • Per required doc slot, render Approved/Pending/Rejected/Missing state
 *     with rejection_reason + uploaded_at.
 *   • Upload → base64 data URL via expo-image-picker (camera OR library);
 *     backend expects { doc_type, base64 }.
 *   • Re-upload replaces an existing document.
 *   • Loading, empty, error states + duplicate-upload protection.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  CheckCircle2,
  Clock,
  FileText,
  UploadCloud,
  XCircle,
} from "lucide-react-native";
import { DriverAPI, DriverDocument } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { Page, PageHeader, PrimaryButton, SecondaryButton } from "../ui";
import { useShellMenu } from "../components/AppShell";
import { colors, radius, typography } from "../theme";

const DOC_LABELS: Record<string, string> = {
  driving_licence: "Driving Licence",
  insurance: "Insurance Certificate",
  vehicle_registration: "Vehicle Registration",
  vehicle_photos: "Vehicle Photos",
  profile_photo: "Profile Photo",
  proof_of_address: "Proof of Address",
};

function statusMeta(status?: string) {
  if (status === "approved") return { bg: "#DCFCE7", fg: "#166534", Icon: CheckCircle2, label: "Approved" };
  if (status === "rejected") return { bg: "#FEE2E2", fg: "#B91C1C", Icon: XCircle, label: "Rejected" };
  return { bg: "#FEF3C7", fg: "#92400E", Icon: Clock, label: "Pending" };
}

export function DocumentsScreen() {
  const { user, refresh } = useAuth();
  const { openDrawer, showMenu } = useShellMenu();
  const [required, setRequired] = useState<string[]>([]);
  const [docs, setDocs] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErr(null);
    try {
      const res = await DriverAPI.listDocs();
      setRequired(Array.isArray(res.required) ? res.required : []);
      setDocs(Array.isArray(res.documents) ? res.documents : []);
    } catch (e: any) {
      setErr(e?.message || "Could not load documents");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pickFrom(docType: string, kind: "camera" | "library") {
    if (uploadingType) return;
    const perm =
      kind === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        kind === "camera" ? "Please allow camera access to take photos." : "Please allow photo library access.",
      );
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      allowsEditing: false,
      quality: 0.7,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    };
    const res =
      kind === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (!asset.base64) {
      Alert.alert("Upload failed", "Could not read the selected image.");
      return;
    }
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    setUploadingType(docType);
    setErr(null);
    try {
      await DriverAPI.submitDoc({ doc_type: docType, base64: dataUrl });
      await load(true);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  function askSource(docType: string) {
    Alert.alert("Upload document", "Where should we get it from?", [
      { text: "Take photo", onPress: () => pickFrom(docType, "camera") },
      { text: "Choose from library", onPress: () => pickFrom(docType, "library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function onResubmit() {
    setResubmitting(true);
    try {
      await DriverAPI.resubmitVerification();
      await refresh();
      Alert.alert("Submitted for review", "Thanks — our team will re-check your details shortly.");
    } catch (e: any) {
      Alert.alert("Could not resubmit", e?.message || "Please try again in a moment.");
    } finally {
      setResubmitting(false);
    }
  }

  // Group docs by type; most recent first per type.
  const byType = new Map<string, DriverDocument>();
  for (const d of docs) {
    if (!byType.has(d.doc_type)) byType.set(d.doc_type, d);
  }

  const canResubmit = (user as any)?.status === "changes_requested";

  return (
    <Page testID="driver-documents" scroll={false}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />
        }
      >
        <PageHeader
          large
          title="Documents"
          subtitle="Verification documents"
          showMenu={showMenu}
          onMenuPress={openDrawer}
        />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <View style={styles.infoBox}>
            <FileText size={18} color="#2563EB" />
            <Text style={{ flex: 1, fontSize: 13, color: colors.ink, lineHeight: 20 }}>
              Upload clear photos of each required document. Files stay private and are used only for verification.
            </Text>
          </View>

          {err ? (
            <Text style={{ fontSize: 13, color: colors.error }} testID="docs-error">
              {err}
            </Text>
          ) : null}

          {canResubmit ? (
            <PrimaryButton
              title="Re-submit for review"
              onPress={onResubmit}
              loading={resubmitting}
              testID="documents-resubmit"
            />
          ) : null}

          {loading && required.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : required.length === 0 ? (
            <Text style={typography.caption}>No required documents.</Text>
          ) : (
            required.map((t) => {
              const doc = byType.get(t);
              const s = statusMeta(doc?.status);
              const uploading = uploadingType === t;
              const uploadedAt = doc?.uploaded_at || doc?.created_at;
              return (
                <View key={t} style={styles.docCard} testID={`doc-row-${t}`}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.cardTitle}>{DOC_LABELS[t] || t}</Text>
                      {doc?.rejection_reason ? (
                        <Text style={{ fontSize: 12, color: colors.error, marginTop: 4 }}>
                          {doc.rejection_reason}
                        </Text>
                      ) : null}
                      {uploadedAt ? (
                        <Text style={{ fontSize: 12, color: colors.inkMuted, marginTop: 4 }}>
                          Uploaded {new Date(uploadedAt).toLocaleDateString()}
                        </Text>
                      ) : null}
                    </View>
                    {doc ? (
                      <View style={[styles.pill, { backgroundColor: s.bg }]}>
                        <s.Icon size={12} color={s.fg} />
                        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: s.fg }}>
                          {s.label.toUpperCase()}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.pill, { backgroundColor: colors.bgSecondary }]}>
                        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: colors.inkMuted }}>
                          MISSING
                        </Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => askSource(t)}
                    testID={`doc-upload-${t}`}
                    disabled={uploading}
                    style={({ pressed }) => [
                      styles.uploadBtn,
                      pressed && { backgroundColor: colors.brand },
                      uploading && { opacity: 0.6 },
                    ]}
                  >
                    <UploadCloud size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>
                      {uploading ? "Uploading…" : doc ? "Re-upload" : "Upload"}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = {
  infoBox: {
    flexDirection: "row" as const,
    gap: 10,
    padding: 12,
    borderRadius: radius.base,
    backgroundColor: "#DBEAFE",
  },
  docCard: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 12,
  },
  pill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  uploadBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.base,
    backgroundColor: colors.ink,
  },
};
