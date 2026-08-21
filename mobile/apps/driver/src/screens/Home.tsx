/**
 * HomeScreen — driver dashboard. Uses the shared Cargo One primitives
 * and the same PageHeader / SearchPill / IconButton / BookingRow
 * patterns as the customer app. Consumes /driver/dashboard for the
 * summary card, /notifications for the bell badge, and /driver/asap-offers
 * for the live offers list.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, Search, Zap, Package, PoundSterling, Star } from "lucide-react-native";
import { DriverAPI, CustomerAPI, Job } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";
import { BookingRow, EmptyState, IconButton, Page, PageHeader, SearchPill, SectionTitle } from "../ui";
import { useShellMenu } from "../components/AppShell";
import type { RootStackParamList } from "../App";

export function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { openDrawer, showMenu } = useShellMenu();
  const [refreshing, setRefreshing] = useState(false);
  const [dash, setDash] = useState<any>({});
  const [offers, setOffers] = useState<Job[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [o, n] = await Promise.all([
        DriverAPI.asapOffers().catch(() => [] as Job[]),
        CustomerAPI.listNotifications().catch(() => [] as any[]),
      ]);
      setOffers(Array.isArray(o) ? o : []);
      const unread = (Array.isArray(n) ? n : []).filter((x: any) => !x.read_at && !x.read).length;
      setNotifUnread(unread);
      setDash({});
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = (user?.name || "").split(" ")[0] || "driver";

  return (
    <Page testID="driver-dashboard">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}>
        <PageHeader
          large
          showMenu={showMenu}
          onMenuPress={openDrawer}
          title={<Text style={typography.h1Large}>Hey {firstName}</Text>}
          subtitle="Drive. Deliver. Get paid."
          right={
            <>
              <IconButton onPress={() => null} accessibilityLabel="Search">
                <Search size={20} color={colors.ink} strokeWidth={2} />
              </IconButton>
              <IconButton onPress={() => null} accessibilityLabel="Notifications" badged={notifUnread > 0}>
                <Bell size={20} color={colors.ink} strokeWidth={2} />
              </IconButton>
            </>
          }
        />
        <View style={{ paddingHorizontal: 16, gap: 16, paddingBottom: 32 }}>
          <SearchPill placeholder="Search jobs, bookings, drivers…" onPress={() => null} />

          {/* Quick stats */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard Icon={Package} tint="#FEE2E2" iconColor={colors.brand} value={String(offers.length)} label="Live offers" />
            <StatCard Icon={PoundSterling} tint="#DCFCE7" iconColor={colors.success} value="£—" label="Today's earnings" />
          </View>

          {/* Live ASAP offers */}
          <SectionTitle
            right={
              <Text
                onPress={() => nav.navigate("AvailableJobs")}
                style={{ color: colors.brand, fontWeight: "600", fontSize: 14 }}
              >
                See all
              </Text>
            }
          >
            Live ASAP offers
          </SectionTitle>

          {offers.length === 0 ? (
            <EmptyState Icon={Zap} title="No live offers" body="New ASAP jobs will appear here in real time." />
          ) : (
            offers.slice(0, 5).map((j: any) => (
              <BookingRow
                key={j.id}
                title={j.title || "ASAP job"}
                status={j.status || "posted"}
                pickup={j.pickup_town}
                dropoff={j.dropoff_town}
                price={j.suggested_price ?? j.fixed_price ?? null}
                priceLabel="Est. earnings"
                onPress={() => nav.navigate("JobDetail", { jobId: j.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}

function StatCard({ Icon, tint, iconColor, value, label }: { Icon: any; tint: string; iconColor: string; value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.base,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        padding: 16,
        gap: 8,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: radius.base, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} color={iconColor} strokeWidth={2.2} />
      </View>
      <Text style={typography.h2}>{value}</Text>
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}
