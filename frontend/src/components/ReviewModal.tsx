import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
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
import { Button } from "@/src/components/Button";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Props = {
  visible: boolean;
  bookingId: string;
  targetName: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function ReviewModal({ visible, bookingId, targetName, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function addPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setPhotos((prev) => [...prev, `data:image/jpeg;base64,${res.assets[0].base64}`]);
  }

  async function submit() {
    setSubmitting(true);
    try {
      await api(`/bookings/${bookingId}/review`, {
        method: "POST",
        body: { rating, comment: comment.trim() || undefined, photos },
      });
      onSubmitted?.();
      onClose();
      setComment(""); setPhotos([]); setRating(5);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} testID="review-cancel">
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Leave a review</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.forWho}>How was your experience with {targetName}?</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setRating(s)}
                  hitSlop={6}
                  testID={`review-star-${s}`}
                >
                  <Ionicons
                    name={s <= rating ? "star" : "star-outline"}
                    size={44}
                    color={colors.accent}
                  />
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Comment (optional)</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Share the details of your experience"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              style={styles.textarea}
              testID="review-comment"
            />

            <Text style={styles.label}>Photos (optional)</Text>
            <View style={styles.photoGrid}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoBox}>
                  <Image source={{ uri: p }} style={styles.photoImg} />
                  <Pressable
                    style={styles.rm}
                    onPress={() => setPhotos((prev) => prev.filter((_, ix) => ix !== i))}
                    testID={`review-rm-photo-${i}`}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.photoAdd} onPress={addPhoto} testID="review-add-photo">
                <Ionicons name="camera" size={26} color={colors.text} />
                <Text style={styles.photoAddText}>Add</Text>
              </Pressable>
            </View>

            <Button
              title="Submit review"
              onPress={submit}
              loading={submitting}
              testID="review-submit"
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text },
  cancel: { fontSize: font.base, color: colors.brand, fontWeight: weight.medium, width: 60 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  forWho: { fontSize: font.lg, color: colors.text, textAlign: "center", lineHeight: 24, marginBottom: spacing.lg },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginBottom: spacing.xl },
  label: {
    fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium,
    textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm,
  },
  textarea: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
    borderRadius: radius.md, padding: spacing.lg, fontSize: font.base, color: colors.text,
    minHeight: 100, textAlignVertical: "top",
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoBox: { width: 80, height: 80, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  photoImg: { width: "100%", height: "100%" },
  rm: {
    position: "absolute", top: 4, right: 4, width: 22, height: 22,
    borderRadius: 11, backgroundColor: colors.error, alignItems: "center", justifyContent: "center",
  },
  photoAdd: {
    width: 80, height: 80, borderRadius: radius.md, borderWidth: 2, borderStyle: "dashed",
    borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", gap: 2,
  },
  photoAddText: { fontSize: font.sm, fontWeight: weight.medium, color: colors.text },
});
