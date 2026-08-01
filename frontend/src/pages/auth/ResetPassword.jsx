import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { SEO } from "@/components/marketing/SEO";

function roleLanding(role) {
  if (role === "customer") return "/customer";
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return "/";
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const token = useMemo(() => (params.get("token") || "").trim(), [params]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const missingToken = !token;

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate("/auth/login", { replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [done, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api("/auth/reset-password", {
        method: "POST",
        body: { token, new_password: password },
      });
      // Backend already set the session cookie. Hydrate context and mark done.
      const me = await refresh().catch(() => null);
      setDone(true);
      // If session hydration worked, we can auto-land on the role dashboard.
      if (me?.role) {
        setTimeout(() => navigate(roleLanding(me.role), { replace: true }), 1500);
      } else if (res?.user?.role) {
        setTimeout(() => navigate(roleLanding(res.user.role), { replace: true }), 1500);
      }
    } catch (err) {
      setError(err?.message || "Could not reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SEO
        title="Reset password | Cargo One"
        description="Set a new password for your Cargo One account."
        path="/auth/reset"
      />
      <div className="min-h-screen bg-white" data-testid="reset-password-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-6 py-6">
          <button
            type="button"
            onClick={() => navigate("/auth/login")}
            data-testid="back-button"
            aria-label="Back"
            className="mb-4 self-start p-1 text-[#111111]"
          >
            <ChevronLeft className="h-[26px] w-[26px]" />
          </button>

          {missingToken ? (
            <div data-testid="reset-password-missing-token">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3F3]">
                <ShieldAlert className="h-6 w-6 text-[#D62828]" />
              </div>
              <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#111111]">
                Invalid reset link
              </h1>
              <p className="mt-2 text-[16px] leading-relaxed text-[#6B7280]">
                This link is missing its reset token. Request a new one to continue.
              </p>
              <Link
                to="/auth/forgot-password"
                data-testid="request-new-link-button"
                className="mt-8 block h-12 w-full rounded-full bg-[#D62828] text-center text-[16px] font-bold leading-[48px] text-white transition-colors hover:bg-[#B01F1F]"
              >
                Request a new link
              </Link>
            </div>
          ) : done ? (
            <div data-testid="reset-password-success">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5]">
                <CheckCircle2 className="h-6 w-6 text-[#059669]" />
              </div>
              <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#111111]">
                Password updated
              </h1>
              <p className="mt-2 text-[16px] leading-relaxed text-[#6B7280]">
                Your password has been reset. Signing you back in…
              </p>
              <Link
                to="/auth/login"
                data-testid="continue-button"
                className="mt-8 block h-12 w-full rounded-full bg-[#111111] text-center text-[16px] font-bold leading-[48px] text-white transition-colors hover:bg-[#000]"
              >
                Continue
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#111111]">
                Set new password
              </h1>
              <p className="mt-1 text-[16px] text-[#6B7280]">
                Choose a strong password — at least 8 characters.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#111111]">
                    New password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    data-testid="reset-password-input"
                    className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#111111]">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your new password"
                    data-testid="reset-password-confirm-input"
                    className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
                  />
                </div>

                {error && (
                  <p data-testid="reset-password-error" className="text-[14px] font-medium text-[#DC2626]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  data-testid="reset-password-submit-button"
                  className="mt-2 h-12 w-full rounded-full bg-[#D62828] text-[16px] font-bold text-white transition-colors hover:bg-[#B01F1F] disabled:opacity-60"
                >
                  {loading ? "Updating…" : "Update password"}
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
