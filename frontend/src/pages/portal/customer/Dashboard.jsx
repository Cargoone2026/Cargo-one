import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  ArrowRight,
  Package as PackageIcon,
  MessagesSquare,
  Bed,
  Boxes,
  Car,
  Home as HomeIcon,
  Layers as LayersIcon,
  Ship,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNotificationChime } from "@/hooks/useNotificationChime";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { GlobalSearchModal } from "@/components/ui-portal/GlobalSearchModal";

const CATEGORIES = [
  { id: "furniture", label: "Furniture", Icon: Bed },
  { id: "parcels", label: "Parcels", Icon: Boxes },
  { id: "cars", label: "Cars", Icon: Car },
  { id: "house_moves", label: "House Move", Icon: HomeIcon },
  { id: "pallets", label: "Pallets", Icon: LayersIcon },
  { id: "freight", label: "Freight", Icon: Ship },
];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [msgUnread, setMsgUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  // Round 13+ — customer global chime on new notifications (driver accepted,
  // arrived, POD uploaded, etc.). Reflects live unread count into the bell
  // badge below and pings on rising count. Uses its own storage key so it
  // never collides with the driver-side or message-side chimes.
  const notifChime = useNotificationChime({ enabled: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, n, u] = await Promise.all([
        api("/bookings/mine").catch(() => []),
        api("/notifications").catch(() => []),
        api("/messages/unread-count").catch(() => ({ total: 0 })),
      ]);
      setBookings(Array.isArray(b) ? b : []);
      setNotes(Array.isArray(n) ? n : []);
      setMsgUnread(Number(u?.total || 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () =>
      bookings.filter(
        (b) => !["completed", "cancelled"].includes(b.status),
      ),
    [bookings],
  );
  const unreadCount = Math.max(
    notifChime.unread,
    notes.filter((n) => !n.read).length,
  );
  const firstName = (user?.name || "").split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="customer-dashboard">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-3 md:px-8">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#111111] md:text-[28px]">
            Hey {firstName}
          </h1>
          <p className="mt-0.5 text-[14px] text-[#6B7280]">
            Ship Anything. Anywhere.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            data-testid="customer-search-button"
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
          >
            <Search className="h-5 w-5 text-[#111111]" />
          </button>
          <Link
            to="/customer/messages?tab=notifications"
            data-testid="notifications-button"
            aria-label="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
          >
            <Bell className="h-5 w-5 text-[#111111]" />
            {unreadCount > 0 && (
              <span
                className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#D62828]"
                data-testid="notifications-unread-dot"
              />
            )}
          </Link>
        </div>
      </header>

      <div className="space-y-4 px-4 md:px-8">
        {/* Search pill */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          data-testid="customer-search-pill"
          className="flex w-full items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-4 py-3 text-left hover:bg-[#E5E7EB]"
        >
          <Search className="h-4 w-4 text-[#6B7280]" />
          <span className="text-[14px] text-[#6B7280]">
            Search categories, vehicles or jobs…
          </span>
        </button>

        {/* Hero */}
        <button
          type="button"
          onClick={() => navigate("/customer/post-job")}
          data-testid="post-job-hero"
          className="relative flex h-[200px] w-full flex-col justify-end overflow-hidden rounded-[16px] text-left"
          style={{
            backgroundImage:
              "linear-gradient(rgba(17,17,17,0.1), rgba(17,17,17,0.85)), url('https://images.unsplash.com/photo-1620455800201-7f00aeef12ed?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMGRlbGl2ZXJ5JTIwdmFufGVufDB8fHx8MTc4NDEzNjI1MHww&ixlib=rb-4.1.0&q=85')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="space-y-2 p-6">
            <p className="text-[11px] font-bold tracking-[1.5px] text-white/75">
              NEW SHIPMENT
            </p>
            <p className="text-[26px] font-bold leading-[30px] tracking-tight text-white">
              Post a job in
              <br />
              under 60 seconds
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[14px] font-semibold text-white">
              Get instant quotes
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </button>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/customer/bookings"
            data-testid="quick-bookings"
            className="flex flex-col gap-2 rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FEE2E2]">
              <PackageIcon className="h-5 w-5 text-[#D62828]" />
            </span>
            <span className="text-[16px] font-semibold text-[#111111]">
              Bookings
            </span>
            <span className="text-[13px] text-[#6B7280]">
              {bookings.length} total
            </span>
          </Link>
          <Link
            to="/customer/messages"
            data-testid="quick-messages"
            className="relative flex flex-col gap-2 rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FFF7ED]">
              <MessagesSquare className="h-5 w-5 text-[#FF6A00]" />
            </span>
            {msgUnread > 0 && (
              <span
                className="absolute right-3 top-3 min-w-[22px] rounded-full bg-[#D62828] px-1.5 py-0.5 text-center text-[11px] font-bold text-white"
                data-testid="customer-messages-unread-badge"
              >
                {msgUnread > 99 ? "99+" : msgUnread}
              </span>
            )}
            <span className="text-[16px] font-semibold text-[#111111]">
              Messages
            </span>
            <span className="text-[13px] text-[#6B7280]">
              {msgUnread > 0
                ? `${msgUnread} unread ${msgUnread === 1 ? "message" : "messages"}`
                : "No new messages"}
            </span>
          </Link>
        </div>

        {/* Active shipments */}
        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-[#111111]">
            Active shipments
          </h2>
          <Link
            to="/customer/bookings"
            className="text-[14px] font-semibold text-[#D62828] hover:underline"
          >
            See all
          </Link>
        </div>

        {loading ? (
          <p className="rounded-[12px] bg-[#F4F4F4] px-4 py-4 text-[13px] text-[#6B7280]">
            Loading shipments…
          </p>
        ) : active.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-[16px] bg-[#F4F4F4] px-6 py-10 text-center"
            data-testid="empty-active-bookings"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <PackageIcon className="h-8 w-8 text-[#9CA3AF]" />
            </span>
            <h3 className="text-[16px] font-semibold text-[#111111]">
              No active shipments
            </h3>
            <p className="max-w-[320px] text-[13px] leading-relaxed text-[#6B7280]">
              Post a job to receive instant quotes from vetted drivers.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {active.slice(0, 5).map((b) => (
              <li key={b.id}>
                <Link
                  to={`/customer/booking/${b.id}`}
                  data-testid={`booking-card-${b.id}`}
                  className="block rounded-[12px] border border-[#E5E7EB] bg-white p-4 hover:border-[#111111]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#111111]">
                      {b.job?.title || "Shipment"}
                    </h3>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[14px] text-[#6B7280]">
                    <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                    <span className="truncate">
                      {b.job?.pickup_town} → {b.job?.dropoff_town}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#F3F4F6] pt-3">
                    <span className="text-[18px] font-bold text-[#111111]">
                      £{Number(b.total_price || 0).toFixed(0)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Categories */}
        <h2 className="mt-4 text-[20px] font-bold text-[#111111]">
          What are you shipping?
        </h2>
        <div className="grid grid-cols-3 gap-3 pb-6">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/customer/post-job?category=${c.id}`)}
              data-testid={`category-${c.id}`}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] bg-[#F4F4F4] hover:bg-[#E5E7EB]"
            >
              <c.Icon className="h-6 w-6 text-[#111111]" />
              <span className="text-[13px] font-medium text-[#111111]">
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope="all"
        placeholder="Search categories, vehicles or your jobs…"
      />
    </div>
  );
}
