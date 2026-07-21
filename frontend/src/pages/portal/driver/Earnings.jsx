import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Hourglass, CheckCircle2, Info } from "lucide-react";
import { api } from "@/lib/api";

const IN_PROGRESS = new Set([
  "deposit_paid",
  "confirmed",
  "travelling",
  "arrived",
  "collected",
  "on_route",
  "delivered",
  "pod_uploaded",
]);

export default function DriverEarnings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await api("/bookings/mine").catch(() => []);
      setBookings(Array.isArray(b) ? b : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const completed = bookings.filter((b) => b.status === "completed");
    const upcoming = bookings.filter((b) => IN_PROGRESS.has(b.status));
    const total = completed.reduce(
      (a, b) => a + Number(b.driver_charge ?? b.balance_due ?? 0),
      0,
    );
    const pending = upcoming.reduce(
      (a, b) => a + Number(b.driver_charge ?? b.balance_due ?? 0),
      0,
    );
    return {
      total,
      pending,
      completed: completed.length,
      upcoming: upcoming.length,
    };
  }, [bookings]);

  const completed = bookings.filter((b) => b.status === "completed").slice(0, 10);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-earnings">
      <div className="mx-auto max-w-[720px] space-y-4 px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
          Earnings
        </h1>

        <section
          className="space-y-1 rounded-[16px] bg-[#111111] p-6"
          data-testid="earnings-hero"
        >
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-white/60">
            Total earned
          </p>
          <p className="text-[42px] font-bold leading-none tracking-tight text-white">
            £{stats.total.toFixed(2)}
          </p>
          <p className="text-[14px] text-white/75">
            {stats.completed} completed deliveries
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[12px] bg-[#FFF7ED] p-4" data-testid="earnings-pending">
            <Hourglass className="h-5 w-5 text-[#FF6A00]" />
            <p className="mt-2 text-[24px] font-bold text-[#111111]">
              £{stats.pending.toFixed(0)}
            </p>
            <p className="text-[13px] text-[#6B7280]">Pending balance</p>
          </div>
          <div className="rounded-[12px] bg-[#F0FDF4] p-4" data-testid="earnings-inprogress">
            <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
            <p className="mt-2 text-[24px] font-bold text-[#111111]">
              {stats.upcoming}
            </p>
            <p className="text-[13px] text-[#6B7280]">In progress</p>
          </div>
        </div>

        <div
          className="flex items-start gap-2 rounded-[12px] bg-[#DBEAFE] p-4"
          data-testid="earnings-info"
        >
          <Info className="mt-0.5 h-5 w-5 text-[#2563EB]" />
          <p className="text-[13px] leading-relaxed text-[#111111]">
            You receive the balance directly from customers on delivery. Cargo
            One only collects the platform booking fee via Stripe.
          </p>
        </div>

        <h2 className="pt-2 text-[20px] font-bold text-[#111111]">
          Recent Deliveries
        </h2>
        {loading && completed.length === 0 ? (
          <p className="text-[13px] text-[#6B7280]">Loading…</p>
        ) : completed.length === 0 ? (
          <p
            className="rounded-[10px] bg-[#F9FAFB] p-4 text-center text-[13px] text-[#6B7280]"
            data-testid="earnings-empty"
          >
            No completed deliveries yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {completed.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between py-3"
                data-testid={`earning-${b.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#111111]">
                    {b.job?.title || "Delivery"}
                  </p>
                  <p className="text-[12px] text-[#6B7280]">
                    {new Date(b.completed_at || b.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-[16px] font-bold text-[#16A34A]">
                  +£{Number(b.driver_charge ?? b.balance_due ?? 0).toFixed(0)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
