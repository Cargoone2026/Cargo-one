import { useEffect, useState } from "react";

/**
 * Portal layout hook: on web, ≥1024px = desktop side-rail; <1024px = mobile
 * bottom-tab navigation. Matches the Expo `usePortalLayout` behaviour.
 */
export function usePortalLayout() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { isWebDesktop: width >= 1024, width };
}
