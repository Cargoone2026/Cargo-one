import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { CONSENT_EVENT, trackPage } from "@/lib/analytics";

// Sends an anonymous GA page view on route change, only after analytics consent.
export function AnalyticsTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    const t = setTimeout(() => trackPage(pathname), 300);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const onConsent = () => trackPage(window.location.pathname);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  return null;
}
