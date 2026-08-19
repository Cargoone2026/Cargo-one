import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X as XIcon, MapPin, ChevronRight, Package, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";

const PAST = new Set(["completed", "cancelled"]);

// R60 — safe resolver for the amount displayed on a Bookings row.
//
// Returns { label, value } where value is a valid Number (> 0) or null.
// Never displays deposit as booking total (financially misleading).
// Never returns NaN — the label switches to a safe fallback when no
// authoritative amount is available on the record.
//
// Field precedence (booking rows, active / completed):
//   1. R38 canonical `customer_total` on the booking.
//   2. Legacy `total_price` on the booking (older records).
//   3. `job.customer_total` (backfilled R38 mirror).
//   4. `job.accepted_price` (finalised agreed price from job).
//   → otherwise "Price pending" — no invented number.
//
// Cancelled rows show the refund amount (`cancellation_refund` from
// R35/R36) under a "Refunded" label. If missing, show "Price pending"
// rather than the original booking total.
//
// Open-job rows (_isJob=true) use `suggested_price` with legacy
// `accepted_price` / `customer_total` fallbacks under an "Estimated"
// label.
function resolveDisplayAmount(it) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  if (it?._isJob) {
    const v = num(it.suggested_price) ?? num(it.accepted_price) ?? num(it.customer_total);
    return { label: "Estimated", value: v };
  }
  if (it?.status === "cancelled" || it?.cancelled_at) {
    const v = num(it.cancellation_refund) ?? num(it.refund_amount);
    return { label: "Refunded", value: v };
  }
  const v =
       num(it?.customer_total)
    ?? num(it?.total_price)
    ?? num(it?.job?.customer_total)
    ?? num(it?.job?.accepted_price);
  return { label: "Total", value: v };
}

// R59 — active ASAP bookings route to the new map-first Uber-style
// dispatch screen (/customer/dispatch/:jobId) instead of the classic
// booking detail. This mirrors the same logic used by the redirect in
// BookingDetail.jsx so navigation, refresh, direct URL entry and
// logout/login all resolve to the same canonical experience.
function isActiveAsap(b) {
  if (!b || b._isJob) return false;
  const timing = b.service_timing || b.job?.service_timing;
  if (timing !== "asap") return false;
  const status = b.status;
  return status !== "completed" && status !== "cancelled" && !b.cancelled_at;
}
function bookingHref(it) {
  if (it._isJob) return `/customer/job/${it.id}`;
  if (isActiveAsap(it) && it.job_id) return `/customer/dispatch/${it.job_id}`;
  return `/customer/booking/${it.id}`;
}

export default function CustomerBookings() {
  const navigate = useNavigate();
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
  // Jobs remain visible in "Active" while awaiting a driver (`posted`) AND
  // after a driver has accepted (`accepted`) — up to the point the customer
  // creates a booking (which then takes over via `items`). Historically we
  // filtered `posted` only, which made accepted fixed-price jobs vanish
  // before the customer had a chance to pay the deposit.
  const bookedJobIds = useMemo(
    () => new Set(items.map((b) => b.job_id).filter(Boolean)),
    [items],
  );
  const openJobs = useMemo(
    () =>
      jobs
        .filter((j) => ["posted", "accepted"].includes(j.status))
        .filter((j) => !bookedJobIds.has(j.id))
        .map((j) => ({ ...j, _isJob: true })),
    [jobs, bookedJobIds],
  );

  const display = useMemo(() => {
    const raw = tab === "active" ? [...active, ...openJobs] : past;
    // R70 — newest-first regardless of whether the row is a booking or an
    // unpaid job. The user should never scroll past older items to find a
    // newly created one. `created_at` is the authoritative timestamp used
    // by both `/bookings/mine` and `/jobs/mine` server-side.
    const sorted = [...raw].sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || ""),
    );
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((it) => {
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
            {display.map((it) => {
              const cancelled = !it._isJob && it.status === "cancelled";
              const service = it._isJob
                ? it.service_timing
                : it.service_timing || it.job?.service_timing;
              const rebookHref =
                service === "asap"
                  ? "/customer/asap?rebook=1"
                  : "/customer/post-job?rebook=1";
              return (
                <li key={it.id}>
                  <div
                    className={`block rounded-[12px] border p-4 transition-colors ${
                      cancelled
                        ? "border-[#FCA5A5] bg-[#FEF2F2]"
                        : "border-[#E5E7EB] bg-white hover:border-[#111111]"
                    }`}
                    data-testid={`booking-row-${it.id}`}
                  >
                    <Link
                      to={bookingHref(it)}
                      className="block"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={`min-w-0 flex-1 truncate text-[16px] font-semibold ${
                            cancelled
                              ? "text-[#991B1B] line-through decoration-[#DC2626]/60"
                              : "text-[#111111]"
                          }`}
                        >
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
                        {(() => {
                          const amt = resolveDisplayAmount(it);
                          const hasValue = amt.value != null;
                          return (
                            <div data-testid={`booking-row-price-${it.id}`}>
                              <p className="text-[12px] text-[#6B7280]">
                                {hasValue ? amt.label : "\u00A0" /* preserve row height */}
                              </p>
                              <p
                                className={`text-[18px] font-bold ${
                                  cancelled ? "text-[#991B1B]" : "text-[#111111]"
                                }`}
                              >
                                {hasValue
                                  ? `£${amt.value.toFixed(0)}`
                                  : "Price pending"}
                              </p>
                            </div>
                          );
                        })()}
                        <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
                      </div>
                    </Link>
                    {cancelled ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            sessionStorage.setItem(
                              "cargoone.rebook.payload",
                              JSON.stringify({
                                source_booking_id: it.id,
                                job: it.job || {},
                                service_type: it.service_type || it.job?.service_type,
                                service_timing:
                                  it.service_timing || it.job?.service_timing,
                              }),
                            );
                          } catch {}
                          navigate(rebookHref);
                        }}
                        data-testid={`booking-row-rebook-${it.id}`}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#000000]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Rebook this job
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
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
