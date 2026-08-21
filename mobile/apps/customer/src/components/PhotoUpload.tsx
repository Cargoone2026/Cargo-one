/**
 * PhotoUpload — native equivalent of frontend
 * components/ui-portal/PhotoUpload.jsx.
 *
 * Presents up to `max` pickup photos as a grid of thumbnails plus a
 * dashed "Add" tile. Uses expo-image-picker to launch the system
 * camera or library, then base64-encodes each photo into a
 * `data:image/jpeg;base64,…` string — exactly the shape the backend
 * job payload expects (see server.py line 2763, "photos": [...]).
 *
 * Preserves the web workflow: photos are just part of the job payload,
 * not a separate upload step.
 */
import React from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { colors, radius, typography } from "../theme";

export function PhotoUpload({
  photos,
  onChange,
  max = 4,
  testID,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  max?: number;
  testID?: string;
}) {
  async function pickFrom(kind: "camera" | "library") {
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
    const next = [...photos];
    for (const asset of res.assets) {
      if (next.length >= max) break;
      if (!asset.base64) continue;
      next.push(`data:image/jpeg;base64,${asset.base64}`);
    }
    onChange(next);
  }

  function askSource() {
    if (photos.length >= max) return;
    Alert.alert("Add photo", "Where should we get it from?", [
      { text: "Take photo", onPress: () => pickFrom("camera") },
      { text: "Choose from library", onPress: () => pickFrom("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View testID={testID} style={{ gap: 8 }}>
      <Text style={typography.micro}>Pickup photos (optional, up to {max})</Text>
      <View style={styles.grid}>
        {photos.map((p, i) => (
          <View key={i} style={styles.tile}>
            <Image source={{ uri: p }} style={styles.thumb} />
            <Pressable
              onPress={() => onChange(photos.filter((_, k) => k !== i))}
              testID={`photo-remove-${i}`}
              style={styles.removeBtn}
              hitSlop={6}
            >
              <X size={12} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
        {photos.length < max ? (
          <Pressable
            onPress={askSource}
            testID="photo-add"
            style={[styles.tile, styles.addTile]}
          >
            <Camera size={22} color={colors.inkFaint} />
            <Text style={{ marginTop: 6, fontSize: 12, color: colors.inkMuted }}>Add</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    width: 84,
    height: 84,
    borderRadius: radius.base,
    overflow: "hidden",
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
});
