/**
 * ScrollToTop — restores scroll to the top of the viewport on every
 * route change. Placed inside <BrowserRouter> in App.js.
 *
 * Why this exists:
 *   react-router-dom v6 does NOT scroll on navigation by default; users
 *   arriving at a new page from a footer/header link land wherever the
 *   previous page's scroll position was. On mobile this was reported
 *   as "you have to manually scroll up to see the section you clicked".
 *
 * Behaviour:
 *   • Instant scroll on pathname change (feels like a native page load).
 *   • Smooth scroll to an in-page `#anchor` when a hash is present, so
 *     footer links like `/drivers#requirements` land on that section.
 *   • Honours `prefers-reduced-motion` (uses `scroll` instead of `smooth`).
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // If a hash target exists, scroll to that element after a tick so the
    // destination has rendered. Otherwise reset the viewport to 0,0.
    if (hash) {
      const id = hash.replace(/^#/, "");
      // The Drivers page (and similar marketing pages) render heavy hero
      // images before the target section appears in the DOM — poll a few
      // times to survive that mount cost without an ugly jump.
      let tries = 0;
      const maxTries = 12; // ~1.2s worst case
      const step = () => {
        const el = id ? document.getElementById(id) : null;
        if (el) {
          el.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "start",
          });
          return;
        }
        if (tries++ < maxTries) setTimeout(step, 100);
        else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      };
      setTimeout(step, 80);
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}

export default ScrollToTop;
