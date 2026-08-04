import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Wallet,
  Truck,
  Calendar,
  Tag as TagIcon,
  Star,
  ShieldCheck,
  AlertTriangle,
  Ban,
  ChevronRight,
  ArrowRight,
  UploadCloud,
  MessagesSquare,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { GlobalSearchModal } from "@/components/ui-portal/GlobalSearchModal";
import { Button } from "@/components/ui-portal/Button";
import { useMessageChime } from "@/hooks/useMessageChime";

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dash, setDash] = useState({});
  const [msgUnread, setMsgUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Round 4 — driver global chime on new messages. Polls
  // /messages/unread-count every 15 s and beeps when the count rises. The
  // driver can toggle it from the card below.
  const chime = useMessageChime({ enabled: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/driver/dashboard").catch(() => ({}));
      setDash(d || {});
    } finally {
      setLoading(false);
    }
  }, []);

  // Reflect the chime hook's live poll into the Messages card so we only
  // hit the endpoint once every 15 s instead of twice.
  useEffect(() => {
    setMsgUnread(chime.unread);
  }, [chime.unread]);

  useEffect(() => {
    load();
  }, [load]);

  const pending = user?.status === "pending";
  const changesRequested = user?.status === "changes_requested";
  const suspended = user?.status === "suspended";
  const earnings = dash.earnings || { today: 0, week: 0, month: 0, all_time: 0, completed_count: 0 };
  const bids = dash.bids || { active: 0, accepted: 0 };
  const fleet = dash.fleet || { count: 0, active_count: 0, capabilities: [], vehicles: [] };
  const jobs = dash.jobs || { nearby_count: 0, active_count: 0, upcoming_count: 0, upcoming: [] };
  const verify = dash.verification || { docs_verified: 0, docs_pending: 0, docs_rejected: 0 };
  const rating = dash.user?.rating ?? user?.rating ?? 5;
  const reviewCount = dash.user?.review_count ?? 0;
  const changesReason = user?.changes_requested_reason || dash?.user?.changes_requested_reason;
  const changesDocTypes = user?.changes_requested_doc_types || dash?.user?.changes_requested_doc_types || [];

  const resubmit = useCallback(async () => {
    try {
      await api("/auth/me/resubmit-verification", { method: "POST" });
      await load();
    } catch {
      // silent
    }
  }, [load]);

  const statusText = suspended
    ? "Account suspended — contact support"
    : changesRequested
    ? "Action required — see below"
    : pending
    ? "Complete verification to earn"
    : "Ready to earn today?";
  const statusDotColor = suspended || changesRequested ? "#DC2626" : pending ? "#F59E0B" : "#16A34A";
  const statusLabel = suspended ? "Suspended" : changesRequested ? "Action needed" : pending ? "Pending" : "Online";

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-home">
      {/* Dark header */}
      <header className="bg-[#111111] px-4 pt-6 pb-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-bold text-white tracking-tight">
              Hi {user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="mt-0.5 text-[13px] text-white/60">{statusText}</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            data-testid="driver-search-open"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusDotColor }} />
            {statusLabel}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[960px] space-y-4 px-4 pt-4 md:px-8">
        {pending && (
          <Link
            to="/driver/documents"
            data-testid="driver-warning-card"
            className="flex items-center gap-3 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] p-4 hover:bg-[#FEF3C7]"
          >
            <AlertTriangle className="h-6 w-6 shrink-0 text-[#F59E0B]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#111111]">
                Account under review
              </p>
              <p className="text-[13px] text-[#78350F]">
                Upload driving licence, insurance, ID and vehicle photos to
                start receiving jobs.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
          </Link>
        )}

        {changesRequested && (
          <div
            className="rounded-[12px] border border-[#DC2626] bg-[#FEF2F2] p-4"
            data-testid="driver-changes-card"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[#DC2626]" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-[#111111]">
                  Admin has requested changes
                </p>
                {changesReason && (
                  <p className="mt-0.5 text-[13px] text-[#78350F]">
                    {changesReason}
                  </p>
                )}
                {changesDocTypes.length > 0 && (
                  <p className="mt-1 text-[13px] text-[#78350F]">
                    Please re-upload:{" "}
                    {changesDocTypes.map((k) => k.replace(/_/g, " ")).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                to="/driver/documents"
                data-testid="driver-changes-upload"
                className="inline-flex items-center gap-1 rounded-full bg-[#D62828] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[#B01F1F]"
              >
                <UploadCloud className="h-4 w-4" />
                Update documents
              </Link>
              <button
                type="button"
                onClick={resubmit}
                data-testid="driver-changes-resubmit"
                className="inline-flex items-center rounded-full border border-[#DC2626] px-3 py-1.5 text-[13px] font-bold text-[#DC2626] hover:bg-[#FEE2E2]"
              >
                Re-submit for review
              </button>
            </div>
          </div>
        )}

        {suspended && (
          <div
            className="flex items-start gap-3 rounded-[12px] border border-[#DC2626] bg-[#FEF2F2] p-4"
            data-testid="driver-suspended-card"
          >
            <Ban className="h-5 w-5 text-[#DC2626]" />
            <div>
              <p className="text-[15px] font-bold text-[#111111]">
                Account suspended
              </p>
              <p className="text-[13px] text-[#78350F]">
                Contact support if you believe this is a mistake.
              </p>
            </div>
          </div>
        )}

        {/* Earnings */}
        <Card
          testID="section-earnings"
          Icon={Wallet}
          iconBg="#FEE2E2"
          iconColor="#D62828"
          title="Earnings"
          rightLabel="Details"
          rightHref="/driver/earnings"
        >
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <EarnCell label="Today" value={earnings.today} accent="#16A34A" />
            <EarnCell label="Week" value={earnings.week} />
            <EarnCell label="Month" value={earnings.month} />
            <EarnCell label="All-time" value={earnings.all_time} accent="#D62828" />
          </div>
          <p className="mt-3 text-[12px] text-[#6B7280]">
            {earnings.completed_count} completed deliver
            {earnings.completed_count === 1 ? "y" : "ies"}
          </p>
        </Card>

        {/* Fleet */}
        <Card
          testID="section-fleet"
          Icon={Truck}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
          title="Fleet Summary"
          rightLabel="Manage"
          rightHref="/driver/fleet"
        >
          {fleet.count === 0 ? (
            <Link
              to="/driver/fleet"
              data-testid="fleet-empty-cta"
              className="flex items-center gap-3 rounded-[10px] bg-[#F9FAFB] p-3 hover:bg-[#F3F4F6]"
            >
              <span className="text-[#D62828]">＋</span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-[#111111]">
                  Register your first vehicle
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  Drivers must have at least one vehicle to accept jobs.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
            </Link>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Vehicles" value={String(fleet.count)} />
                <MiniStat label="Active" value={String(fleet.active_count)} accent="#16A34A" />
                <MiniStat label="Capabilities" value={String(fleet.capabilities.length)} />
              </div>
              <ul className="mt-3 space-y-2">
                {fleet.vehicles.slice(0, 3).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 rounded-[10px] bg-[#F9FAFB] p-3"
                    data-testid={`fleet-veh-${v.id}`}
                  >
                    <Truck className="h-5 w-5 text-[#6B7280]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[#111111]">
                        {v.vehicle_type_name || "Vehicle"}
                        {v.is_default ? " · Default" : ""}
                      </p>
                      <p className="text-[12px] text-[#6B7280]">
                        {v.registration || "—"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                        v.status === "active"
                          ? "bg-[#DCFCE7] text-[#16A34A]"
                          : "bg-[#FEF3C7] text-[#B45309]"
                      }`}
                    >
                      {v.status || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Messages — Round 3 + 4: unread count + audible chime toggle */}
        <Card
          testID="section-messages"
          Icon={MessagesSquare}
          iconBg="#FFF7ED"
          iconColor="#FF6A00"
          title="Messages"
          rightLabel="Open inbox"
          rightHref="/driver/my-jobs"
        >
          {msgUnread > 0 ? (
            <div
              className="flex items-center justify-between gap-3 rounded-[10px] bg-[#FEF3C7] p-3"
              data-testid="driver-messages-unread-card"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#111111]">
                  {msgUnread} new {msgUnread === 1 ? "message" : "messages"}
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  Open the booking to reply — reading a conversation marks it read.
                </p>
              </div>
              <span
                className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-[#D62828] px-2 py-1 text-[12px] font-bold text-white"
                data-testid="driver-messages-unread-badge"
              >
                {msgUnread > 99 ? "99+" : msgUnread}
              </span>
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-1 rounded-[10px] bg-[#F9FAFB] p-4 text-center"
              data-testid="driver-messages-empty"
            >
              <MessagesSquare className="h-6 w-6 text-[#9CA3AF]" />
              <p className="text-[13px] text-[#6B7280]">
                No unread messages.
              </p>
            </div>
          )}
          {/* Chime toggle — off-shift driver mutes without losing the badge */}
          <div
            className="mt-3 flex items-center justify-between rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2"
            data-testid="driver-chime-row"
          >
            <div className="flex items-center gap-2">
              {chime.enabled ? (
                <Volume2 className="h-4 w-4 text-[#16A34A]" />
              ) : (
                <VolumeX className="h-4 w-4 text-[#6B7280]" />
              )}
              <div>
                <p className="text-[13px] font-semibold text-[#111111]">
                  New-message chime
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  {chime.enabled
                    ? "Plays a short sound when a customer replies."
                    : "Muted — you'll still see the badge."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={chime.test}
                data-testid="driver-chime-test"
                className="rounded-full border border-[#E5E7EB] px-3 py-1 text-[11px] font-semibold text-[#6B7280] hover:border-[#111111] hover:text-[#111111]"
              >
                Test
              </button>
              <button
                type="button"
                onClick={() => chime.setEnabled(!chime.enabled)}
                data-testid="driver-chime-toggle"
                role="switch"
                aria-checked={chime.enabled}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  chime.enabled ? "bg-[#16A34A]" : "bg-[#E5E7EB]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    chime.enabled ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        {/* Upcoming Jobs */}
        <Card
          testID="section-upcoming"
          Icon={Calendar}
          iconBg="#FEF3C7"
          iconColor="#F59E0B"
          title="Upcoming Jobs"
          rightLabel="See all"
          rightHref="/driver/my-jobs"
        >
          {jobs.upcoming_count === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-[10px] bg-[#F9FAFB] p-4 text-center" data-testid="upcoming-empty">
              <Calendar className="h-6 w-6 text-[#9CA3AF]" />
              <p className="text-[13px] text-[#6B7280]">
                No confirmed pickups yet.
              </p>
              <Link
                to="/driver/jobs"
                className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-[#D62828] hover:underline"
              >
                Find jobs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {jobs.upcoming.slice(0, 3).map((j) => (
                <li key={j.id}>
                  <Link
                    to={`/driver/booking/${j.id}`}
                    data-testid={`upcoming-${j.id}`}
                    className="flex items-center gap-3 rounded-[10px] bg-[#F9FAFB] p-3 hover:bg-[#F3F4F6]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[#111111]">
                        {j.title || "Booking"}
                      </p>
                      <p className="truncate text-[12px] text-[#6B7280]">
                        {j.pickup_town} → {j.dropoff_town}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[16px] font-bold text-[#111111]">
                        £{Number(j.driver_charge || j.total_price || 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.6px] text-[#6B7280]">
                        {j.status?.replace(/_/g, " ")}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Bids */}
        <Card
          testID="section-bids"
          Icon={TagIcon}
          iconBg="#F3E8FF"
          iconColor="#7C3AED"
          title="Active Bids"
          rightLabel="Browse jobs"
          rightHref="/driver/jobs"
        >
          <div className="grid grid-cols-3 gap-2">
            <MiniStat
              label="Pending"
              value={String(bids.active)}
              accent={bids.active > 0 ? "#F59E0B" : "#6B7280"}
            />
            <MiniStat label="Accepted" value={String(bids.accepted)} accent="#16A34A" />
            <MiniStat label="Nearby jobs" value={String(jobs.nearby_count)} accent="#D62828" />
          </div>
        </Card>

        {/* Rating */}
        <Card
          testID="section-rating"
          Icon={Star}
          iconBg="#FEF3C7"
          iconColor="#F59E0B"
          title="Rating"
          rightLabel="Profile"
          rightHref="/driver/profile"
        >
          <div className="flex items-center gap-4">
            <p className="text-[42px] font-bold leading-none tracking-tight text-[#111111]">
              {Number(rating).toFixed(2)}
            </p>
            <div>
              <div className="flex gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(rating)
                        ? "fill-[#F59E0B] text-[#F59E0B]"
                        : "text-[#E5E7EB]"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[12px] text-[#6B7280]">
                Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </Card>

        {/* Verification */}
        <Card
          testID="section-verification"
          Icon={ShieldCheck}
          iconBg={verify.docs_rejected > 0 ? "#FEE2E2" : "#DCFCE7"}
          iconColor={verify.docs_rejected > 0 ? "#D62828" : "#16A34A"}
          title="Vehicle & Document Status"
          rightLabel="Documents"
          rightHref="/driver/documents"
        >
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Verified" value={String(verify.docs_verified)} accent="#16A34A" />
            <MiniStat label="Pending" value={String(verify.docs_pending)} accent="#F59E0B" />
            <MiniStat label="Rejected" value={String(verify.docs_rejected)} accent="#D62828" />
          </div>
          <p className="mt-3 text-[12px] text-[#6B7280]">
            Account: {verify.account_status || user?.status || "—"}
          </p>
        </Card>

        {loading && (
          <p className="pt-2 text-center text-[12px] text-[#6B7280]">Refreshing…</p>
        )}
      </div>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope="all"
        placeholder="Search jobs, categories, vehicles…"
      />
    </div>
  );
}

function Card({ Icon, iconBg, iconColor, title, rightLabel, rightHref, children, testID }) {
  return (
    <section
      data-testid={testID}
      className="rounded-[14px] border border-[#E5E7EB] bg-white p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: iconBg }}
          >
            <Icon className="h-4 w-4" style={{ color: iconColor }} />
          </span>
          <h2 className="text-[16px] font-bold text-[#111111]">{title}</h2>
        </div>
        {rightHref && (
          <Link to={rightHref} className="text-[13px] font-bold text-[#D62828] hover:underline">
            {rightLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EarnCell({ label, value, accent = "#111111" }) {
  return (
    <div className="rounded-[10px] bg-[#F9FAFB] p-3">
      <p className="text-[20px] font-bold leading-none tracking-tight" style={{ color: accent }}>
        £{Number(value || 0).toFixed(0)}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, accent = "#111111" }) {
  return (
    <div className="rounded-[10px] bg-[#F9FAFB] p-3">
      <p className="text-[20px] font-bold leading-none tracking-tight" style={{ color: accent }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">{label}</p>
    </div>
  );
}
