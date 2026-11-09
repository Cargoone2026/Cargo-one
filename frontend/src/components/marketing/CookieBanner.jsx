import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { OPEN_SETTINGS_EVENT, getConsent, setConsent } from "@/lib/analytics";

// Consent banner: analytics cookies only load after "Accept analytics". Reopened via the footer "Cookie settings" link.
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
    const open = () => setVisible(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    setConsent(value);
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] flex items-center justify-center p-3"
      data-testid="cookie-banner"
    >
      <div className="flex w-full max-w-[760px] flex-col gap-3 rounded-[20px] border border-white/10 bg-[#0F1115] p-4 shadow-2xl sm:flex-row sm:items-center">
        <ShieldCheck className="h-5 w-5 shrink-0 text-[#D62828]" />
        <p className="flex-1 text-[12px] leading-snug text-white/70" data-testid="cookie-banner-text">
          We use essential cookies to keep the site working. With your permission we'd also like to use Google
          Analytics cookies to understand how the site is used.{" "}
          <Link to="/cookies" className="font-semibold text-white underline" data-testid="cookie-policy-link">
            Cookie Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("essential")}
            data-testid="cookie-essential-only"
            className="rounded-full border border-white/25 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-white/10"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose("analytics")}
            data-testid="cookie-accept-analytics"
            className="rounded-full bg-[#D62828] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
