import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Doc = {
  id: string;
  doc_type: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  expiry_date?: string | null;
  uploaded_at: string;
};

const DOC_LABELS: Record<string, string> = {
  driving_licence: "Driving Licence",
  insurance: "Insurance Certificate",
  vehicle_registration: "Vehicle Registration",
  vehicle_photos: "Vehicle Photos",
  profile_photo: "Profile Photo",
  proof_of_address: "Proof of Address",
};

export default function DriverDocuments() {
  const router = useRouter();
  const [required, setRequired] = useState<string[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api("/users/me/documents");
      setRequired(res.required || []);
      setDocs(res.documents || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byType = new Map<string, Doc>();
  docs.forEach((d) => { if (!byType.has(d.doc_type)) byType.set(d.doc_type, d); });

  async function pick(docType: string) {
    setUploadingType(docType);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
        allowsEditing: docType === "profile_photo",
        aspect: docType === "profile_photo" ? [1, 1] : undefined,
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const b64 = `data:image/jpeg;base64,${res.assets[0].base64}`;
      await api("/users/me/documents", {
        method: "POST",
        body: { doc_type: docType, base64: b64 },
      });
      await load();
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="docs-back">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verification Documents</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={required}
        keyExtractor={(t) => t}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
            <Text style={styles.introText}>
              Upload every document below to activate your driver account and earn the Verified Driver badge.
            </Text>
          </View>
        }
        renderItem={({ item: docType }) => {
          const doc = byType.get(docType);
          const uploading = uploadingType === docType;
          return (
            <Pressable
              style={styles.docCard}
              onPress={() => pick(docType)}
              disabled={uploading}
              testID={`upload-${docType}`}
            >
              <View style={styles.docIconWrap}>
                <Ionicons name="document-text" size={22} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{DOC_LABELS[docType] || docType}</Text>
                {doc ? (
                  <View style={styles.docMeta}>
                    <View style={[styles.pill, statusStyle(doc.status).bg]}>
                      <Text style={[styles.pillText, statusStyle(doc.status).fg]}>
                        {doc.status.toUpperCase()}
                      </Text>
                    </View>
                    {doc.expiry_date && (
                      <Text style={styles.docExpiry}>
                        Expires {new Date(doc.expiry_date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.docMissing}>Not uploaded yet</Text>
                )}
                {doc?.status === "rejected" && doc.rejection_reason && (
                  <Text style={styles.docReason}>{doc.rejection_reason}</Text>
                )}
              </View>
              {uploading ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Ionicons
                  name={doc ? "refresh-circle" : "cloud-upload"}
                  size={26}
                  color={colors.brand}
                />
              )}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

function statusStyle(s: string) {
  if (s === "approved") return { bg: { backgroundColor: colors.successBg }, fg: { color: colors.success } };
  if (s === "rejected") return { bg: { backgroundColor: colors.errorBg }, fg: { color: colors.error } };
  return { bg: { backgroundColor: "#FEF3C7" }, fg: { color: "#92400E" } };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  intro: {
    flexDirection: "row", gap: spacing.sm, padding: spacing.md,
    backgroundColor: "#FEE2E2", borderRadius: radius.md, alignItems: "center",
    marginBottom: spacing.sm,
  },
  introText: { flex: 1, fontSize: font.sm, color: colors.text, lineHeight: 18 },
  docCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  docIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
  },
  docLabel: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  docMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { fontSize: 10, fontWeight: weight.bold, letterSpacing: 0.6 },
  docExpiry: { fontSize: font.sm, color: colors.textSecondary },
  docMissing: { fontSize: font.sm, color: colors.textTertiary, marginTop: 2 },
  docReason: { fontSize: font.sm, color: colors.error, marginTop: spacing.xs, fontStyle: "italic" },
});
