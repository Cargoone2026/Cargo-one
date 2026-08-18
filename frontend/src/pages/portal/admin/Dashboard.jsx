import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Car,
  Package,
  Activity,
  PoundSterling,
  CheckCircle2,
  AlertCircle,
  Clipboard,
  Tags,
  Inbox,
  ChevronRight,
  Search,
  ShieldCheck,
  BarChart3,
  Radar,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GlobalSearchModal } from "@/components/ui-portal/GlobalSearchModal";
import { CancellationInsightsCard } from "@/components/ui-portal/CancellationInsightsCard";
import { RebookAnalyticsCard } from "@/components/ui-portal/RebookAnalyticsCard";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api("/admin/stats").catch(() => ({}));
      setStats(s || {});
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-dashboard">
      <header className="bg-[#111111] px-4 pt-6 pb-6 md:px-8">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-bold tracking-tight text-white">
              Admin Console
            </h1>
            <p className="mt-0.5 text-[14px] text-white/60">
              Welcome, {user?.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            data-testid="admin-search-open"
            aria-label="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#D62828] text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] space-y-3 px-4 pt-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Metric label="Customers" value={stats.customers ?? 0} Icon={Users} color="#2563EB" />
          <Metric label="Drivers" value={stats.drivers ?? 0} Icon={Car} color="#FF6A00" />
          <Metric label="Total Jobs" value={stats.total_jobs ?? 0} Icon={Package} color="#111111" />
          <Metric label="Active Jobs" value={stats.active_jobs ?? 0} Icon={Activity} color="#D62828" />
          <Metric
            label="Revenue (GBP)"
            value={`£${Number(stats.revenue_gbp ?? 0).toFixed(2)}`}
            Icon={PoundSterling}
            color="#16A34A"
          />
          <Metric
            label="Paid Bookings"
            value={stats.paid_bookings ?? 0}
            Icon={CheckCircle2}
            color="#16A34A"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CancellationInsightsCard weeks={8} />
          <RebookAnalyticsCard days={30} windowHours={24} />
        </div>

        <section className="mt-3 space-y-2">
          <ActionRow
            Icon={AlertCircle}
            iconBg="#FEE2E2"
            iconColor="#D62828"
            title="Pending driver approvals"
            subtitle={`${stats.pending_drivers ?? 0} driver${
              stats.pending_drivers === 1 ? "" : "s"
            } awaiting verification`}
            href="/admin/drivers"
            testID="admin-pending-approvals"
          />
          <ActionRow
            Icon={Clipboard}
            iconBg="#FFF7ED"
            iconColor="#FF6A00"
            title="All jobs"
            subtitle="Review and moderate marketplace jobs"
            href="/admin/jobs"
            testID="admin-all-jobs"
          />
          <ActionRow
            Icon={Users}
            iconBg="#DBEAFE"
            iconColor="#2563EB"
            title="Manage users"
            subtitle="Search, suspend, and view customer accounts"
            href="/admin/users"
            testID="admin-users-manage"
          />
          <ActionRow
            Icon={Tags}
            iconBg="#F0FDF4"
            iconColor="#16A34A"
            title="Booking Fee Bands"
            subtitle="Configure Cargo One's fee tiers by driver charge"
            href="/admin/deposit-bands"
            testID="admin-deposit-bands"
          />
          <ActionRow
            Icon={BarChart3}
            iconBg="#F3E8FF"
            iconColor="#7C3AED"
            title="Analytics"
            subtitle="KPIs, top categories, top drivers, revenue"
            href="/admin/analytics"
            testID="admin-analytics-link"
          />
          <ActionRow
            Icon={Radar}
            iconBg="#FEE2E2"
            iconColor="#D62828"
            title="ASAP Dispatch Monitor"
            subtitle="Live queue, radius expansion, per-attempt logs"
            href="/admin/dispatch"
            testID="admin-dispatch-link"
          />
          <ActionRow
            Icon={Inbox}
            iconBg="#F3F4F6"
            iconColor="#111111"
            title="Operational queues"
            subtitle="Contact messages, newsletter subscribers"
            href="/admin/queues"
            testID="admin-queues-link"
          />
        </section>

        {loading && (
          <p className="pt-2 text-center text-[12px] text-[#6B7280]">
            Refreshing…
          </p>
        )}
      </div>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope="all"
        placeholder="Search users, jobs, categories…"
      />
    </div>
  );
}

function Metric({ label, value, Icon, color }) {
  return (
    <div
      className="rounded-[12px] border border-[#E5E7EB] bg-white p-4"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center gap-1.5 text-[13px] text-[#6B7280]">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-[22px] font-bold tracking-tight text-[#111111]">{value}</p>
    </div>
  );
}

function ActionRow({ Icon, iconBg, iconColor, title, subtitle, href, testID }) {
  return (
    <Link
      to={href}
      data-testid={testID}
      className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-[#111111]">{title}</p>
        <p className="text-[13px] text-[#6B7280]">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
    </Link>
  );
}
