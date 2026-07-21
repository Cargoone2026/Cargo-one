import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X as XIcon, Boxes, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api("/admin/bookings").catch(() => []);
      setBookings(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((b) =>
      `${b.job?.title || ""} ${b.status || ""} ${b.customer_name || ""} ${b.driver_name || ""} ${b.payment_status || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [bookings, q]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-bookings">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">Bookings</h1>
        <span className="text-[13px] text-[#6B7280]">
          {filtered.length} of {bookings.length}
        </span>
      </header>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, status, customer, driver…"
          data-testid="admin-bookings-search"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear" data-testid="admin-bookings-search-clear">
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {loading && bookings.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading bookings…</li>
        ) : filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-bookings-empty">
            <Boxes className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">
              {q ? "No matching bookings." : "No bookings yet."}
            </p>
          </li>
        ) : (
          filtered.map((b) => (
            <li
              key={b.id}
              className="rounded-[12px] border border-[#E5E7EB] p-4"
              data-testid={`admin-booking-${b.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#111111]">
                  {b.job?.title || "Booking"}
                </p>
                <StatusPill status={b.status} />
              </div>
              <div className="mt-2 flex items-center gap-1 text-[13px] text-[#6B7280]">
                <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                <span className="truncate">
                  {b.job?.pickup_town} → {b.job?.dropoff_town}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-2">
                <div className="text-[12px] text-[#6B7280]">
                  Customer: {b.customer_name || "—"} · Driver: {b.driver_name || "—"}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                      b.payment_status === "paid"
                        ? "bg-[#DCFCE7] text-[#16A34A]"
                        : "bg-[#FEF3C7] text-[#B45309]"
                    }`}
                  >
                    {b.payment_status || "unpaid"}
                  </span>
                  <span className="text-[16px] font-bold text-[#111111]">
                    £{Number(b.total_price || 0).toFixed(0)}
                  </span>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
