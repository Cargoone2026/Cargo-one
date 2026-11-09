// Google Analytics 4, loaded only after explicit consent (UK PECR / GDPR). Anonymous page views only.
const GA_ID = "G-G5NKZYESDR";
export const CONSENT_KEY = "cargoone.cookie_consent.v3";
export const CONSENT_EVENT = "cargoone:consent-changed";
export const OPEN_SETTINGS_EVENT = "cargoone:open-cookie-settings";

const BLOCKED_SEGMENTS = new Set(["admin", "customer", "driver", "driver-profile", "auth", "settings"]);

export function isTrackablePath(pathname) {
  return !BLOCKED_SEGMENTS.has(pathname.split("/").filter(Boolean)[0] || "");
}

export function getConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage disabled — choice applies to this page view only */
  }
  if (value !== "analytics") revokeAnalytics();
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

function gtag() {
  window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
}

let loaded = false;

function loadAnalytics() {
  window[`ga-disable-${GA_ID}`] = false;
  if (loaded) {
    gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  gtag("consent", "update", { analytics_storage: "granted" });
  gtag("js", new Date());
  gtag("config", GA_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  s.setAttribute("data-testid", "ga-script");
  document.head.appendChild(s);
}

function clearGaCookies() {
  const host = window.location.hostname.split(".");
  const domains = host.map((_, i) => host.slice(i).join(".")).filter((d) => d.includes("."));
  document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_")).forEach((name) => {
    const expire = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = expire;
    domains.forEach((d) => { document.cookie = `${expire}; domain=.${d}`; });
  });
}

function revokeAnalytics() {
  window[`ga-disable-${GA_ID}`] = true;
  if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
  clearGaCookies();
}

// Called on every SPA route change; sends a page view with the bare path (no query string or hash).
export function trackPage(pathname) {
  if (getConsent() !== "analytics") return;
  if (!isTrackablePath(pathname)) {
    if (loaded) window[`ga-disable-${GA_ID}`] = true;
    return;
  }
  loadAnalytics();
  const page_location = `${window.location.origin}${pathname}`;
  gtag("set", { page_location, page_path: pathname });
  gtag("event", "page_view", { page_location, page_path: pathname, page_title: document.title });
}
