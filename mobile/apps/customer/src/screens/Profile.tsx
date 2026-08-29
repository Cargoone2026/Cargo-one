/**
 * ProfileScreen — 1:1 port of frontend/src/pages/portal/customer/Profile.jsx.
 *
 * Header card matches the web verbatim:
 *   • Avatar with a red camera FAB in the bottom-right (tap → expo-image-picker)
 *   • Name + email
 *   • Star badge with rating + shipments count
 * Followed by the Account / Support / Legal / Danger MenuRow groups the
 * previous native version already had, PLUS the two web-only rows that were
 * missing here: "Edit profile" and "Change password".
 */
import React, { useCallback, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Cookie,
  FileText,
  HelpCircle,
  Info,
  Key,
  Lock,
  LogOut,
  MapPin,
  Settings as SettingsIcon,
  Shield,
  Star,
  Trash2,
  User as UserIcon,
} from "lucide-react-native";
import { CustomerAPI } from "@cargoone/core";
import type { RootStackParamList } from "../App";
import { useAuth } from "../AuthContext";
import { useShellMenu } from "../components/AppShell";
import { colors, radius, typography } from "../theme";
import { MenuRow, Page, PageHeader } from "../ui";

type P = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: P) {
  const { user, logout, refresh } = useAuth();
  const { openDrawer, showMenu } = useShellMenu();
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);

  const doLogout = () =>
    Alert.alert("Log out", "Sign out of Cargo One on this device?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  const pickPhoto = useCallback(async () => {
    if (uploadingRef.current) return;
    // Request permission (system will remember the answer).
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo permission needed", "Please allow photo library access to update your profile picture.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    uploadingRef.current = true;
    setUploading(true);
    try {
      const b64 = `data:image/jpeg;base64,${res.assets[0].base64}`;
      await CustomerAPI.uploadProfilePhoto(b64);
      await refresh();
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Could not upload photo. Please try a different image.");
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }, [refresh]);

  const rating = Number(user?.rating || 0).toFixed(1);
  const shipments = user?.total_jobs ?? 0;
  const initial = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  const addressLine =
    user?.address_line1 || user?.town || user?.postcode
      ? [
          user?.address_line1,
          user?.address_line2,
          [user?.town, user?.county].filter(Boolean).join(", "),
          user?.postcode,
          user?.country,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <Page testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <PageHeader large title="Profile" showMenu={showMenu} onMenuPress={openDrawer} />

        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {/* Identity card — mirrors web centered card with photo, name,
              email, star + shipments pill. */}
          <View style={styles.identity} testID="profile-header">
            <View style={styles.avatarWrap}>
              {user?.profile_photo ? (
                <Image source={{ uri: user.profile_photo }} style={styles.avatar} testID="profile-photo-img" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <Pressable
                onPress={pickPhoto}
                disabled={uploading}
                style={[styles.cameraBtn, uploading && { opacity: 0.6 }]}
                testID="profile-photo-upload-btn"
                accessibilityRole="button"
                accessibilityLabel="Upload profile photo"
              >
                <Camera size={16} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text style={[typography.h2, { marginTop: 12, textAlign: "center" }]} testID="profile-name">
              {user?.name || "Cargo One customer"}
            </Text>
            <Text style={[typography.caption, { marginTop: 2, textAlign: "center" }]} testID="profile-email">
              {user?.email}
            </Text>
            <View style={styles.ratingPill} testID="profile-rating-pill">
              <Star size={12} color="#E55E00" fill="#E55E00" />
              <Text style={styles.ratingText}>
                {rating} · {shipments} shipments
              </Text>
            </View>
            {uploading ? (
              <Text style={[typography.small, { marginTop: 6 }]}>Uploading…</Text>
            ) : null}
          </View>

          {/* Edit profile + Change password — the two web rows that were
              missing on native. */}
          <Section>
            <MenuRow
              label="Edit profile"
              subtitle="Name, phone, address"
              leftIcon={UserIcon}
              onPress={() => navigation.navigate("EditProfile")}
              testID="profile-edit"
            />
            <MenuRow
              label="Change password"
              subtitle="Requires current password"
              leftIcon={Lock}
              onPress={() => navigation.navigate("ChangePassword")}
              testID="profile-change-password"
            />
          </Section>

          {/* Saved address summary — parity with web read-only block. */}
          {addressLine ? (
            <View style={styles.addressCard} testID="profile-address-summary">
              <View style={styles.addressIcon}>
                <MapPin size={18} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.micro}>SAVED ADDRESS</Text>
                <Text style={[typography.body, { marginTop: 4 }]}>{addressLine}</Text>
              </View>
            </View>
          ) : null}

          <Section title="Account">
            <MenuRow
              label="Passkeys (Face ID / Touch ID)"
              leftIcon={Key}
              onPress={() => navigation.navigate("Passkeys")}
              testID="profile-passkeys"
            />
            <MenuRow
              label="Settings"
              subtitle="Preferences, legal, account"
              leftIcon={SettingsIcon}
              onPress={() => navigation.navigate("Settings")}
              testID="profile-settings"
            />
          </Section>

          <Section title="Support">
            <MenuRow
              label="Help & Support"
              leftIcon={HelpCircle}
              onPress={() => navigation.navigate("Support")}
              testID="profile-support"
            />
            <MenuRow
              label="About Cargo One"
              leftIcon={Info}
              onPress={() => navigation.navigate("About")}
              testID="profile-about"
            />
          </Section>

          <Section title="Legal">
            <MenuRow
              label="Terms & Conditions"
              leftIcon={FileText}
              onPress={() => navigation.navigate("Legal", { slug: "terms" })}
              testID="profile-terms"
            />
            <MenuRow
              label="Privacy Policy"
              leftIcon={Shield}
              onPress={() => navigation.navigate("Legal", { slug: "privacy" })}
              testID="profile-privacy"
            />
            <MenuRow
              label="Cookie Policy"
              leftIcon={Cookie}
              onPress={() => navigation.navigate("Legal", { slug: "cookies" })}
              testID="profile-cookies"
            />
          </Section>

          <Section>
            <MenuRow
              label="Delete account"
              leftIcon={Trash2}
              onPress={() => navigation.navigate("DeleteAccount")}
              testID="profile-delete"
              danger
            />
            <MenuRow label="Log out" leftIcon={LogOut} onPress={doLogout} testID="profile-logout" />
          </Section>
        </View>
      </ScrollView>
    </Page>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? <Text style={typography.micro}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = {
  identity: {
    alignItems: "center" as const,
    padding: 20,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  avatarWrap: { position: "relative" as const, width: 96, height: 96 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    backgroundColor: "#111111",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  avatarInitial: { color: "#FFFFFF", fontSize: 32, fontWeight: "800" as const },
  cameraBtn: {
    position: "absolute" as const,
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  ratingPill: {
    marginTop: 8,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#E55E00",
  },
  addressCard: {
    flexDirection: "row" as const,
    gap: 12,
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.bgSecondary,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden" as const,
  },
};
