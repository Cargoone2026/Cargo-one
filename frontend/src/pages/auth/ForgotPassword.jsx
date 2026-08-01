import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, MailCheck } from "lucide-react";
import { api } from "@/lib/api";
import { SEO } from "@/components/marketing/SEO";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      // Backend always returns 200 regardless of whether the email exists
      // (anti-enumeration). We surface a single generic success state.
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setSent(true);
    } catch (err) {
      // Only network / server errors bubble up here.
      setError(err?.message || "Could not send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SEO
        title="Forgot password | Cargo One"
        description="Reset your Cargo One password securely by email."
        path="/auth/forgot-password"
      />
      <div className="min-h-screen bg-white" data-testid="forgot-password-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-6 py-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            data-testid="back-button"
            aria-label="Back"
            className="mb-4 self-start p-1 text-[#111111]"
          >
            <ChevronLeft className="h-[26px] w-[26px]" />
          </button>

          {sent ? (
            <div data-testid="forgot-password-success">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3F3]">
                <MailCheck className="h-6 w-6 text-[#D62828]" />
              </div>
              <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#111111]">
                Check your inbox
              </h1>
              <p className="mt-2 text-[16px] leading-relaxed text-[#6B7280]">
                If an account exists for <span className="font-semibold text-[#111111]">{email.trim()}</span>,
                we've sent a link to reset your password. The link expires in 60 minutes.
              </p>
              <p className="mt-4 text-[14px] text-[#6B7280]">
                Didn't get an email? Check your spam folder, or{" "}
                <button
                  type="button"
                  data-testid="forgot-password-try-again"
                  onClick={() => { setSent(false); setError(null); }}
                  className="font-semibold text-[#D62828] hover:underline"
                >
                  try again
                </button>
                .
              </p>
              <Link
                to="/auth/login"
                data-testid="back-to-login-button"
                className="mt-8 block h-12 w-full rounded-full bg-[#111111] text-center text-[16px] font-bold leading-[48px] text-white transition-colors hover:bg-[#000]"
              >
                Back to log in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#111111]">
                Forgot password?
              </h1>
              <p className="mt-1 text-[16px] text-[#6B7280]">
                Enter the email on your account and we'll send you a secure reset link.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    data-testid="forgot-password-email-input"
                    className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
                  />
                </div>

                {error && (
                  <p data-testid="forgot-password-error" className="text-[14px] font-medium text-[#DC2626]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  data-testid="forgot-password-submit-button"
                  className="mt-2 h-12 w-full rounded-full bg-[#D62828] text-[16px] font-bold text-white transition-colors hover:bg-[#B01F1F] disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <Link
                to="/auth/login"
                replace
                data-testid="go-login-button"
                className="mt-6 block py-2 text-center text-[14px] text-[#6B7280]"
              >
                Remembered it? <span className="font-semibold text-[#D62828]">Log in</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
