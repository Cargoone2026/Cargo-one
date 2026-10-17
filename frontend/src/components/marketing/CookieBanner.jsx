import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const KEY = "cargoone.cookie_notice.v2";

// Essential-cookies-only notice; stores a dismissal flag in localStorage.
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* localStorage disabled — skip notice */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "seen");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] flex items-center justify-center p-3"
      data-testid="cookie-banner"
    >
      <div className="flex w-full max-w-[720px] flex-col gap-3 rounded-[20px] border border-white/10 bg-[#0F1115] p-4 shadow-2xl sm:flex-row sm:items-center">
        <ShieldCheck className="h-5 w-5 shrink-0 text-[#D62828]" />
        <p className="flex-1 text-[12px] leading-snug text-white/70" data-testid="cookie-banner-text">
          We only use essential cookies to keep you signed in and secure. No
          analytics or advertising cookies.{" "}
          <Link to="/cookies" className="font-semibold text-white underline" data-testid="cookie-policy-link">
            Cookie Policy
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          data-testid="cookie-got-it"
          className="rounded-full bg-[#D62828] px-5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
