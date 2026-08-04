import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Sparkles,
  UserCheck,
  Receipt,
  MessageCircle,
  Truck,
  Package,
  Flag,
} from "lucide-react";
import { api } from "@/lib/api";

const ICON_MAP = {
  sparkle: Sparkles,
  user_check: UserCheck,
  receipt: Receipt,
  chat: MessageCircle,
  truck: Truck,
  package: Package,
  flag: Flag,
  check: CheckCircle2,
};

/**
 * RecentActivity — compact timeline of booking milestones (booking created,
 * driver accepted, deposit received, driver messaged, en route, delivered,
 * completed). Data comes from GET /api/bookings/{id}/activity — a small
 * derived-view endpoint, no client-side timeline reconstruction.
 *
 * Rendered inside customer / driver BookingDetail. The Today / Yesterday /
 * Earlier groupings make a long booking history easy to scan at a glance
 * without becoming a wall of dates.
 */
export function RecentActivity({ bookingId, testIdPrefix = "recent-activity" }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api(`/bookings/${bookingId}/activity`);
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading) {
    return (
      <section
        className="rounded-[16px] border border-[#E5E7EB] bg-white p-4"
        data-testid={testIdPrefix}
      >
        <p className="text-[12px] text-[#6B7280]">Loading activity…</p>
      </section>
    );
  }
  if (!items || items.length === 0) {
    return null;
  }

  // Group by relative day so we can render "Today / Yesterday / Earlier"
  // section headings — matches the user's requested layout.
  const groups = groupByDay(items);

  return (
    <section
      className="rounded-[16px] border border-[#E5E7EB] bg-white p-4"
      data-testid={testIdPrefix}
    >
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
        <h3 className="text-[14px] font-bold text-[#111111]">
          Recent activity
        </h3>
      </div>
      <div className="mt-2 space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.6px] text-[#9CA3AF]">
              {g.label}
            </p>
            <ol className="space-y-2">
              {g.items.map((ev, i) => (
                <ActivityRow
                  key={`${ev.kind}-${ev.at || i}`}
                  ev={ev}
                  testId={`${testIdPrefix}-${ev.kind}`}
                />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityRow({ ev, testId }) {
  const Icon = ICON_MAP[ev.icon] || CheckCircle2;
  const time = ev.at
    ? new Date(ev.at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return (
    <li
      className="flex items-center gap-3 rounded-[10px] bg-[#F9FAFB] px-3 py-2"
      data-testid={testId}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DCFCE7]">
        <Icon className="h-4 w-4 text-[#16A34A]" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] text-[#111111]">
        {ev.label}
      </span>
      <span className="shrink-0 text-[11px] text-[#9CA3AF]">{time}</span>
    </li>
  );
}

function groupByDay(events) {
  const sorted = [...events].sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  const groups = new Map();
  const now = new Date();
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const today = startOfDay(now).getTime();
  const yesterday = today - 86400000;
  for (const ev of sorted) {
    if (!ev.at) continue;
    const day = startOfDay(new Date(ev.at)).getTime();
    let label;
    if (day === today) label = "Today";
    else if (day === yesterday) label = "Yesterday";
    else {
      label = new Date(ev.at).toLocaleDateString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    }
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(ev);
  }
  // Reverse so Today shows first
  return Array.from(groups.entries()).reverse().map(([label, items]) => ({
    label,
    items,
  }));
}
