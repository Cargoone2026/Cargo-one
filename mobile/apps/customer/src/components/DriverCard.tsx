import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Phone, Star } from "lucide-react-native";
import { colors, radius, typography } from "../theme";

export function DriverAvatar({ name, photo, size = 44 }: { name: string; photo?: string | null; size?: number }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (photo) return <Image source={{ uri: photo }} style={[dim, { backgroundColor: colors.border }]} testID="driver-avatar-photo" />;
  return (
    <View style={[dim, styles.initial]} testID="driver-avatar-initial">
      <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{(name || "D").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function DriverCard({
  name, photo, rating, jobs, phone,
}: { name: string; photo?: string | null; rating?: number | null; jobs?: number; phone?: string | null }) {
  return (
    <View style={styles.card} testID="driver-card">
      <Text style={typography.micro}>YOUR DRIVER</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
        <DriverAvatar name={name} photo={photo} />
        <View style={{ flex: 1 }}>
          <Text style={typography.cardTitle} testID="driver-card-name">{name}</Text>
          {rating != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Star size={12} color={colors.accent} fill={colors.accent} />
              <Text style={typography.small} testID="driver-card-rating">
                {Number(rating).toFixed(1)} · {jobs ?? 0} jobs
              </Text>
            </View>
          ) : null}
        </View>
        {phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} testID="driver-call" hitSlop={8} style={styles.callBtn}>
            <Phone size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  initial: { backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.success, alignItems: "center", justifyContent: "center",
  },
});
