import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, MessagesSquare, ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Driver notifications inbox — mirrors the customer Messages Updates tab UX.
 *
 * On <md viewports the list and detail are mutually exclusive (list → tap →
 * detail full-screen with a back arrow), on md+ they render as a two-pane
 * layout. Each notification's `data` may include `job_id` or `booking_id` —
 * we surface a deep-link CTA that routes to /driver/job/:id or
 * /driver/booking/:id so the driver can jump straight to context.
 */
export default function DriverNotifications() {
  const [params] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const n = await api("/notifications").catch(() => []);
      const list = Array.isArray(n) ? n : [];
      setNotes(list);
      // Auto-select the newest notification ONLY on md+ screens so mobile
      // users see the list first.
      if (
        list.length &&
        !selected &&
        typeof window !== "undefined" &&
        window.innerWidth >= 768
      ) {
        setSelected(list[0]);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const markRead = useCallback(async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      /* silent */
    }
  }, []);

  const pick = (n) => {
    setSelected(n);
    if (!n.read) markRead(n.id);
  };

  const listItems = useMemo(() => notes, [notes]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-notifications">
      <header className="bg-[#111111] px-4 pt-6 pb-4 md:px-8">
        <h1 className="text-[26px] font-bold text-white tracking-tight">
          Notifications
        </h1>
        <p className="mt-0.5 text-[13px] text-white/60">
          Updates from dispatch, bookings and payments.
        </p>
      </header>

      <div className="mx-auto grid max-w-[960px] gap-4 px-4 pt-4 md:grid-cols-[minmax(260px,320px)_1fr] md:px-8">
        <section
          className={`rounded-[12px] border border-[#E5E7EB] bg-white ${
            selected ? "hidden md:block" : ""
          }`}
          data-testid="driver-notifications-list"
        >
          {loading ? (
            <p className="px-4 py-4 text-[13px] text-[#6B7280]">Loading…</p>
          ) : listItems.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 px-4 py-12 text-center"
              data-testid="driver-notifications-empty"
            >
              <MessagesSquare className="h-10 w-10 text-[#9CA3AF]" />
              <h3 className="mt-2 text-[15px] font-semibold text-[#111111]">
                No notifications yet
              </h3>
              <p className="text-[13px] text-[#6B7280]">
                Dispatch, payment and message events will land here.
              </p>
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-[#F3F4F6] overflow-y-auto">
              {listItems.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => pick(n)}
                    data-testid={`driver-notification-row-${n.id}`}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      selected?.id === n.id
                        ? "bg-[#FEE2E2]/50"
                        : !n.read
                        ? "bg-[#FEF2F2]"
                        : "hover:bg-[#F4F4F4]"
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2]">
                      <Bell className="h-4 w-4 text-[#D62828]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-[#111111]">
                        {n.title}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-[12px] text-[#6B7280]">
                        {n.body}
                      </span>
                      <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                        {formatWhen(n.created_at)}
                      </span>
                    </span>
                    {!n.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D62828]" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className={`flex min-h-[420px] flex-col rounded-[12px] border border-[#E5E7EB] bg-white ${
            selected ? "" : "hidden md:flex"
          }`}
          data-testid="driver-notifications-thread"
        >
          {selected ? (
            <>
              <div className="flex items-start gap-2 border-b border-[#E5E7EB] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Back to notifications"
                  data-testid="driver-notification-back-button"
                  className="mt-0.5 -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[#F4F4F4] md:hidden"
                >
                  <ArrowLeft className="h-4 w-4 text-[#111111]" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#D62828]">
                    Notification
                  </p>
                  <h2 className="mt-1 text-[18px] font-bold text-[#111111]">
                    {selected.title}
                  </h2>
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">
                    {formatWhen(selected.created_at, true)}
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 text-[14px] leading-relaxed text-[#111111]">
                {selected.body}
                {(() => {
                  const d = selected.data || {};
                  const bookingId = d.booking_id;
                  const jobId = d.job_id;
                  const target = bookingId
                    ? `/driver/booking/${bookingId}`
                    : jobId
                    ? `/driver/job/${jobId}`
                    : null;
                  if (!target) return null;
                  return (
                    <div className="mt-4">
                      <Link
                        to={target}
                        data-testid="driver-notification-open-link"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#D62828]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {bookingId ? "Open booking" : "Open job"}
                      </Link>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <div
              className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"
              data-testid="driver-notifications-empty-pane"
            >
              <Bell className="h-10 w-10 text-[#9CA3AF]" />
              <h3 className="mt-3 text-[15px] font-semibold text-[#111111]">
                Pick a notification
              </h3>
              <p className="mt-1 text-[13px] text-[#6B7280]">
                Select an entry to see the full update and open the related job.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatWhen(iso, verbose = false) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (!verbose) {
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return "Just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return d.toLocaleDateString();
    }
    return d.toLocaleString();
  } catch {
    return "";
  }
}
