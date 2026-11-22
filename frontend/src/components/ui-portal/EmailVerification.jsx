import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function useBotFields() {
  const startedAt = useRef(Date.now());
  const [website, setWebsite] = useState("");
  const field = (
    <input
      type="text"
      name="company_website"
      value={website}
      onChange={(e) => setWebsite(e.target.value)}
      autoComplete="off"
      tabIndex={-1}
      aria-hidden="true"
      className="absolute -left-[9999px] h-0 w-0 opacity-0"
      data-testid="signup-honeypot"
    />
  );
  const payload = () => ({
    company_website: website,
    form_started_at: startedAt.current,
    form_elapsed_ms: Date.now() - startedAt.current,
  });
  return { field, payload };
}

function useCountdown() {
  const [left, setLeft] = useState(60);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(60)];
}

export function EmailCodeStep({ email, onVerified, onBack, onSkip, autoSend = false, cta = "Verify & post job" }) {
  const { refresh } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, restart] = useCountdown();
  const sent = useRef(false);

  const resend = async (auto = false) => {
    setError(null);
    try {
      await api("/auth/resend-code", { method: "POST" });
      setInfo("A new code is on its way.");
      setCode("");
      restart();
    } catch (e) {
      if (auto && e?.status === 429) setInfo("We've already sent you a code — check your inbox.");
      else setError(e?.message || "Could not send a new code.");
    }
  };

  useEffect(() => {
    if (autoSend && !sent.current) {
      sent.current = true;
      resend(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  const verify = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/auth/verify-email", { method: "POST", body: { code: code.trim() } });
      await refresh();
      onVerified();
    } catch (err) {
      setError(err?.message || "That code isn't right.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="email-code-step">
      <h2 className="text-[24px] font-bold leading-tight text-[#111111]">Check your email</h2>
      <p className="mb-4 mt-2 text-[14px] text-[#374151]">
        We've sent a 6-digit code to <span className="font-semibold">{email}</span>. Enter it to {onSkip ? "post jobs" : "post your job"}.
      </p>
      <form onSubmit={verify} className="space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          data-testid="email-code-input"
          className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 text-center text-[24px] font-bold tracking-[8px] text-[#111111] outline-none focus:border-[#111111]"
        />
        {info && !error ? <p className="text-[13px] text-[#16A34A]" data-testid="email-code-info">{info}</p> : null}
        {error ? <p className="text-[13px] text-[#DC2626]" data-testid="email-code-error">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          data-testid="email-code-verify"
          className="w-full rounded-full bg-[#D62828] py-4 text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
        >
          {busy ? "Checking…" : cta}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <button type="button" disabled={left > 0} onClick={() => resend()} data-testid="email-code-resend" className="font-semibold text-[#D62828] disabled:text-[#9CA3AF]">
          {left > 0 ? `Resend code in ${left}s` : "Resend code"}
        </button>
        {onBack ? (
          <button type="button" onClick={onBack} data-testid="email-code-back" className="text-[#6B7280] underline">
            Wrong email? Go back
          </button>
        ) : null}
        {onSkip ? (
          <button type="button" onClick={onSkip} data-testid="email-code-skip" className="text-[#6B7280] underline">
            I'll do this later
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);
  if (!user || user.email_verified !== false) return null;
  if (open) {
    return (
      <div className="mx-4 mt-4 max-w-[480px] rounded-[12px] border border-[#E5E7EB] p-4 md:mx-8" data-testid="verify-email-banner-code">
        <EmailCodeStep email={user.email} onVerified={() => setOpen(false)} onSkip={() => setOpen(false)} cta="Verify email" />
      </div>
    );
  }
  const resend = async () => {
    try {
      await api("/auth/resend-code", { method: "POST" });
      setState("A new code and link are on their way — check your email.");
    } catch (e) {
      setState(e?.message || "Could not send a new code.");
    }
  };
  return (
    <div className="mx-4 mt-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-[#F59E0B] bg-[#FFFBEB] px-4 py-3 text-[13px] text-[#78350F] md:mx-8" data-testid="verify-email-banner">
      <span>{user.role === "driver" ? "Please verify your email address." : "Verify your email to post jobs."}</span>
      <button type="button" onClick={() => setOpen(true)} data-testid="verify-email-banner-enter" className="font-bold underline">
        Enter code
      </button>
      <button type="button" onClick={resend} data-testid="verify-email-banner-resend" className="font-bold underline">
        Resend code
      </button>
      {state ? <span data-testid="verify-email-banner-state">{state}</span> : null}
    </div>
  );
}
