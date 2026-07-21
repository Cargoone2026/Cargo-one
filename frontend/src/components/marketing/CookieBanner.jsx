import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

const KEY = "cargoone.cookie_consent.v1";

/**
 * Cookie consent banner. Stores the user's *consent choice* (not any auth
 * material) in localStorage. Auth tokens continue to live only in the
 * HttpOnly session cookie set by the backend.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (!v) setVisible(true);
    } catch {
      /* localStorage may be disabled — skip banner */
    }
  }, []);

  if (!visible) return null;

  const decide = (choice) => {
    try {
      localStorage.setItem(KEY, choice);
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
      <div className="w-full max-w-[720px] space-y-3 rounded-[20px] border border-white/10 bg-[#0F1115] p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#D62828]" />
          <h3 className="text-[16px] font-bold text-white">
            Cookies on Cargo One
          </h3>
        </div>
        <p className="text-[12px] leading-snug text-white/70">
          We use essential cookies to run the site and analytics cookies to
          understand how you use it, so we can improve the experience. Accept
          all, or reject non-essential ones.
        </p>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => decide("rejected")}
            data-testid="cookie-reject"
            className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/5"
          >
            Reject non-essential
          </button>
          <button
            type="button"
            onClick={() => decide("accepted")}
            data-testid="cookie-accept"
            className="rounded-full bg-[#D62828] px-5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
