import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

type Overview = {
  marketplace: {
    jobs_posted: number; jobs_completed: number; jobs_cancelled: number; jobs_active: number;
    completion_rate: number; customer_revenue_total: number; driver_revenue_total: number;
    platform_fee_revenue: number; bookings_total: number;
  };
  categories: {
    top_requested: { key: string; name: string; count: number }[];
    top_vehicles:  { key: string; name: string; count: number }[];
    top_capabilities: { key: string; name: string; count: number }[];
    top_routes: { from: string; to: string; count: number }[];
    revenue_by_category: { key: string; name: string; count: number; customer_total: number; booking_fee: number }[];
    revenue_by_vehicle:  { key: string; name: string; count: number; customer_total: number; booking_fee: number }[];
  };
  drivers: {
    total: number; verified: number; verification_rate: number;
    top_rated: { id: string; name: string; rating: number; total_jobs: number }[];
    highest_earning: { id: string; name: string; earnings: number; jobs: number }[];
    most_active: { id: string; name: string; jobs: number }[];
  };
  customers: {
    total: number; repeat: number;
    most_active: { id: string; name: string; jobs: number }[];
    avg_customer_rating: number | null;
  };
  operational: {
    avg_winning_bid: number; avg_delivery_distance_miles: number;
    avg_delivery_time_minutes: number; avg_booking_value: number;
  };
};

export default function AdminAnalytics() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const d: Overview = await api("/admin/analytics/overview");
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const m = data.marketplace;
  const c = data.categories;
  const drv = data.drivers;
  const cus = data.customers;
  const op = data.operational;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.sub}>Marketplace performance at a glance.</Text>
        </View>

        {/* Marketplace KPIs */}
        <SectionHead icon="trending-up" title="Marketplace" />
        <View style={styles.kpiGrid}>
          <Kpi label="Jobs Posted" value={String(m.jobs_posted)} icon="albums" />
          <Kpi label="Completed" value={String(m.jobs_completed)} icon="checkmark-circle" tone="success" />
          <Kpi label="Active" value={String(m.jobs_active)} icon="time" tone="warn" />
          <Kpi label="Cancelled" value={String(m.jobs_cancelled)} icon="close-circle" tone="danger" />
          <Kpi label="Completion rate" value={`${m.completion_rate}%`} icon="pie-chart" />
          <Kpi label="Bookings" value={String(m.bookings_total)} icon="cube" />
        </View>

        {/* Revenue */}
        <SectionHead icon="cash" title="Revenue" />
        <View style={styles.kpiGrid}>
          <Kpi label="Platform fee revenue" value={`£${m.platform_fee_revenue.toFixed(2)}`} icon="card" highlight />
          <Kpi label="Customer total" value={`£${m.customer_revenue_total.toFixed(2)}`} icon="cash" />
          <Kpi label="Driver charges" value={`£${m.driver_revenue_total.toFixed(2)}`} icon="wallet" />
          <Kpi label="Avg booking value" value={`£${op.avg_booking_value.toFixed(2)}`} icon="bar-chart" />
        </View>

        <TopList title="Revenue by category" items={c.revenue_by_category.slice(0, 6).map(r => ({ label: r.name, sub: `${r.count} jobs`, value: `£${r.customer_total.toFixed(0)}` }))} />
        <TopList title="Revenue by vehicle type" items={c.revenue_by_vehicle.slice(0, 6).map(r => ({ label: r.name, sub: `${r.count} jobs`, value: `£${r.customer_total.toFixed(0)}` }))} />

        {/* Categories */}
        <SectionHead icon="apps" title="Categories & Vehicles" />
        <TopList title="Most requested categories" items={c.top_requested.map(r => ({ label: r.name, value: String(r.count) }))} />
        <TopList title="Most requested vehicle types" items={c.top_vehicles.map(r => ({ label: r.name, value: String(r.count) }))} />
        <TopList title="Most requested capabilities" items={c.top_capabilities.map(r => ({ label: r.name, value: String(r.count) }))} />
        <TopList title="Most popular routes" items={c.top_routes.map(r => ({ label: `${r.from} → ${r.to}`, value: String(r.count) }))} />

        {/* Drivers */}
        <SectionHead icon="car-sport" title="Drivers" />
        <View style={styles.kpiGrid}>
          <Kpi label="Total drivers" value={String(drv.total)} icon="people" />
          <Kpi label="Verified" value={`${drv.verified} (${drv.verification_rate}%)`} icon="shield-checkmark" tone="success" />
        </View>
        <TopList title="Top rated drivers" items={drv.top_rated.map(r => ({ label: r.name, sub: `${r.total_jobs} jobs`, value: `${r.rating.toFixed(1)}★` }))} />
        <TopList title="Highest earning drivers" items={drv.highest_earning.map(r => ({ label: r.name, sub: `${r.jobs} jobs`, value: `£${r.earnings.toFixed(0)}` }))} />
        <TopList title="Most active drivers" items={drv.most_active.map(r => ({ label: r.name, value: String(r.jobs) }))} />

        {/* Customers */}
        <SectionHead icon="person-circle" title="Customers" />
        <View style={styles.kpiGrid}>
          <Kpi label="Total customers" value={String(cus.total)} icon="people" />
          <Kpi label="Repeat customers" value={String(cus.repeat)} icon="repeat" />
          <Kpi label="Avg. customer rating" value={cus.avg_customer_rating != null ? `${cus.avg_customer_rating}★` : "—"} icon="star" />
        </View>
        <TopList title="Most active customers" items={cus.most_active.map(r => ({ label: r.name, value: String(r.jobs) }))} />

        {/* Operational */}
        <SectionHead icon="speedometer" title="Operational" />
        <View style={styles.kpiGrid}>
          <Kpi label="Avg winning bid" value={`£${op.avg_winning_bid.toFixed(2)}`} icon="trending-up" />
          <Kpi label="Avg distance" value={`${op.avg_delivery_distance_miles} mi`} icon="navigate" />
          <Kpi label="Avg journey time" value={`${op.avg_delivery_time_minutes} min`} icon="time" />
          <Kpi label="Avg booking value" value={`£${op.avg_booking_value.toFixed(2)}`} icon="card" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHead({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Kpi({ label, value, icon, tone, highlight }: { label: string; value: string; icon: any; tone?: "success" | "warn" | "danger"; highlight?: boolean }) {
  const bg = highlight ? "#0B0B0F" : "#fff";
  const fg = highlight ? "#fff" : colors.text;
  const accent = tone === "success" ? colors.success : tone === "warn" ? "#F59E0B" : tone === "danger" ? colors.error : colors.brand;
  return (
    <View style={[styles.kpi, { backgroundColor: bg }]}>
      <View style={[styles.kpiIcon, { backgroundColor: highlight ? "rgba(255,255,255,0.1)" : colors.brandLight }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.kpiValue, { color: fg }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: highlight ? "rgba(255,255,255,0.65)" : colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function TopList({ title, items }: { title: string; items: { label: string; sub?: string; value: string }[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.listCard}>
      <Text style={styles.listTitle}>{title}</Text>
      <View style={{ gap: 8 }}>
        {items.slice(0, 10).map((r, idx) => (
          <View key={`${title}-${idx}`} style={styles.listRow}>
            <View style={styles.listBullet}><Text style={styles.listBulletText}>{idx + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listLabel}>{r.label}</Text>
              {r.sub ? <Text style={styles.listSub}>{r.sub}</Text> : null}
            </View>
            <Text style={styles.listValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  header: { marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: weight.bold, color: colors.text },
  sub: { color: colors.textSecondary, marginTop: spacing.xs },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.lg, fontWeight: weight.bold, color: colors.text, letterSpacing: -0.3 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpi: { flexBasis: 180, flexGrow: 1, minWidth: 160, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  kpiValue: { fontSize: 22, fontWeight: weight.bold, letterSpacing: -0.5 },
  kpiLabel: { fontSize: font.sm, fontWeight: weight.medium },

  listCard: { backgroundColor: "#fff", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  listTitle: { fontSize: font.base, fontWeight: weight.bold, color: colors.text, marginBottom: spacing.sm },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 4 },
  listBullet: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  listBulletText: { color: colors.brand, fontWeight: weight.bold, fontSize: 11 },
  listLabel: { color: colors.text, fontSize: font.base, fontWeight: weight.medium },
  listSub: { color: colors.textSecondary, fontSize: font.sm },
  listValue: { color: colors.text, fontWeight: weight.bold, fontSize: font.base },
});
