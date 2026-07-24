import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, ChevronRight, MapPin, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";

/**
 * Driver → My Jobs.
 *
 * Fix 2B: merges two sources into a single list —
 *   1) /bookings/mine        → post-deposit real bookings
 *   2) /driver/accepted-jobs → pre-deposit accepted jobs (no booking yet)
 * Pre-deposit entries render with "Waiting for customer deposit". Once the
 * customer pays and a real booking materialises, the corresponding job row
 * disappears from /driver/accepted-jobs (its status is no longer "accepted"),
 * so no duplicate card is possible.
 */
export default function DriverMyJobs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookings, accepted] = await Promise.all([
        api("/bookings/mine").catch(() => []),
        api("/driver/accepted-jobs").catch(() => []),
      ]);
      // Normalise both sources to a single card shape.
      const bookingCards = (Array.isArray(bookings) ? bookings : []).map((b) => ({
        kind: "booking",
        id: b.id,
        title: b?.job?.title || "Job",
        pickup_town: b?.job?.pickup_town,
        dropoff_town: b?.job?.dropoff_town,
        status: b.status,
        earning: Number(b.driver_charge ?? b.total_price ?? 0),
        link: `/driver/booking/${b.id}`,
        awaiting_deposit: false,
        ts: b.updated_at || b.created_at || "",
      }));
      const acceptedCards = (Array.isArray(accepted) ? accepted : []).map((j) => ({
        kind: "accepted_job",
        id: j.id,
        title: j.title || "Job",
        pickup_town: j.pickup_town,
        dropoff_town: j.dropoff_town,
        status: "accepted",
        earning: Number(j.accepted_price ?? j.fixed_price ?? 0),
        link: `/driver/job/${j.id}`,
        awaiting_deposit: true,
        ts: j.updated_at || j.created_at || "",
      }));
      // Guard against a race between the two lists — the moment a booking
      // exists for a job, we deliberately drop the job-side card by job_id.
      const bookingJobIds = new Set(
        (Array.isArray(bookings) ? bookings : [])
          .map((b) => b?.job_id || b?.job?.id)
          .filter(Boolean),
      );
      const merged = [
        ...bookingCards,
        ...acceptedCards.filter((c) => !bookingJobIds.has(c.id)),
      ];
      merged.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
      setItems(merged);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-my-jobs">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">My Jobs</h1>
        <span className="text-[13px] text-[#6B7280]">{items.length} total</span>
      </header>
      <ul className="mx-4 mt-4 space-y-3 md:mx-8">
        {loading && items.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading jobs…</li>
        ) : items.length === 0 ? (
          <li
            className="flex flex-col items-center gap-2 py-16 text-center"
            data-testid="my-jobs-empty"
          >
            <Package className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[15px] font-semibold text-[#111111]">No jobs yet</p>
            <p className="text-[13px] text-[#6B7280]">
              Accept or bid on nearby jobs to see them here.
            </p>
          </li>
        ) : (
          items.map((c) => (
            <li key={`${c.kind}-${c.id}`}>
              <Link
                to={c.link}
                data-testid={
                  c.awaiting_deposit
                    ? `driver-myjob-awaiting-${c.id}`
                    : `driver-myjob-${c.id}`
                }
                className="block rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#111111]">
                    {c.title}
                  </p>
                  <StatusPill status={c.status} />
                </div>
                <div className="mt-2 flex items-center gap-1 text-[14px] text-[#6B7280]">
                  <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                  <span className="truncate">
                    {c.pickup_town} → {c.dropoff_town}
                  </span>
                </div>
                {c.awaiting_deposit ? (
                  <div
                    className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#B45309]"
                    data-testid="waiting-deposit-label"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Waiting for customer deposit</span>
                  </div>
                ) : null}
                <div className="mt-3 flex items-end justify-between border-t border-[#F3F4F6] pt-3">
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Your earning</p>
                    <p className="text-[18px] font-bold text-[#111111]">
                      £{c.earning.toFixed(0)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
