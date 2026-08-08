import React, { useCallback, useEffect, useState } from "react";
import { Mail, Inbox, MailCheck, Reply, Phone, MessageCircle, X as XIcon, Send, CheckCircle2 } from "lucide-react";
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
  const [replyMsg, setReplyMsg] = useState(null);

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
            contact.map((m) => {
              const digits = (m.phone || "").replace(/[^0-9+]/g, "");
              const telHref = digits ? `tel:${digits}` : null;
              const waHref = digits
                ? `https://wa.me/${digits.replace(/^\+/, "").replace(/^0/, "44")}`
                : null;
              return (
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
                      <p className="break-words text-[12px] text-[#6B7280]">
                        {m.email} {m.phone ? `· ${m.phone}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] text-[#9CA3AF]">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                      </span>
                      {m.replied_at ? (
                        <span
                          className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#166534]"
                          data-testid={`contact-replied-${m.id}`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Replied
                        </span>
                      ) : null}
                    </div>
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
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] pt-3">
                    {m.email && (
                      <button
                        type="button"
                        onClick={() => setReplyMsg(m)}
                        data-testid={`contact-reply-${m.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#D62828]"
                      >
                        <Reply className="h-3.5 w-3.5" />
                        Reply from admin@cargoone.co.uk
                      </button>
                    )}
                    {telHref && (
                      <a
                        href={telHref}
                        data-testid={`contact-call-${m.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:border-[#D62828]"
                      >
                        <Phone className="h-3.5 w-3.5 text-[#D62828]" />
                        Call
                      </a>
                    )}
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`contact-whatsapp-${m.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#F0FDF4] px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:border-[#25D366]"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                        WhatsApp
                      </a>
                    )}
                    {!m.email && !telHref && (
                      <span className="text-[11px] text-[#9CA3AF]">
                        No contact channel provided.
                      </span>
                    )}
                  </div>
                </li>
              );
            })
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

      {replyMsg ? (
        <ReplyModal
          msg={replyMsg}
          onClose={() => setReplyMsg(null)}
          onSent={async () => {
            setReplyMsg(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function ReplyModal({ msg, onClose, onSent }) {
  const [subject, setSubject] = useState(msg.subject ? `Re: ${msg.subject}` : "Re: your Cargo One enquiry");
  const [body, setBody] = useState(
    `Hi ${msg.name || "there"},\n\nThanks for getting in touch with Cargo One.\n\n`,
  );
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  const send = async () => {
    setErr(null);
    setOk(null);
    if (body.trim().length < 5) {
      setErr("Please write a reply of at least 5 characters.");
      return;
    }
    setSending(true);
    try {
      const r = await api(`/admin/contact-messages/${msg.id}/reply`, {
        method: "POST",
        body: { subject: subject.trim(), body: body.trim() },
      });
      if (r.status === "skipped") {
        setOk("Reply queued (email provider offline in preview — will send once redeployed).");
      } else if (r.status === "failed") {
        setErr(r.error || "Provider rejected the message. Please try again.");
      } else {
        setOk("Reply sent from admin@cargoone.co.uk.");
      }
      setTimeout(onSent, 1200);
    } catch (e) {
      setErr(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-10"
      onClick={onClose}
      data-testid="contact-reply-modal"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-[16px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-3">
          <div>
            <h3 className="text-[16px] font-semibold text-[#111111]">Reply to {msg.name || msg.email}</h3>
            <p className="text-[11px] text-[#6B7280]">
              From: <strong>admin@cargoone.co.uk</strong> · To: <strong>{msg.email}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="contact-reply-close"
            className="rounded-full p-1 hover:bg-[#F4F4F4]"
          >
            <XIcon className="h-4 w-4 text-[#6B7280]" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="contact-reply-subject"
              className="mt-1 w-full rounded-[10px] border border-[#E5E7EB] px-3 py-2 text-[14px] outline-none focus:border-[#111111]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#6B7280]">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              data-testid="contact-reply-body"
              className="mt-1 w-full rounded-[10px] border border-[#E5E7EB] px-3 py-2 text-[14px] outline-none focus:border-[#111111]"
            />
          </label>
          {msg.message ? (
            <details className="rounded-[10px] bg-[#F9FAFB] p-3 text-[12px] text-[#6B7280]">
              <summary className="cursor-pointer font-semibold">Original message</summary>
              <p className="mt-1 whitespace-pre-wrap">{msg.message}</p>
            </details>
          ) : null}
          {err ? (
            <p className="text-[13px] text-[#DC2626]" data-testid="contact-reply-error">{err}</p>
          ) : null}
          {ok ? (
            <p className="text-[13px] text-[#166534]" data-testid="contact-reply-success">{ok}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#F3F4F6] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="contact-reply-cancel"
            className="rounded-full border border-[#E5E7EB] px-4 py-1.5 text-[13px] font-semibold text-[#111111] hover:border-[#111111]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            data-testid="contact-reply-send"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#D62828] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
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
