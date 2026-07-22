import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal, X as XIcon } from "lucide-react";

/**
 * Mobile bottom tab bar for portals (used when width < 1024px).
 *
 * If more than MAX_PRIMARY items are supplied, the first (MAX_PRIMARY - 1)
 * are shown as primary tabs and the remainder are collapsed into a "More"
 * bottom sheet so nothing goes missing at narrow portrait widths.
 */
const MAX_PRIMARY = 5; // 4 primary destinations + 1 "More" tab

export function BottomTabs({ role, items }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href) => {
    if (location.pathname === href) return true;
    if (href === `/${role}`) return location.pathname === `/${role}`;
    return location.pathname.startsWith(`${href}/`);
  };

  const needsMore = items.length > MAX_PRIMARY;
  const primary = needsMore ? items.slice(0, MAX_PRIMARY - 1) : items;
  const overflow = needsMore ? items.slice(MAX_PRIMARY - 1) : [];
  const overflowActive = overflow.some((i) => isActive(i.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#F3F4F6] bg-white px-1 pt-2 pb-3 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        data-testid={`bottom-tabs-${role}`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        {primary.map((item) => {
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
        {needsMore && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            data-testid={`bottom-tab-more-${role}`}
            aria-label="More"
            aria-expanded={moreOpen}
            className="flex flex-1 flex-col items-center gap-0.5 py-1"
          >
            <MoreHorizontal
              className="h-6 w-6"
              style={{ color: overflowActive ? "#D62828" : "#6B7280" }}
              strokeWidth={overflowActive ? 2.4 : 2}
            />
            <span
              className="text-[11px] font-semibold"
              style={{ color: overflowActive ? "#D62828" : "#6B7280" }}
            >
              More
            </span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          role="dialog"
          aria-modal="true"
          data-testid={`bottom-tabs-more-sheet-${role}`}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-[20px] bg-white"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
          >
            <header className="flex items-center justify-between border-b border-[#F3F4F6] px-4 py-3">
              <p className="text-[16px] font-bold text-[#111111]">More</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-2 hover:bg-[#F4F4F4]"
                data-testid={`bottom-tabs-more-close-${role}`}
              >
                <XIcon className="h-5 w-5 text-[#111111]" />
              </button>
            </header>
            <ul className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-5">
              {overflow.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={() => setMoreOpen(false)}
                      data-testid={`bottom-tab-more-${item.href.replace(/\W+/g, "-")}`}
                      className="flex flex-col items-center gap-1 rounded-[12px] px-2 py-3 hover:bg-[#F9FAFB]"
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: active ? "#D62828" : "#111111" }}
                        strokeWidth={active ? 2.4 : 2}
                      />
                      <span
                        className="text-center text-[11px] font-semibold leading-tight"
                        style={{ color: active ? "#D62828" : "#111111" }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
