import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, MessagesSquare, Lock, MessageCircle, ExternalLink, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/api";
import { useNotificationChime } from "@/hooks/useNotificationChime";

/**
 * Customer inbox — Stage 2A-i + Round 4 preview cards.
 *
 * Two panes:
 *  - "Conversations" (default, sourced from /messages/summary) — shows the
 *    latest driver reply preview against each PAID booking so the customer
 *    can triage without opening every thread. WhatsApp-style unread pip +
 *    "Delivered"/"Read" tick on the last self-authored message.
 *  - "Notifications" — the classic system inbox backed by /notifications.
 */
export default function CustomerMessages() {
  const [params] = useSearchParams();
  const initialTab = params.get("tab") === "notifications" ? "notifications" : "conversations";
  const [tab, setTab] = useState(initialTab); // conversations | notifications
  // Round 13+ — customer notification chime, mirrors the driver one. Toggle
  // lives on the Updates tab header; preference persists to localStorage
  // under `cargoone_notification_chime_enabled` shared with driver so a user
  // who wears both hats has one preference. Independent chime instance
  // vs the CustomerDashboard bell (both harmless — both point at the same
  // preference key and the primed gate ensures no double-fire on load).
  const notifChime = useNotificationChime({ enabled: true });
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");

  const loadThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const list = await api("/messages/summary").catch(() => []);
      setThreads(Array.isArray(list) ? list : []);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const n = await api("/notifications").catch(() => []);
      const list = Array.isArray(n) ? n : [];
      setNotes(list);
      // Auto-select the newest notification ONLY on md+ screens so mobile
      // users see the list first and can pick which one to open.
      if (list.length && !selected && typeof window !== "undefined" && window.innerWidth >= 768) {
        setSelected(list[0]);
      }
    } finally {
      setNotesLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadThreads();
    loadNotes();
    // Auto-refresh conversation previews every 20 s while the tab is open —
    // reasonable balance between "live" and network traffic.
    const iv = setInterval(loadThreads, 20000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the notification list whenever the chime's rolling unread count
  // ticks (rising or falling). Keeps the Updates tab live without adding a
  // separate poll loop.
  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifChime.unread]);

  const markRead = useCallback(async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* silent */ }
  }, []);

  const pick = (n) => {
    setSelected(n);
    if (!n.read) markRead(n.id);
  };

  const listItems = useMemo(() => notes, [notes]);
  const totalUnreadConvos = useMemo(
    () => threads.reduce((s, t) => s + (t.unread_count || 0), 0),
    [threads],
  );

  return (
    <div className="min-h-screen bg-white" data-testid="customer-messages">
      <header className="px-4 pt-6 pb-3 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
          Inbox
        </h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Chat with your drivers and stay on top of booking updates.
        </p>
      </header>

      {/* Tab strip */}
      <div className="mb-2 flex gap-1 rounded-full bg-[#F4F4F4] p-1 md:mx-8 mx-4 md:max-w-[420px]">
        <TabButton
          active={tab === "conversations"}
          onClick={() => setTab("conversations")}
          testId="inbox-tab-conversations"
          badge={totalUnreadConvos}
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          Conversations
        </TabButton>
        <TabButton
          active={tab === "notifications"}
          onClick={() => setTab("notifications")}
          testId="inbox-tab-notifications"
        >
          <Bell className="mr-1 h-4 w-4" />
          Updates
        </TabButton>
      </div>

      {tab === "conversations" ? (
        <ConversationsPane
          threads={threads}
          loading={threadsLoading}
        />
      ) : (
        <NotificationsPane
          listItems={listItems}
          loading={notesLoading}
          selected={selected}
          onPick={pick}
          onClose={() => setSelected(null)}
          draft={draft}
          setDraft={setDraft}
          chimeEnabled={notifChime.enabled}
          onToggleChime={() => notifChime.setEnabled(!notifChime.enabled)}
        />
      )}
    </div>
  );
}

function ConversationsPane({ threads, loading }) {
  if (loading) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-[#6B7280] md:px-8">
        Loading conversations…
      </p>
    );
  }
  if (!threads.length) {
    return (
      <div
        className="mx-4 my-6 flex flex-col items-center gap-2 rounded-[12px] border border-[#E5E7EB] px-4 py-12 text-center md:mx-8"
        data-testid="conversations-empty"
      >
        <MessageCircle className="h-10 w-10 text-[#9CA3AF]" />
        <h3 className="mt-2 text-[15px] font-semibold text-[#111111]">
          No active conversations yet
        </h3>
        <p className="max-w-[320px] text-[13px] text-[#6B7280]">
          When a driver accepts your booking and you pay the deposit, you can
          chat with them here.
        </p>
      </div>
    );
  }
  return (
    <ul
      className="mx-4 my-2 divide-y divide-[#F3F4F6] overflow-hidden rounded-[12px] border border-[#E5E7EB] md:mx-8"
      data-testid="conversations-list"
    >
      {threads.map((t) => (
        <ConversationRow key={t.booking_id} t={t} />
      ))}
    </ul>
  );
}

function ConversationRow({ t }) {
  const initials = (t.counterparty?.name || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const last = t.last_message;
  // "Sent"/"Delivered"/"Read" indicator for the customer's OWN last message.
  let tick = null;
  if (last && last.mine) {
    if (last.read_at) tick = <span className="text-[#D62828] font-semibold">✓✓ Read</span>;
    else if (last.delivered_at) tick = <span>✓✓ Delivered</span>;
    else tick = <span>✓ Sent</span>;
  }
  const preview = last
    ? last.moderated
      ? "Contact details were hidden by Cargo One."
      : last.has_photo && !last.text
      ? "📷 Photo"
      : last.text || ""
    : "No messages yet — say hi 👋";
  return (
    <li>
      <Link
        to={`/customer/booking/${t.booking_id}#chat`}
        data-testid={`conversation-row-${t.booking_id}`}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
      >
        {t.counterparty?.profile_photo ? (
          <img
            src={t.counterparty.profile_photo}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[13px] font-bold text-white">
            {initials || "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-semibold text-[#111111]">
              {t.counterparty?.name || "Driver"}
            </span>
            <span className="shrink-0 text-[11px] text-[#9CA3AF]">
              {last ? formatShortWhen(last.created_at) : ""}
            </span>
          </div>
          <p
            className={`mt-0.5 truncate text-[13px] ${
              t.unread_count > 0 && last && !last.mine
                ? "font-semibold text-[#111111]"
                : "text-[#6B7280]"
            }`}
            data-testid={`conversation-preview-${t.booking_id}`}
          >
            {last?.mine ? (
              <span className="text-[#9CA3AF]">You: </span>
            ) : null}
            {preview}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-[#9CA3AF]">
              {t.job_title}
              {t.pickup_town && t.dropoff_town
                ? ` · ${t.pickup_town} → ${t.dropoff_town}`
                : ""}
            </span>
            {last?.mine ? (
              <span className="shrink-0 text-[10px] text-[#6B7280]">{tick}</span>
            ) : t.unread_count > 0 ? (
              <span
                className="shrink-0 rounded-full bg-[#D62828] px-2 py-0.5 text-[11px] font-bold text-white"
                data-testid={`conversation-unread-${t.booking_id}`}
              >
                {t.unread_count > 99 ? "99+" : t.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

function NotificationsPane({ listItems, loading, selected, onPick, onClose, draft, setDraft, chimeEnabled, onToggleChime }) {
  return (
    <div className="grid gap-4 px-4 md:grid-cols-[minmax(260px,320px)_1fr] md:px-8">
      <section
        className={`rounded-[12px] border border-[#E5E7EB] bg-white ${
          selected ? "hidden md:block" : ""
        }`}
        data-testid="messages-list"
      >
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-4 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#6B7280]">
            Updates
          </p>
          {onToggleChime ? (
            <button
              type="button"
              onClick={onToggleChime}
              aria-label={chimeEnabled ? "Mute notification chime" : "Unmute notification chime"}
              aria-pressed={!!chimeEnabled}
              data-testid="customer-notif-chime-toggle"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                chimeEnabled ? "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]" : "bg-[#F4F4F4] text-[#9CA3AF] hover:bg-[#E5E7EB]"
              }`}
              title={chimeEnabled ? "Chime on new notifications" : "Chime muted"}
            >
              {chimeEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        {loading ? (
          <p className="px-4 py-4 text-[13px] text-[#6B7280]">Loading…</p>
        ) : listItems.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 px-4 py-12 text-center"
            data-testid="messages-empty"
          >
            <MessagesSquare className="h-10 w-10 text-[#9CA3AF]" />
            <h3 className="mt-2 text-[15px] font-semibold text-[#111111]">
              No notifications
            </h3>
            <p className="text-[13px] text-[#6B7280]">
              Updates about your shipments will appear here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[70vh] divide-y divide-[#F3F4F6] overflow-y-auto">
            {listItems.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onPick(n)}
                  data-testid={`notification-row-${n.id}`}
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
        data-testid="messages-thread"
      >
        {selected ? (
          <>
            <div className="flex items-start gap-2 border-b border-[#E5E7EB] px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to notifications"
                data-testid="notification-back-button"
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
                  ? `/customer/booking/${bookingId}`
                  : jobId
                  ? `/customer/job/${jobId}`
                  : null;
                if (!target) return null;
                return (
                  <div className="mt-4">
                    <Link
                      to={target}
                      data-testid="notification-open-link"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#D62828]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {bookingId ? "Open booking" : "Open job"}
                    </Link>
                  </div>
                );
              })()}
            </div>
            <div
              className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3"
              data-testid="messages-compose-disabled"
            >
              <div className="flex items-start gap-2 rounded-[10px] bg-white px-3 py-2 opacity-70">
                <Lock className="mt-2 h-4 w-4 shrink-0 text-[#9CA3AF]" />
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled
                  rows={2}
                  placeholder="Reply to a booking thread…"
                  className="flex-1 resize-none bg-transparent text-[14px] text-[#111111] placeholder:text-[#9CA3AF] outline-none disabled:cursor-not-allowed"
                  data-testid="messages-compose-input"
                />
                <button
                  type="button"
                  disabled
                  data-testid="messages-compose-send"
                  className="cursor-not-allowed rounded-full bg-[#E5E7EB] px-4 py-1.5 text-[13px] font-semibold text-[#6B7280]"
                >
                  Send
                </button>
              </div>
              <p className="mt-2 text-[12px] text-[#6B7280]">
                Open a conversation from the "Conversations" tab to send a
                reply directly to your driver.
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <MessagesSquare className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[14px] text-[#6B7280]">
              Select a notification to read.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function TabButton({ active, onClick, testId, badge, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`relative flex flex-1 items-center justify-center rounded-full py-2 text-[13px] font-medium transition-colors ${
        active ? "bg-[#111111] text-white" : "text-[#6B7280] hover:text-[#111111]"
      }`}
    >
      {children}
      {badge > 0 ? (
        <span
          className={`ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
            active ? "bg-white text-[#D62828]" : "bg-[#D62828] text-white"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function formatWhen(iso, long = false) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return long ? d.toLocaleString() : d.toLocaleDateString();
  } catch {
    return String(iso);
  }
}

function formatShortWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}
