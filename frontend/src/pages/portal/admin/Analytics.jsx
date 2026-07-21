import React, { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  PoundSterling,
  Boxes,
  Car,
  User as UserIcon,
  Gauge,
  CheckCircle2,
  Clock,
  XCircle,
  PieChart,
  Package,
  Star,
  Users,
  Repeat,
  BarChart3,
  Wallet,
  CreditCard,
  Navigation,
} from "lucide-react";
import { api } from "@/lib/api";

export default function AdminAnalytics() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const res = await api("/admin/analytics/overview");
      setD(res);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (loading || !d) {
    return (
      <div className="min-h-screen bg-white" data-testid="admin-analytics">
        <p className="p-8 text-[13px] text-[#6B7280]">Loading analytics…</p>
      </div>
    );
  }

  const m = d.marketplace || {};
  const c = d.categories || {};
  const drv = d.drivers || {};
  const cus = d.customers || {};
  const op = d.operational || {};

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-analytics">
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
        <header className="mb-4">
          <h1 className="text-[28px] font-bold text-[#111111]">Analytics</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Marketplace performance at a glance.
          </p>
        </header>

        <SectionHead Icon={TrendingUp} title="Marketplace" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Kpi label="Jobs Posted" value={String(m.jobs_posted ?? 0)} Icon={Boxes} />
          <Kpi label="Completed" value={String(m.jobs_completed ?? 0)} Icon={CheckCircle2} tone="success" />
          <Kpi label="Active" value={String(m.jobs_active ?? 0)} Icon={Clock} tone="warn" />
          <Kpi label="Cancelled" value={String(m.jobs_cancelled ?? 0)} Icon={XCircle} tone="danger" />
          <Kpi label="Completion rate" value={`${m.completion_rate ?? 0}%`} Icon={PieChart} />
          <Kpi label="Bookings" value={String(m.bookings_total ?? 0)} Icon={Package} />
        </div>

        <SectionHead Icon={PoundSterling} title="Revenue" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Platform fee revenue"
            value={`£${Number(m.platform_fee_revenue ?? 0).toFixed(2)}`}
            Icon={CreditCard}
            highlight
          />
          <Kpi label="Customer total" value={`£${Number(m.customer_revenue_total ?? 0).toFixed(2)}`} Icon={PoundSterling} />
          <Kpi label="Driver charges" value={`£${Number(m.driver_revenue_total ?? 0).toFixed(2)}`} Icon={Wallet} />
          <Kpi label="Avg booking value" value={`£${Number(op.avg_booking_value ?? 0).toFixed(2)}`} Icon={BarChart3} />
        </div>

        <TopList
          title="Revenue by category"
          items={(c.revenue_by_category || []).slice(0, 6).map((r) => ({
            label: r.name,
            sub: `${r.count} jobs`,
            value: `£${Number(r.customer_total).toFixed(0)}`,
          }))}
        />
        <TopList
          title="Revenue by vehicle type"
          items={(c.revenue_by_vehicle || []).slice(0, 6).map((r) => ({
            label: r.name,
            sub: `${r.count} jobs`,
            value: `£${Number(r.customer_total).toFixed(0)}`,
          }))}
        />

        <SectionHead Icon={Boxes} title="Categories & Vehicles" />
        <TopList
          title="Most requested categories"
          items={(c.top_requested || []).map((r) => ({ label: r.name, value: String(r.count) }))}
        />
        <TopList
          title="Most requested vehicle types"
          items={(c.top_vehicles || []).map((r) => ({ label: r.name, value: String(r.count) }))}
        />
        <TopList
          title="Most requested capabilities"
          items={(c.top_capabilities || []).map((r) => ({ label: r.name, value: String(r.count) }))}
        />
        <TopList
          title="Most popular routes"
          items={(c.top_routes || []).map((r) => ({
            label: `${r.from} → ${r.to}`,
            value: String(r.count),
          }))}
        />

        <SectionHead Icon={Car} title="Drivers" />
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Total drivers" value={String(drv.total ?? 0)} Icon={Users} />
          <Kpi
            label="Verified"
            value={`${drv.verified ?? 0} (${drv.verification_rate ?? 0}%)`}
            Icon={CheckCircle2}
            tone="success"
          />
        </div>
        <TopList
          title="Top rated drivers"
          items={(drv.top_rated || []).map((r) => ({
            label: r.name,
            sub: `${r.total_jobs} jobs`,
            value: `${Number(r.rating).toFixed(1)}★`,
          }))}
        />
        <TopList
          title="Highest earning drivers"
          items={(drv.highest_earning || []).map((r) => ({
            label: r.name,
            sub: `${r.jobs} jobs`,
            value: `£${Number(r.earnings).toFixed(0)}`,
          }))}
        />
        <TopList
          title="Most active drivers"
          items={(drv.most_active || []).map((r) => ({ label: r.name, value: String(r.jobs) }))}
        />

        <SectionHead Icon={UserIcon} title="Customers" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi label="Total customers" value={String(cus.total ?? 0)} Icon={Users} />
          <Kpi label="Repeat customers" value={String(cus.repeat ?? 0)} Icon={Repeat} />
          <Kpi
            label="Avg. customer rating"
            value={cus.avg_customer_rating != null ? `${cus.avg_customer_rating}★` : "—"}
            Icon={Star}
          />
        </div>
        <TopList
          title="Most active customers"
          items={(cus.most_active || []).map((r) => ({ label: r.name, value: String(r.jobs) }))}
        />

        <SectionHead Icon={Gauge} title="Operational" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Avg winning bid" value={`£${Number(op.avg_winning_bid ?? 0).toFixed(2)}`} Icon={TrendingUp} />
          <Kpi label="Avg distance" value={`${op.avg_delivery_distance_miles ?? 0} mi`} Icon={Navigation} />
          <Kpi label="Avg journey time" value={`${op.avg_delivery_time_minutes ?? 0} min`} Icon={Clock} />
          <Kpi label="Avg booking value" value={`£${Number(op.avg_booking_value ?? 0).toFixed(2)}`} Icon={CreditCard} />
        </div>
      </div>
    </div>
  );
}

function SectionHead({ Icon, title }) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-2">
      <Icon className="h-5 w-5 text-[#D62828]" />
      <h2 className="text-[18px] font-bold text-[#111111]">{title}</h2>
    </div>
  );
}
function Kpi({ label, value, Icon, tone, highlight }) {
  const bg = highlight ? "#0B0B0F" : "#fff";
  const fg = highlight ? "#fff" : "#111111";
  const accent =
    tone === "success"
      ? "#16A34A"
      : tone === "warn"
      ? "#F59E0B"
      : tone === "danger"
      ? "#DC2626"
      : "#D62828";
  return (
    <div
      className="rounded-[12px] border border-[#E5E7EB] p-3"
      style={{ backgroundColor: bg }}
    >
      <span
        className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: highlight ? "rgba(255,255,255,0.1)" : "#FEE2E2" }}
      >
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </span>
      <p className="text-[22px] font-bold tracking-tight" style={{ color: fg }}>
        {value}
      </p>
      <p
        className="text-[13px] font-medium"
        style={{ color: highlight ? "rgba(255,255,255,0.65)" : "#6B7280" }}
      >
        {label}
      </p>
    </div>
  );
}
function TopList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 rounded-[12px] border border-[#E5E7EB] bg-white p-4">
      <p className="mb-2 text-[14px] font-bold text-[#111111]">{title}</p>
      <ul className="space-y-1">
        {items.slice(0, 10).map((r, i) => (
          <li key={i} className="flex items-center gap-3 py-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FEE2E2] text-[11px] font-bold text-[#D62828]">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#111111]">{r.label}</p>
              {r.sub && <p className="text-[12px] text-[#6B7280]">{r.sub}</p>}
            </span>
            <span className="text-[14px] font-bold text-[#111111]">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
