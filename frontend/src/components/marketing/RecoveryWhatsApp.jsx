import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { getConsent } from "@/lib/analytics";

const MESSAGE = "Hi CargoOne, I need vehicle recovery.\nLocation (postcode or road):\nVehicle (make/model):\nWhat's wrong:\nWhere it needs to go:";
export const RECOVERY_WHATSAPP_URL = `https://wa.me/447983299049?text=${encodeURIComponent(MESSAGE)}`;

const track = () => {
  try {
    if (getConsent() === "analytics" && typeof window.gtag === "function") window.gtag("event", "whatsapp_recovery_click");
  } catch {
    // analytics must never break the link
  }
};

export function RecoveryWhatsApp({ position = "top" }) {
  return (
    <section className="mx-auto max-w-[860px] px-4 pt-8 md:px-0" data-testid={position === "top" ? "recovery-whatsapp" : "recovery-whatsapp-bottom"}>
      <div className="flex flex-col gap-4 rounded-[20px] border border-[#25D366]/40 bg-[#F0FDF4] p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[20px] font-bold text-[#111111]">Broken down?</h2>
            <p className="mt-1 text-[15px] leading-snug text-[#374151]">
              WhatsApp us your location, vehicle and what&apos;s wrong, and we&apos;ll find a recovery driver near you. Messages only, no calls.
            </p>
            <p className="mt-2 text-[12px] font-semibold text-[#6B7280]">If you or anyone is in danger, call 999 first.</p>
          </div>
        </div>
        <a
          href={RECOVERY_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={track}
          data-testid={`recovery-whatsapp-btn-${position}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp us now
        </a>
      </div>
    </section>
  );
}

export function RecoveryWhatsAppBar() {
  const [ready, setReady] = useState(() => !!getConsent());
  useEffect(() => {
    if (ready) return undefined;
    const t = setInterval(() => getConsent() && setReady(true), 1000);
    return () => clearInterval(t);
  }, [ready]);
  if (!ready) return null;
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden="true" />
      <a
        href={RECOVERY_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={track}
        data-testid="recovery-whatsapp-bar"
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-[15px] font-bold text-white shadow-lg md:hidden"
      >
        <MessageCircle className="h-4 w-4" /> Broken down? WhatsApp us
      </a>
    </>
  );
}
