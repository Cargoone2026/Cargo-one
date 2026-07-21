import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, MessagesSquare, Lock } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Customer inbox — Stage 2A-i (read-oriented).
 *
 * Backend endpoint /api/notifications is the canonical inbox in the
 * Cargo One source app, so we preserve the visual structure of the
 * original messages screen. Marking notifications as read is a safe
 * existing API contract (POST /notifications/:id/read).
 *
 * The compose box is intentionally rendered but DISABLED with a clear
 * label — transactional booking-thread messaging (POST
 * /bookings/:id/messages) is scoped for Stage 2A-ii.
 */
export default function CustomerMessages() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const n = await api("/notifications").catch(() => []);
      const list = Array.isArray(n) ? n : [];
      setNotes(list);
      if (list.length && !selected) setSelected(list[0]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = useCallback(
    async (id) => {
      try {
        await api(`/notifications/${id}/read`, { method: "POST" });
        setNotes((ns) =>
          ns.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      } catch {
        // silent
      }
    },
    [],
  );

  const pick = (n) => {
    setSelected(n);
    if (!n.read) markRead(n.id);
  };

  const listItems = useMemo(() => notes, [notes]);

  return (
    <div className="min-h-screen bg-white" data-testid="customer-messages">
      <header className="px-4 pt-6 pb-3 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
          Inbox
        </h1>
      </header>

      <div className="grid gap-4 px-4 md:grid-cols-[minmax(260px,320px)_1fr] md:px-8">
        {/* List */}
        <section
          className="rounded-[12px] border border-[#E5E7EB] bg-white"
          data-testid="messages-list"
        >
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
                    onClick={() => pick(n)}
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

        {/* Thread pane */}
        <section
          className="flex min-h-[420px] flex-col rounded-[12px] border border-[#E5E7EB] bg-white"
          data-testid="messages-thread"
        >
          {selected ? (
            <>
              <div className="border-b border-[#E5E7EB] px-5 py-4">
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
              <div className="flex-1 overflow-y-auto px-5 py-4 text-[14px] leading-relaxed text-[#111111]">
                {selected.body}
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
                  Messaging actions will be enabled in the next migration
                  stage.
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
    </div>
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
