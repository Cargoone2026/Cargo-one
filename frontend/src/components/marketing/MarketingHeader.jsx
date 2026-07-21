import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Package, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";

const NAV = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Business", href: "/business" },
  { label: "Drivers", href: "/drivers" },
  { label: "Trust & Safety", href: "/trust-safety" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export function MarketingHeader() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile, isTablet } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);
  const showMenuIcon = isMobile || isTablet;

  const goToApp = () => {
    if (!user) return;
    if (user.role === "customer") navigate("/customer");
    else if (user.role === "driver") navigate("/driver");
    else if (user.role === "admin") navigate("/admin");
  };

  return (
    <header
      className="sticky top-0 z-[100] w-full border-b border-[#E5E7EB] bg-white/95 backdrop-blur-md"
      data-testid="marketing-header"
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-4 py-3 md:px-6">
        <Link
          to="/"
          data-testid="marketing-logo"
          className="flex items-center gap-2"
        >
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#D62828]">
            <Package className="h-5 w-5 text-white" strokeWidth={2.4} />
          </div>
          <span className="text-[16px] font-bold tracking-[1.5px] text-[#111111]">
            CARGO ONE
          </span>
        </Link>

        {!showMenuIcon && (
          <nav className="flex flex-1 items-center justify-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                data-testid={`marketing-nav-${item.href.slice(1)}`}
                className="rounded-md px-3 py-2 text-[14px] font-medium text-[#6B7280] transition-colors hover:bg-[#F4F4F4] hover:text-[#111111]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Search Cargo One"
            data-testid="marketing-search-open"
            onClick={() => {
              /* Global search modal wired in later stage */
            }}
            className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F4F4F4]"
          >
            <Search className="h-[22px] w-[22px]" strokeWidth={2} />
          </button>
          {!showMenuIcon && !user && (
            <Link
              to="/auth/login"
              data-testid="marketing-login"
              className="px-3 py-2 text-[14px] font-semibold text-[#111111]"
            >
              Log in
            </Link>
          )}
          {user ? (
            <button
              type="button"
              onClick={goToApp}
              data-testid="marketing-go-to-app"
              className="rounded-full bg-[#D62828] px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
            >
              Go to App
            </button>
          ) : (
            <Link
              to="/auth/register?role=customer"
              data-testid="marketing-signup"
              className="rounded-full bg-[#D62828] px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
            >
              Get a Quote
            </Link>
          )}
          {showMenuIcon && (
            <button
              type="button"
              aria-label="Menu"
              data-testid="marketing-menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F4F4F4]"
            >
              {menuOpen ? (
                <X className="h-[26px] w-[26px]" />
              ) : (
                <Menu className="h-[26px] w-[26px]" />
              )}
            </button>
          )}
        </div>
      </div>

      {showMenuIcon && menuOpen && (
        <div
          className="border-t border-[#E5E7EB] py-2"
          data-testid="marketing-mobile-menu"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between px-4 py-3 text-[16px] font-medium text-[#111111] hover:bg-[#F4F4F4]"
            >
              {item.label}
              <span aria-hidden className="text-[#6B7280]">
                ›
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              if (user) goToApp();
              else navigate("/auth/login");
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-[16px] font-medium text-[#111111] hover:bg-[#F4F4F4]"
          >
            {user ? "Go to App" : "Log in"}
            <span aria-hidden className="text-[#6B7280]">
              ›
            </span>
          </button>
        </div>
      )}
    </header>
  );
}
