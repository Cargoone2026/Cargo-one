import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X as XIcon, MapPin, ChevronRight, Package } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";

const PAST = new Set(["completed", "cancelled"]);

export default function CustomerBookings() {
  const [tab, setTab] = useState("active");
  const [items, setItems] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, j] = await Promise.all([
        api("/bookings/mine").catch(() => []),
        api("/jobs/mine").catch(() => []),
      ]);
      setItems(Array.isArray(b) ? b : []);
      setJobs(Array.isArray(j) ? j : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => items.filter((b) => !PAST.has(b.status)), [items]);
  const past = useMemo(() => items.filter((b) => PAST.has(b.status)), [items]);
  const openJobs = useMemo(
    () => jobs.filter((j) => j.status === "posted").map((j) => ({ ...j, _isJob: true })),
    [jobs],
  );

  const display = useMemo(() => {
    const raw = tab === "active" ? [...active, ...openJobs] : past;
    const needle = q.trim().toLowerCase();
    if (!needle) return raw;
    return raw.filter((it) => {
      const title = (it._isJob ? it.title : it.job?.title) || "";
      const pu = (it._isJob ? it.pickup_town : it.job?.pickup_town) || "";
      const drop = (it._isJob ? it.dropoff_town : it.job?.dropoff_town) || "";
      return (
        title.toLowerCase().includes(needle) ||
        pu.toLowerCase().includes(needle) ||
        drop.toLowerCase().includes(needle)
      );
    });
  }, [tab, active, past, openJobs, q]);

  const activeCount = active.length + openJobs.length;
  const pastCount = past.length;

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="customer-bookings">
      <header className="px-4 pt-6 pb-3 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
          Bookings
        </h1>
      </header>

      <div className="mx-4 mb-3 flex rounded-full bg-[#F4F4F4] p-1 md:mx-8">
        <TabButton
          active={tab === "active"}
          onClick={() => setTab("active")}
          testID="bookings-active-tab"
        >
          Active ({activeCount})
        </TabButton>
        <TabButton
          active={tab === "past"}
          onClick={() => setTab("past")}
          testID="bookings-past-tab"
        >
          Past ({pastCount})
        </TabButton>
      </div>

      <div className="mx-4 mb-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search bookings, pickup, delivery..."
          data-testid="bookings-search"
          className="flex-1 bg-transparent text-[14px] text-[#111111] placeholder:text-[#9CA3AF] outline-none"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            data-testid="bookings-search-clear"
          >
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        ) : null}
      </div>

      <div className="px-4 md:px-8">
        {loading ? (
          <p className="rounded-[12px] bg-[#F4F4F4] px-4 py-4 text-[13px] text-[#6B7280]">
            Loading bookings…
          </p>
        ) : display.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-16 text-center"
            data-testid="bookings-empty"
          >
            <Package className="h-12 w-12 text-[#9CA3AF]" />
            <h3 className="mt-2 text-[16px] font-semibold text-[#111111]">
              {tab === "active" ? "No active bookings" : "No past bookings"}
            </h3>
            <p className="text-[13px] text-[#6B7280]">
              {tab === "active"
                ? "Post your first job to get started."
                : "Completed shipments will appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {display.map((it) => (
              <li key={it.id}>
                <Link
                  to={
                    it._isJob
                      ? `/customer/job/${it.id}`
                      : `/customer/booking/${it.id}`
                  }
                  data-testid={`booking-row-${it.id}`}
                  className="block rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#111111]">
                      {it._isJob ? it.title : it.job?.title}
                    </h3>
                    <StatusPill status={it.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[14px] text-[#6B7280]">
                    <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                    <span className="truncate">
                      {it._isJob
                        ? `${it.pickup_town} → ${it.dropoff_town}`
                        : `${it.job?.pickup_town} → ${it.job?.dropoff_town}`}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-[#F3F4F6] pt-3">
                    <div>
                      <p className="text-[12px] text-[#6B7280]">Total</p>
                      <p className="text-[18px] font-bold text-[#111111]">
                        £
                        {Number(
                          it._isJob ? it.suggested_price : it.total_price,
                        ).toFixed(0)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, testID, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className={`flex-1 rounded-full py-2 text-[14px] font-medium transition-colors ${
        active
          ? "bg-[#111111] text-white"
          : "bg-transparent text-[#6B7280] hover:text-[#111111]"
      }`}
    >
      {children}
    </button>
  );
}
