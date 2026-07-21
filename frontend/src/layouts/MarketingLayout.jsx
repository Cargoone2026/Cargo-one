import React from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";

export function MarketingLayout({ children }) {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      <main className="w-full">{children}</main>
      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
