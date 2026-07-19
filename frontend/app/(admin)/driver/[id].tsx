import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

const DOC_TYPE_LABELS: Record<string, string> = {
  driving_licence: "Driving Licence",
  insurance: "Motor Insurance",
  vehicle_registration: "Vehicle Registration (V5C)",
  vehicle_photos: "Vehicle Photos",
  profile_photo: "Profile Photo",
  proof_of_address: "Proof of Address",
  goods_in_transit: "Goods in Transit Insurance",
  public_liability: "Public Liability Insurance",
};

const ALL_DOC_TYPES = Object.keys(DOC_TYPE_LABELS);

const STATUS_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  approved:          { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  pending:           { bg: "#FEF3C7", fg: "#92400E", label: "Pending review" },
  submitted:         { bg: "#FEF3C7", fg: "#92400E", label: "Pending review" },
  rejected:          { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" },
  changes_requested: { bg: "#FEE2E2", fg: "#991B1B", label: "Changes requested" },
  active:            { bg: "#DCFCE7", fg: "#166534", label: "Active" },
  suspended:         { bg: "#FEE2E2", fg: "#991B1B", label: "Suspended" },
};

function alertMsg(title: string, msg: string) {
  if (Platform.OS === "web") (globalThis as any).alert?.(`${title}\n${msg}`);
  else Alert.alert(title, msg);
}

export default function AdminDriverDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<null | { kind: "changes" | "suspend" }>(null);
  const [reason, setReason] = useState("");
  const [reasonDocs, setReasonDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<any>(`/admin/drivers/${id}`);
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Could not load driver");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const user = data?.user;
  const docs: any[] = data?.documents || [];
  const fleet: any[] = data?.fleet || [];
  const stats = data?.stats || {};

  const uploadedDocTypes = new Set(docs.map((d) => d.doc_type));
  const missingDocs = ALL_DOC_TYPES.filter((k) => !uploadedDocTypes.has(k));

  const approve = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/admin/users/${id}/approve`, { method: "POST" });
      alertMsg("Driver approved", "The driver can now accept jobs.");
      await load();
    } catch (e: any) {
      alertMsg("Approve failed", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitReason = async () => {
    if (!id || !reasonModal) return;
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      alertMsg("Reason required", "Please provide at least 10 characters explaining the decision.");
      return;
    }
    setBusy(true);
    try {
      const endpoint =
        reasonModal.kind === "changes"
          ? `/admin/users/${id}/request-changes`
          : `/admin/users/${id}/suspend`;
      const body: any = { reason: trimmed };
      if (reasonModal.kind === "changes") body.doc_types = reasonDocs;
      await api(endpoint, { method: "POST", body });
      setReasonModal(null);
      setReason("");
      setReasonDocs([]);
      await load();
    } catch (e: any) {
      alertMsg("Action failed", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const openPreview = (doc: any) => {
    if (!doc?.base64) return;
    setPreview(doc.base64);
  };

  const openDocExternally = (doc: any) => {
    // For non-image / non-pdf files or when tapping full-view is not enough
    if (!doc?.base64) return;
    if (Platform.OS === "web") {
      try {
        const w = (globalThis as any).open?.(doc.base64, "_blank");
        if (!w) alertMsg("Preview blocked", "Please allow popups to preview documents.");
      } catch {
        alertMsg("Preview failed", "Could not open document.");
      }
    } else {
      Linking.openURL(doc.base64).catch(() =>
        alertMsg("Preview failed", "Could not open document."),
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title="Driver review" onBack={() => router.back()} />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header title="Driver review" onBack={() => router.back()} />
        <View style={styles.loadingBox}>
          <Ionicons name="warning" size={32} color={colors.warning} />
          <Text style={styles.errText}>{error || "Driver not found"}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusMeta = STATUS_COLOR[user.status] || { bg: colors.bgSecondary, fg: colors.text, label: user.status };
  const isChangesRequested = user.status === "changes_requested";
  const isSuspended = user.status === "suspended";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Header title="Driver review" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header profile card */}
        <View style={styles.profileCard}>
          {user.profile_photo ? (
            <Image source={{ uri: user.profile_photo }} style={styles.avatarLg} />
          ) : (
            <View style={[styles.avatarLg, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{(user.name || "?")[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            {user.phone ? <Text style={styles.profileEmail}>{user.phone}</Text> : null}
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: statusMeta.bg }]}>
                <Text style={[styles.pillText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: colors.bgSecondary }]}>
                <Text style={[styles.pillText, { color: colors.text }]}>
                  {stats.completed_bookings ?? 0} completed · {(stats.rating ?? 5).toFixed(1)}★
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Changes requested banner (if applicable) */}
        {isChangesRequested && (
          <View style={styles.noticeBox}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Changes requested</Text>
              <Text style={styles.noticeBody}>{user.changes_requested_reason}</Text>
              {(user.changes_requested_doc_types || []).length > 0 && (
                <Text style={styles.noticeBody}>
                  Documents: {user.changes_requested_doc_types.map((d: string) => DOC_TYPE_LABELS[d] || d).join(", ")}
                </Text>
              )}
            </View>
          </View>
        )}

        {isSuspended && user.suspension_reason && (
          <View style={[styles.noticeBox, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
            <Ionicons name="ban" size={20} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Suspended</Text>
              <Text style={styles.noticeBody}>{user.suspension_reason}</Text>
            </View>
          </View>
        )}

        {/* Profile details */}
        <Section title="Driver details">
          <DetailRow label="Full name" value={user.name} />
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Phone" value={user.phone || "—"} />
          <DetailRow
            label="Address"
            value={
              [user.address_line, user.town, user.postcode, user.country || user.country_code]
                .filter(Boolean)
                .join(", ") || user.address || "—"
            }
          />
          <DetailRow label="Registered" value={user.created_at ? new Date(user.created_at).toLocaleString() : "—"} />
          <DetailRow label="Documents verified" value={user.documents_verified ? "Yes" : "No"} />
        </Section>

        {/* Documents */}
        <Section title={`Verification documents (${docs.length})`}>
          {docs.length === 0 && (
            <View style={styles.emptyRow}>
              <Ionicons name="folder-open-outline" size={22} color={colors.textTertiary} />
              <Text style={styles.emptyRowText}>No documents uploaded yet.</Text>
            </View>
          )}
          {docs.map((doc) => {
            const meta = STATUS_COLOR[doc.status || "pending"] || STATUS_COLOR.pending;
            const isImage = (doc.base64 || "").startsWith("data:image");
            const isPdf = (doc.base64 || "").startsWith("data:application/pdf");
            return (
              <View key={doc.id} style={styles.docCard} testID={`doc-${doc.id}`}>
                <View style={styles.docHead}>
                  <Text style={styles.docTitle}>{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</Text>
                  <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.pillText, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                </View>
                {doc.filename ? <Text style={styles.docMeta}>{doc.filename}</Text> : null}
                {doc.expiry_date ? (
                  <Text style={styles.docMeta}>Expires: {doc.expiry_date}</Text>
                ) : null}
                {doc.rejection_reason ? (
                  <Text style={[styles.docMeta, { color: colors.error }]}>
                    Reason: {doc.rejection_reason}
                  </Text>
                ) : null}
                <View style={styles.docActions}>
                  {isImage && (
                    <Pressable
                      onPress={() => openPreview(doc)}
                      style={styles.docBtn}
                      testID={`doc-preview-${doc.id}`}
                    >
                      <Ionicons name="eye" size={16} color={colors.text} />
                      <Text style={styles.docBtnText}>Preview</Text>
                    </Pressable>
                  )}
                  {(isPdf || (!isImage && !isPdf && doc.base64)) && (
                    <Pressable
                      onPress={() => openDocExternally(doc)}
                      style={styles.docBtn}
                      testID={`doc-open-${doc.id}`}
                    >
                      <Ionicons name="open" size={16} color={colors.text} />
                      <Text style={styles.docBtnText}>Open file</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
          {missingDocs.length > 0 && (
            <View style={styles.missingBox}>
              <Text style={styles.missingTitle}>Missing documents</Text>
              <Text style={styles.missingBody}>
                {missingDocs.map((k) => DOC_TYPE_LABELS[k] || k).join(", ")}
              </Text>
            </View>
          )}
        </Section>

        {/* Fleet */}
        <Section title={`Registered vehicles (${fleet.length})`}>
          {fleet.length === 0 && (
            <View style={styles.emptyRow}>
              <Ionicons name="car-outline" size={22} color={colors.textTertiary} />
              <Text style={styles.emptyRowText}>Driver has not registered any vehicles yet.</Text>
            </View>
          )}
          {fleet.map((v) => (
            <View key={v.id} style={styles.vehicleCard}>
              <View style={styles.vehicleHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleTitle}>
                    {v.vehicle_type_name || v.vehicle_type_key || "Vehicle"}
                    {v.is_default ? "  · Default" : ""}
                  </Text>
                  <Text style={styles.vehicleSub}>
                    {(v.make || "").trim()} {(v.model || "").trim()} · {v.registration || "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.vehicleMetaGrid}>
                {v.year ? <MiniMeta k="Year" v={String(v.year)} /> : null}
                {v.max_weight_kg ? <MiniMeta k="Max weight" v={`${v.max_weight_kg} kg`} /> : null}
                {v.insurance_expiry ? <MiniMeta k="Insurance exp." v={v.insurance_expiry} /> : null}
                {v.mot_expiry ? <MiniMeta k="MOT exp." v={v.mot_expiry} /> : null}
              </View>
              {(v.capabilities || []).length > 0 && (
                <View style={styles.chipWrap}>
                  {v.capabilities.map((c: string) => (
                    <View key={c} style={styles.capChip}>
                      <Text style={styles.capChipText}>{c.replace(/_/g, " ")}</Text>
                    </View>
                  ))}
                </View>
              )}
              {(v.photos || []).length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                  {v.photos.map((p: string, i: number) => (
                    <Pressable key={i} onPress={() => setPreview(p)}>
                      <Image source={{ uri: p }} style={styles.vehiclePhoto} />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}
        </Section>

        {/* History */}
        {(user.verification_history || []).length > 0 && (
          <Section title="Verification history">
            {user.verification_history.slice().reverse().map((h: any) => (
              <View key={h.id} style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <Ionicons
                    name={
                      h.action === "approve" ? "checkmark-circle" :
                      h.action === "request_changes" ? "warning" :
                      h.action === "suspend" ? "ban" :
                      "arrow-up-circle"
                    }
                    size={16}
                    color={
                      h.action === "approve" ? colors.success :
                      h.action === "suspend" ? colors.error :
                      colors.warning
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>
                    {h.action.replace(/_/g, " ")} · {h.by_admin_name || "Driver"}
                  </Text>
                  <Text style={styles.historyMeta}>{new Date(h.at).toLocaleString()}</Text>
                  {h.reason ? <Text style={styles.historyReason}>{h.reason}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Actions */}
        <View style={styles.actionBar}>
          {user.status !== "active" && (
            <Pressable
              onPress={approve}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              testID="admin-driver-approve"
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Approve driver</Text>
            </Pressable>
          )}
          {user.status !== "changes_requested" && user.status !== "suspended" && (
            <Pressable
              onPress={() => {
                setReason("");
                setReasonDocs([]);
                setReasonModal({ kind: "changes" });
              }}
              disabled={busy}
              style={[styles.warnBtn, busy && { opacity: 0.6 }]}
              testID="admin-driver-request-changes"
            >
              <Ionicons name="warning" size={18} color={colors.warning} />
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>Request changes</Text>
            </Pressable>
          )}
          {user.status !== "suspended" && (
            <Pressable
              onPress={() => {
                setReason("");
                setReasonModal({ kind: "suspend" });
              }}
              disabled={busy}
              style={[styles.dangerBtn, busy && { opacity: 0.6 }]}
              testID="admin-driver-suspend"
            >
              <Ionicons name="ban" size={18} color={colors.error} />
              <Text style={[styles.actionBtnText, { color: colors.error }]}>Suspend</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Preview modal */}
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview ? (
            <Image
              source={{ uri: preview }}
              style={{ width: "94%", height: "80%", resizeMode: "contain" }}
            />
          ) : null}
          <Pressable
            onPress={() => setPreview(null)}
            style={styles.previewClose}
            testID="doc-preview-close"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reason modal */}
      <Modal
        visible={!!reasonModal}
        transparent
        animationType="slide"
        onRequestClose={() => setReasonModal(null)}
      >
        <View style={styles.reasonBackdrop}>
          <View style={styles.reasonSheet}>
            <View style={styles.reasonHead}>
              <Text style={styles.reasonTitle}>
                {reasonModal?.kind === "changes" ? "Request document changes" : "Suspend driver"}
              </Text>
              <Pressable onPress={() => setReasonModal(null)} testID="reason-cancel">
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
              <Text style={styles.reasonLabel}>Reason (visible to the driver)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={
                  reasonModal?.kind === "changes"
                    ? "Explain what needs to be corrected or re-uploaded…"
                    : "Explain why this driver is being suspended…"
                }
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={5}
                style={styles.reasonInput}
                testID="reason-input"
              />
              {reasonModal?.kind === "changes" && (
                <>
                  <Text style={[styles.reasonLabel, { marginTop: spacing.md }]}>
                    Document(s) to re-upload (optional)
                  </Text>
                  <View style={styles.chipWrap}>
                    {ALL_DOC_TYPES.map((k) => {
                      const on = reasonDocs.includes(k);
                      return (
                        <Pressable
                          key={k}
                          onPress={() =>
                            setReasonDocs((prev) => (on ? prev.filter((p) => p !== k) : [...prev, k]))
                          }
                          style={[styles.capChip, on && { backgroundColor: colors.text }]}
                          testID={`req-doc-${k}`}
                        >
                          <Text style={[styles.capChipText, on && { color: "#fff" }]}>
                            {DOC_TYPE_LABELS[k]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              <Pressable
                onPress={submitReason}
                disabled={busy}
                style={[
                  reasonModal?.kind === "changes" ? styles.warnBtnLarge : styles.dangerBtnLarge,
                  busy && { opacity: 0.6 },
                  { marginTop: spacing.xl },
                ]}
                testID="reason-submit"
              >
                <Text style={{
                  color: "#fff",
                  fontWeight: weight.bold,
                }}>
                  {reasonModal?.kind === "changes" ? "Send request" : "Confirm suspension"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} testID="driver-detail-back">
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>{value}</Text>
    </View>
  );
}

function MiniMeta({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.miniMeta}>
      <Text style={styles.miniMetaKey}>{k}</Text>
      <Text style={styles.miniMetaValue}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  errText: { color: colors.text, fontSize: font.base, textAlign: "center" },
  retryBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: "#fff", fontWeight: weight.bold },

  profileCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  avatarLg: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#fff", fontSize: 22, fontWeight: weight.bold },
  profileName: { fontSize: font.xl, fontWeight: weight.bold, color: colors.text },
  profileEmail: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: weight.bold, letterSpacing: 0.5, textTransform: "uppercase" },

  noticeBox: {
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
    padding: spacing.md, backgroundColor: colors.warningBg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning,
    marginBottom: spacing.md,
  },
  noticeTitle: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  noticeBody: { fontSize: font.sm, color: colors.text, marginTop: 2, lineHeight: 18 },

  sectionTitle: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.bold,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  sectionBody: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
    gap: spacing.md,
  },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium, flexBasis: 120 },
  detailValue: { fontSize: font.base, color: colors.text, flex: 1, textAlign: "right" },

  emptyRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md,
  },
  emptyRowText: { color: colors.textSecondary, fontSize: font.sm },

  docCard: {
    padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  docHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  docTitle: { fontSize: font.base, fontWeight: weight.bold, color: colors.text, flex: 1 },
  docMeta: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  docActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  docBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  docBtnText: { fontSize: font.sm, color: colors.text, fontWeight: weight.semibold },

  missingBox: {
    padding: spacing.md, backgroundColor: colors.warningBg,
  },
  missingTitle: { fontSize: font.sm, fontWeight: weight.bold, color: colors.text, marginBottom: 4 },
  missingBody: { fontSize: font.sm, color: colors.text },

  vehicleCard: {
    padding: spacing.md, gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  vehicleHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  vehicleTitle: { fontSize: font.base, fontWeight: weight.bold, color: colors.text },
  vehicleSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  vehicleMetaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  miniMeta: { backgroundColor: colors.bgSecondary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  miniMetaKey: { fontSize: 10, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  miniMetaValue: { fontSize: font.sm, color: colors.text, fontWeight: weight.semibold },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  capChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.bgSecondary,
    borderRadius: radius.pill,
  },
  capChipText: { fontSize: font.sm, color: colors.text, fontWeight: weight.medium, textTransform: "capitalize" },
  vehiclePhoto: { width: 80, height: 60, borderRadius: radius.sm, marginRight: spacing.sm, backgroundColor: colors.bgSecondary },

  historyRow: {
    flexDirection: "row", gap: spacing.md, padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  historyIcon: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.bgSecondary,
  },
  historyTitle: { fontSize: font.sm, color: colors.text, fontWeight: weight.semibold, textTransform: "capitalize" },
  historyMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  historyReason: { fontSize: font.sm, color: colors.text, marginTop: 4 },

  actionBar: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: radius.pill,
  },
  primaryBtnText: { color: "#fff", fontWeight: weight.bold, fontSize: font.base },
  warnBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.warningBg, paddingVertical: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.warning,
  },
  dangerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.errorBg, paddingVertical: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.error,
  },
  actionBtnText: { fontWeight: weight.bold, fontSize: font.base },

  previewBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center",
  },
  previewClose: {
    position: "absolute", top: 40, right: 20,
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  reasonBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  reasonSheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.xl, maxHeight: "85%",
  },
  reasonHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: spacing.md,
  },
  reasonTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  reasonLabel: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.text, marginBottom: 6 },
  reasonInput: {
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    padding: spacing.md, minHeight: 100, textAlignVertical: "top",
    color: colors.text, fontSize: font.base,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  warnBtnLarge: {
    backgroundColor: colors.warning, paddingVertical: spacing.md,
    borderRadius: radius.pill, alignItems: "center",
  },
  dangerBtnLarge: {
    backgroundColor: colors.error, paddingVertical: spacing.md,
    borderRadius: radius.pill, alignItems: "center",
  },
});
