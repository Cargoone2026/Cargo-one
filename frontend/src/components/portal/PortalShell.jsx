import React from "react";
import { SideRail } from "@/components/portal/SideRail";
import { BottomTabs } from "@/components/portal/BottomTabs";
import { usePortalLayout } from "@/components/portal/usePortalLayout";

/**
 * PortalShell — responsive portal chrome.
 *  - Desktop (≥1024px): SideRail on the left, page content beside it (max 1200px).
 *  - Mobile (<1024px):  Full-width content + fixed bottom tab bar.
 */
export function PortalShell({ role, items, children }) {
  const { isWebDesktop } = usePortalLayout();
  return (
    <div className="flex min-h-screen bg-white" data-testid={`portal-shell-${role}`}>
      {isWebDesktop && <SideRail role={role} items={items} />}
      <div
        className="min-w-0 flex-1"
        style={{
          paddingBottom: isWebDesktop ? 0 : 72,
        }}
      >
        <div className="mx-auto w-full min-w-0 max-w-[1200px] overflow-x-hidden">
          {children}
        </div>
      </div>
      {!isWebDesktop && <BottomTabs role={role} items={items} />}
    </div>
  );
}
