import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Car, ChevronLeft, Info, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SEO } from "@/components/marketing/SEO";

function roleLanding(role) {
  if (role === "customer") return "/customer";
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return "/";
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [params] = useSearchParams();
  const initialRole = params.get("role") === "driver" ? "driver" : "customer";
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("All fields required");
      return;
    }
    setLoading(true);
    try {
      const me = await register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone,
        role,
      });
      navigate(roleLanding(me?.role), { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SEO
        title="Create account | Cargo One"
        description="Join the Cargo One marketplace — sign up as a customer to send items, or as a driver to earn."
        path="/auth/register"
      />
      <div className="min-h-screen bg-white" data-testid="register-screen">
        <div className="mx-auto w-full max-w-[500px] px-6 py-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            data-testid="back-button"
            aria-label="Back"
            className="mb-4 self-start p-1 text-[#111111]"
          >
            <ChevronLeft className="h-[26px] w-[26px]" />
          </button>

          <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#111111]">Create account</h1>
          <p className="mb-6 mt-1 text-[16px] text-[#6B7280]">Join the Cargo One marketplace.</p>

          {/* Role tabs */}
          <div className="mb-4 flex gap-1 rounded-full bg-[#F4F4F4] p-1">
            <button
              type="button"
              onClick={() => setRole("customer")}
              data-testid="role-customer-tab"
              className={`flex flex-1 items-center justify-center gap-1 rounded-full py-3 text-[14px] font-medium transition-colors ${
                role === "customer" ? "bg-[#111111] text-white" : "text-[#6B7280]"
              }`}
            >
              <User className="h-[18px] w-[18px]" />
              I need to ship
            </button>
            <button
              type="button"
              onClick={() => setRole("driver")}
              data-testid="role-driver-tab"
              className={`flex flex-1 items-center justify-center gap-1 rounded-full py-3 text-[14px] font-medium transition-colors ${
                role === "driver" ? "bg-[#111111] text-white" : "text-[#6B7280]"
              }`}
            >
              <Car className="h-[18px] w-[18px]" />
              I'm a driver
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Full name</label>
              <input
                value={form.name}
                onChange={upd("name")}
                placeholder="Jane Doe"
                autoComplete="name"
                data-testid="register-name-input"
                className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={upd("email")}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                data-testid="register-email-input"
                className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Phone (optional)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={upd("phone")}
                placeholder="+44 700 900 000"
                autoComplete="tel"
                data-testid="register-phone-input"
                className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#111111]">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={upd("password")}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                data-testid="register-password-input"
                className="h-12 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[16px] text-[#111111] outline-none focus:border-[#D62828]"
              />
            </div>

            {role === "driver" && (
              <div className="flex items-start gap-2 rounded-[12px] bg-[#FFF7ED] p-3">
                <Info className="h-[18px] w-[18px] flex-shrink-0 text-[#FF6A00]" />
                <p className="text-[14px] leading-snug text-[#6B7280]">
                  Driver accounts require admin approval and document upload after registration.
                </p>
              </div>
            )}

            {error && (
              <p data-testid="register-error" className="text-[14px] font-medium text-[#DC2626]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="register-submit-button"
              className="mt-2 h-12 w-full rounded-full bg-[#D62828] text-[16px] font-bold text-white transition-colors hover:bg-[#B01F1F] disabled:opacity-60"
            >
              {loading
                ? "Creating…"
                : role === "driver"
                ? "Create driver account"
                : "Create account"}
            </button>
          </form>

          <Link
            to="/auth/login"
            replace
            data-testid="go-login-button"
            className="mt-6 block py-2 text-center text-[14px] text-[#6B7280]"
          >
            Have an account? <span className="font-semibold text-[#D62828]">Log in</span>
          </Link>
        </div>
      </div>
    </>
  );
}
