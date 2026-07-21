import React, { useCallback, useEffect, useState } from "react";
import { Mail, Inbox, MailCheck } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Operational Queues — Contact Messages + Newsletter Subscribers.
 *
 * These endpoints exist in the current backend
 * (`/api/admin/contact-messages`, `/api/admin/newsletter-subscribers`) but no
 * dedicated screen for them exists in the Expo source. Because the Cargo One
 * source used the marketing website to collect these but the backend already
 * supports admin queues, we port them as a lightweight admin view — no new
 * business logic, purely a read-only surface for the existing contract.
 * Marked as "beyond-Expo, source-backend-supported" in the completion report.
 */
export default function AdminQueues() {
  const [tab, setTab] = useState("contact");
  const [contact, setContact] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api("/admin/contact-messages").catch(() => []),
        api("/admin/newsletter-subscribers").catch(() => []),
      ]);
      setContact(Array.isArray(c) ? c : []);
      setSubs(Array.isArray(s) ? s : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-queues">
      <header className="px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">
          Operational Queues
        </h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Contact messages and newsletter subscribers.
        </p>
      </header>

      <div
        className="mx-4 mt-3 flex rounded-full bg-[#F4F4F4] p-1 md:mx-8"
        data-testid="queue-tabs"
      >
        <TabBtn active={tab === "contact"} onClick={() => setTab("contact")} testID="queue-tab-contact">
          Contact ({contact.length})
        </TabBtn>
        <TabBtn active={tab === "newsletter"} onClick={() => setTab("newsletter")} testID="queue-tab-newsletter">
          Newsletter ({subs.length})
        </TabBtn>
      </div>

      {loading && (
        <p className="mx-4 mt-3 text-[13px] text-[#6B7280] md:mx-8">Loading…</p>
      )}

      {tab === "contact" ? (
        <ul className="mx-4 mt-3 space-y-3 md:mx-8">
          {contact.length === 0 ? (
            <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="contact-empty">
              <Inbox className="h-10 w-10 text-[#9CA3AF]" />
              <p className="text-[13px] text-[#6B7280]">
                No contact messages yet.
              </p>
            </li>
          ) : (
            contact.map((m) => (
              <li
                key={m.id}
                className="rounded-[12px] border border-[#E5E7EB] p-4"
                data-testid={`contact-row-${m.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[#111111]">
                      {m.name || "Anonymous"}
                    </p>
                    <p className="text-[12px] text-[#6B7280]">
                      {m.email} {m.phone ? `· ${m.phone}` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#9CA3AF]">
                    {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                  </span>
                </div>
                {m.subject && (
                  <p className="mt-1 text-[13px] font-semibold text-[#111111]">
                    {m.subject}
                  </p>
                )}
                {m.message && (
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#111111]">
                    {m.message}
                  </p>
                )}
              </li>
            ))
          )}
        </ul>
      ) : (
        <ul className="mx-4 mt-3 space-y-2 md:mx-8">
          {subs.length === 0 ? (
            <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="newsletter-empty">
              <MailCheck className="h-10 w-10 text-[#9CA3AF]" />
              <p className="text-[13px] text-[#6B7280]">
                No newsletter subscribers yet.
              </p>
            </li>
          ) : (
            subs.map((s) => (
              <li
                key={s.id || s.email}
                className="flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] p-3"
                data-testid={`newsletter-row-${s.id || s.email}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F4]">
                  <Mail className="h-4 w-4 text-[#111111]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#111111]">
                    {s.email}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                    s.active !== false
                      ? "bg-[#DCFCE7] text-[#16A34A]"
                      : "bg-[#F4F4F4] text-[#6B7280]"
                  }`}
                >
                  {s.active !== false ? "Active" : "Unsub"}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, testID, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className={`flex-1 rounded-full py-2 text-[13px] font-semibold ${
        active ? "bg-[#111111] text-white" : "text-[#6B7280]"
      }`}
    >
      {children}
    </button>
  );
}
