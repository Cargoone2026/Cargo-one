/**
 * NotificationsScreen — placeholder pending P2-b implementation.
 *
 * The Home dashboard needs a valid navigation target for the bell
 * icon in its header and the notification chime hook already polls
 * `/notifications`. The full inbox UI (list + mark-read + deep-links)
 * ships in P2-b Driver Notifications. For P0-c the screen renders a
 * short "Coming soon" panel so navigation from Home does not crash.
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Bell, ChevronLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, typography } from "../theme";
import { Page, PrimaryButton } from "../ui";

export function NotificationsScreen() {
  const nav = useNavigation<any>();
  return (
    <Page testID="driver-notifications-placeholder">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ChevronLeft
            size={26}
            color={colors.ink}
            strokeWidth={2}
            onPress={() => nav.goBack()}
          />
          <Text style={typography.h1Large}>Notifications</Text>
        </View>
        <View
          style={{
            padding: 24,
            gap: 12,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bg,
            alignItems: "center",
          }}
        >
          <Bell size={36} color={colors.brand} strokeWidth={2} />
          <Text style={[typography.body, { textAlign: "center", lineHeight: 22 }]}>
            The full notification inbox is coming next. Push banners already work — you'll get one
            for new messages, job offers and booking updates.
          </Text>
          <PrimaryButton
            title="Back to Home"
            onPress={() => nav.goBack()}
            testID="notifications-back-home"
          />
        </View>
      </ScrollView>
    </Page>
  );
}
