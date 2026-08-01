import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SEO } from "@/components/marketing/SEO";

function roleLanding(role) {
  if (role === "customer") return "/customer";
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return "/";
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await login(email.trim(), password);
      navigate(roleLanding(me?.role), { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SEO title="Log in | Cargo One" description="Sign in to your Cargo One account." path="/auth/login" />
      <div className="min-h-screen bg-white" data-testid="login-screen">
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

          <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#111111]">Welcome back</h1>
          <p className="mt-1 text-[16px] text-[#6B7280]">Log in to continue your shipments.</p>

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
                data-testid="login-email-input"
                className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="login-password-input"
                className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
              />
            </div>

            {error && (
              <p data-testid="login-error" className="text-[14px] font-medium text-[#DC2626]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="mt-2 h-12 w-full rounded-full bg-[#D62828] text-[16px] font-bold text-white transition-colors hover:bg-[#B01F1F] disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>

          <Link
            to="/auth/forgot-password"
            data-testid="forgot-password-link"
            className="mt-4 block py-1 text-center text-[14px] font-semibold text-[#D62828] hover:underline"
          >
            Forgot password?
          </Link>

          <Link
            to="/auth/register?role=customer"
            replace
            data-testid="go-register-button"
            className="mt-2 block py-2 text-center text-[14px] text-[#6B7280]"
          >
            New here? <span className="font-semibold text-[#D62828]">Create an account</span>
          </Link>
        </div>
      </div>
    </>
  );
}
