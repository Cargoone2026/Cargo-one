import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isValidPhone } from "@/lib/validators";
import { trackConversion } from "@/lib/analytics";

export function NonCustomerNote({ user }) {
  const { logout } = useAuth();
  return (
    <div className="rounded-[12px] border border-[#F59E0B] bg-[#FFFBEB] p-4 text-[14px] text-[#78350F]" data-testid="quote-non-customer-note">
      You're signed in as a {user?.role === "admin" ? "admin" : "driver"}. Log out and use a customer account to post a job.
      <button type="button" onClick={logout} data-testid="quote-non-customer-logout" className="ml-2 font-bold underline">
        Log out
      </button>
    </div>
  );
}

function Field({ label, hint, testId, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-[#111111]">{label}</label>
      <input
        {...props}
        data-testid={testId}
        className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#111111] outline-none focus:border-[#111111]"
      />
      {hint ? <p className="mt-1 text-[12px] text-[#6B7280]">{hint}</p> : null}
    </div>
  );
}

export function QuoteAccountStep({ summary, onCustomer, onBack }) {
  const { register, login, user } = useAuth();
  const [tab, setTab] = useState("register");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (tab === "register") {
      if (!form.name.trim() || !form.email.trim() || !form.password) return setError("Name, email and password are required.");
      if (form.phone && !isValidPhone(form.phone)) return setError("Please enter a valid phone number (e.g. 07700 900 123 or +44 7700 900123).");
      if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    } else if (!form.email.trim() || !form.password) {
      return setError("Email and password are required.");
    }
    setLoading(true);
    try {
      const me = tab === "register"
        ? await register({ email: form.email.trim(), password: form.password, name: form.name.trim(), phone: form.phone.trim() || null, role: "customer" })
        : await login(form.email.trim(), form.password);
      if (tab === "register") trackConversion("sign_up", { method: "email", role: "customer" });
      if (me?.role === "customer") onCustomer();
    } catch (err) {
      if (tab === "register" && /already registered/i.test(err?.message || "")) {
        setTab("login");
        setForm((f) => ({ ...f, password: "" }));
        setInfo("You already have an account — log in to post your job.");
      } else {
        setError(err?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const tabBtn = (key, label) => (
    <button
      type="button"
      onClick={() => { setTab(key); setError(null); }}
      data-testid={`quote-account-tab-${key}`}
      className={`flex-1 rounded-full py-3 text-[14px] font-medium transition-colors ${tab === key ? "bg-[#111111] text-white" : "text-[#6B7280]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[560px] px-6 py-6" data-testid="quote-account-step">
      <button type="button" onClick={onBack} aria-label="Back" data-testid="quote-account-back" className="mb-4 p-1 text-[#111111]">
        <ChevronLeft className="h-[26px] w-[26px]" />
      </button>
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.5px] text-[#111111]">
        Almost done — create your free account to get quotes
      </h1>
      <p className="mb-6 mt-2 rounded-[12px] bg-[#F4F4F4] px-4 py-3 text-[14px] text-[#111111]" data-testid="quote-account-summary">
        {summary}
      </p>
      {user && user.role !== "customer" ? (
        <NonCustomerNote user={user} />
      ) : (
        <>
          <div className="mb-4 flex gap-1 rounded-full bg-[#F4F4F4] p-1">
            {tabBtn("register", "Create account")}
            {tabBtn("login", "I already have an account")}
          </div>
          {info && tab === "login" ? (
            <p className="mb-3 rounded-[10px] bg-[#FFF7ED] px-3 py-2 text-[13px] text-[#111111]" data-testid="quote-account-info">{info}</p>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-3">
            {tab === "register" ? (
              <Field label="Full name" value={form.name} onChange={upd("name")} placeholder="Jane Doe" autoComplete="name" testId="quote-account-name" />
            ) : null}
            <Field label="Email" type="email" value={form.email} onChange={upd("email")} placeholder="you@example.com" autoComplete="email" testId="quote-account-email" />
            {tab === "register" ? (
              <Field label="Phone" type="tel" value={form.phone} onChange={upd("phone")} placeholder="07700 900 123" autoComplete="tel" hint="UK mobile or landline. Optional but recommended." testId="quote-account-phone" />
            ) : null}
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={upd("password")}
              placeholder={tab === "register" ? "At least 8 characters" : "Your password"}
              autoComplete={tab === "register" ? "new-password" : "current-password"}
              testId="quote-account-password"
            />
            {tab === "login" ? (
              <Link to="/auth/forgot-password" className="block text-right text-[13px] font-semibold text-[#D62828]" data-testid="quote-account-forgot">
                Forgot password?
              </Link>
            ) : null}
            {error ? <p className="text-[13px] text-[#DC2626]" data-testid="quote-account-error">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              data-testid="quote-account-submit"
              className="w-full rounded-full bg-[#D62828] py-4 text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
            >
              {loading ? "Please wait…" : tab === "register" ? "Create account & get quotes" : "Log in & get quotes"}
            </button>
          </form>
          <p className="mt-4 text-center text-[12px] text-[#6B7280]">
            By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and{" "}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
          <p className="mt-2 text-center text-[13px] text-[#6B7280]">
            Are you a driver?{" "}
            <Link to="/auth/register?role=driver" className="font-semibold text-[#D62828]" data-testid="quote-account-driver-link">Sign up here</Link>
          </p>
        </>
      )}
    </div>
  );
}
