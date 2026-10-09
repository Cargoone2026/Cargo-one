/**
 * BookingPodTab — Proof-of-Delivery viewer rendered inside BookingDetail
 * when `tab === "pod"`. Replaces the previous placeholder that only
 * displayed a caption with no image or signature content.
 *
 * Uses `CustomerAPI.getPod` (added in Phase 3 to packages/core/src/endpoints.ts).
 * Backend `GET /bookings/{id}/pod` returns `null` when the driver has
 * not yet uploaded a POD — we treat null as the empty state. POD
 * `photos` and `signature` can be base64 payloads or URLs: we handle
 * both via `toImageUri()`.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MapPin, Package as PackageIcon, PenLine } from "lucide-react-native";
import { CustomerAPI, POD } from "@cargoone/core";
import { colors, radius, typography } from "../theme";

export function BookingPodTab({ bookingId }: { bookingId: string }) {
  const [pod, setPod] = useState<POD | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await CustomerAPI.getPod(bookingId);
      setPod(data);
      setErrorMsg(null);
    } catch {
      setErrorMsg("Couldn't load POD. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.card} testID="tab-pod-loading">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.card} testID="tab-pod-error">
        <Text style={typography.cardTitle}>Couldn't load POD</Text>
        <Text style={[typography.caption, { marginTop: 6 }]}>{errorMsg}</Text>
      </View>
    );
  }

  if (!pod) {
    return (
      <View style={styles.card} testID="tab-pod-empty">
        <Text style={typography.cardTitle}>Proof of Delivery</Text>
        <Text style={[typography.caption, { marginTop: 6 }]}>
          POD photos and signature will appear here once the driver marks
          the job delivered.
        </Text>
      </View>
    );
  }

  const photos = Array.isArray(pod.photos) ? pod.photos.filter(Boolean) : [];
  const sigUri = pod.signature ? toImageUri(pod.signature) : null;
  const hasGps = typeof pod.lat === "number" && typeof pod.lng === "number";

  return (
    <View style={styles.wrap} testID="tab-pod">
      <View style={styles.card}>
        <View style={styles.headRow}>
          <View style={styles.iconBadge}>
            <PackageIcon size={14} color={colors.success} />
          </View>
          <Text style={typography.cardTitle}>Proof of Delivery</Text>
        </View>
        {pod.created_at ? (
          <Text style={[typography.small, { marginTop: 4 }]} testID="tab-pod-timestamp">
            Delivered {formatWhen(pod.created_at)}
          </Text>
        ) : null}
      </View>

      {photos.length > 0 ? (
        <View style={styles.card}>
          <Text style={typography.cardTitle}>Photos ({photos.length})</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ gap: 8 }}
            testID="tab-pod-photos"
          >
            {photos.map((p, i) => {
              const uri = toImageUri(p);
              return uri ? (
                <Image
                  key={i}
                  source={{ uri }}
                  style={styles.photo}
                  testID={`tab-pod-photo-${i}`}
                />
              ) : null;
            })}
          </ScrollView>
        </View>
      ) : null}

      {sigUri ? (
        <View style={styles.card}>
          <View style={styles.headRow}>
            <View style={styles.iconBadge}>
              <PenLine size={14} color={colors.success} />
            </View>
            <Text style={typography.cardTitle}>Signature</Text>
          </View>
          <Image
            source={{ uri: sigUri }}
            style={styles.signature}
            resizeMode="contain"
            testID="tab-pod-signature"
          />
        </View>
      ) : null}

      {pod.notes ? (
        <View style={styles.card}>
          <Text style={typography.cardTitle}>Notes from the driver</Text>
          <Text style={[typography.body, { marginTop: 6 }]} testID="tab-pod-notes">
            {pod.notes}
          </Text>
        </View>
      ) : null}

      {hasGps ? (
        <Pressable
          onPress={() => openInMaps(pod.lat as number, pod.lng as number)}
          style={styles.card}
          testID="tab-pod-gps"
        >
          <View style={styles.headRow}>
            <View style={styles.iconBadge}>
              <MapPin size={14} color={colors.success} />
            </View>
            <Text style={typography.cardTitle}>Delivery location</Text>
          </View>
          <Text style={[typography.caption, { marginTop: 6 }]}>
            {(pod.lat as number).toFixed(5)}, {(pod.lng as number).toFixed(5)} — tap to open in Maps
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** base64 → data URI, http(s) URL → passthrough, else null. */
function toImageUri(s: string): string | null {
  if (!s || typeof s !== "string") return null;
  if (s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  // Assume base64 image payload (jpeg default — most POD photos are jpeg).
  return `data:image/jpeg;base64,${s}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function openInMaps(lat: number, lng: number) {
  const url = `https://maps.apple.com/?ll=${lat},${lng}&q=Delivery%20location`;
  Linking.openURL(url).catch(() => {
    // Fallback — Google Maps works on both iOS and Android.
    Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`).catch(() => {});
  });
}

const styles = {
  wrap: { gap: 12 },
  card: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  headRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  photo: {
    width: 160,
    height: 160,
    borderRadius: radius.base,
    backgroundColor: colors.bgSecondary,
  },
  signature: {
    marginTop: 12,
    width: "100%" as const,
    height: 140,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: "#FFFFFF",
  },
} as const;
