import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, ChevronRight, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";

export default function DriverMyJobs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await api("/bookings/mine").catch(() => []);
      setItems(Array.isArray(b) ? b : []);
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
          items.map((b) => (
            <li key={b.id}>
              <Link
                to={`/driver/booking/${b.id}`}
                data-testid={`driver-myjob-${b.id}`}
                className="block rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#111111]">
                    {b.job?.title || "Job"}
                  </p>
                  <StatusPill status={b.status} />
                </div>
                <div className="mt-2 flex items-center gap-1 text-[14px] text-[#6B7280]">
                  <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                  <span className="truncate">
                    {b.job?.pickup_town} → {b.job?.dropoff_town}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-[#F3F4F6] pt-3">
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Your earning</p>
                    <p className="text-[18px] font-bold text-[#111111]">
                      £{Number(b.driver_charge ?? b.total_price ?? 0).toFixed(0)}
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
