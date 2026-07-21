import React from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Mobile bottom tab bar for portals (used when width < 1024px).
 */
export function BottomTabs({ role, items }) {
  const location = useLocation();
  const isActive = (href) => {
    if (location.pathname === href) return true;
    if (href === `/${role}`) return location.pathname === `/${role}`;
    return location.pathname.startsWith(`${href}/`);
  };
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#F3F4F6] bg-white px-1 pt-2 pb-3 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      data-testid={`bottom-tabs-${role}`}
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            data-testid={`bottom-tab-${item.href.replace(/\W+/g, "-")}`}
            className="flex flex-1 flex-col items-center gap-0.5 py-1"
          >
            <Icon
              className="h-6 w-6"
              style={{ color: active ? "#D62828" : "#6B7280" }}
              strokeWidth={active ? 2.4 : 2}
            />
            <span
              className="text-[11px] font-semibold"
              style={{ color: active ? "#D62828" : "#6B7280" }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
