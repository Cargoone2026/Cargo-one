import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Package, Twitter } from "lucide-react";
import { api } from "@/lib/api";

const COLUMNS = [
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Trust & Safety", href: "/trust-safety" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Parcels & Packages", href: "/services" },
      { label: "Pallets & Freight", href: "/services" },
      { label: "House Moves", href: "/services" },
      { label: "Vehicles", href: "/services" },
      { label: "Business Accounts", href: "/business" },
    ],
  },
  {
    heading: "Drivers",
    links: [
      { label: "Become a Driver", href: "/drivers#earnings" },
      { label: "Driver Requirements", href: "/drivers#requirements" },
      { label: "Earnings", href: "/drivers#why-drive" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/settings/privacy" },
      { label: "Terms of Service", href: "/settings/terms" },
      { label: "Cookie Policy", href: "/settings/cookies" },
      { label: "FAQ", href: "/faq" },
    ],
  },
];

export function MarketingFooter() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!email.includes("@")) {
      setStatus({ type: "error", msg: "Please enter a valid email address." });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      await api("/newsletter/subscribe", { method: "POST", body: { email } });
      setStatus({ type: "ok", msg: "Thanks — you're on the list!" });
      setEmail("");
    } catch (err) {
      setStatus({
        type: "error",
        msg: err?.message || "Signup failed. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const socials = [
    { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
    { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
    { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
    { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
  ];

  return (
    <footer className="w-full bg-[#0B0B0F]" data-testid="marketing-footer">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.2fr_2fr]">
          {/* Brand column */}
          <div className="min-w-[260px] space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#D62828]">
                <Package className="h-5 w-5 text-white" strokeWidth={2.4} />
              </div>
              <span className="text-[16px] font-bold tracking-[1.5px] text-white">
                CARGO ONE
              </span>
            </div>
            <p className="max-w-[320px] text-[14px] text-white/65">
              Ship Anything. Anywhere. Instant Quotes.
            </p>

            <div className="space-y-2">
              <p className="text-[16px] font-semibold text-white">
                Stay in the loop
              </p>
              <p className="text-[12px] text-white/55">
                Product updates, launch news, and driver stories.
              </p>
              <form
                onSubmit={submit}
                className="mt-1 flex max-w-[380px] gap-2"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  data-testid="newsletter-email"
                  className="h-11 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="newsletter-submit"
                  className="min-w-[100px] rounded-full bg-[#D62828] px-4 text-[14px] font-bold text-white transition-opacity hover:bg-[#B01F1F] disabled:opacity-60"
                >
                  {submitting ? "…" : "Subscribe"}
                </button>
              </form>
              {status && (
                <p
                  data-testid="newsletter-status"
                  className={`text-[12px] ${
                    status.type === "ok" ? "text-[#4ade80]" : "text-[#f87171]"
                  }`}
                >
                  {status.msg}
                </p>
              )}
            </div>

            <div className="mt-2 flex gap-2">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links grid */}
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.heading} className="min-w-[140px] space-y-1">
                <h4 className="mb-2 text-[14px] font-bold tracking-[0.5px] text-white">
                  {col.heading}
                </h4>
                {col.links.map((l) => (
                  <Link
                    key={l.label}
                    to={l.href}
                    className="block py-1 text-[14px] text-white/65 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-[12px] text-white/45">
            © {new Date().getFullYear()} Cargo One Ltd. Registered in England
            &amp; Wales.
          </p>
          <div className="flex items-center gap-2 text-[12px]">
            <Link to="/settings/terms" className="text-white/65 hover:text-white">
              Terms
            </Link>
            <span className="text-white/30">•</span>
            <Link
              to="/settings/privacy"
              className="text-white/65 hover:text-white"
            >
              Privacy
            </Link>
            <span className="text-white/30">•</span>
            <Link
              to="/settings/cookies"
              className="text-white/65 hover:text-white"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
