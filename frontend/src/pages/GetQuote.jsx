import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Package } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NonCustomerNote } from "@/components/ui-portal/QuoteAccountStep";
import CustomerPostJob from "@/pages/portal/customer/PostJob";
import CustomerAsapRequest from "@/pages/portal/customer/AsapRequest";

const TYPES = [
  { key: "book", label: "Bid Jobs or Fixed Price Jobs", sub: "Book ahead", href: "/get-quote" },
  { key: "transport", label: "ASAP Transport", sub: "Driver now", href: "/get-quote/asap" },
  { key: "recovery", label: "ASAP Recovery", sub: "Breakdown / non-runner", href: "/get-quote/asap?mode=recovery" },
];

function useNoindex() {
  useEffect(() => {
    const el = document.createElement("meta");
    el.name = "robots";
    el.content = "noindex";
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

function TypeChooser({ active }) {
  return (
    <div className="mx-auto grid max-w-[720px] grid-cols-1 gap-2 px-4 pt-4 sm:grid-cols-3 md:px-8" data-testid="get-quote-type-chooser">
      {TYPES.map((t) => (
        <Link
          key={t.key}
          to={t.href}
          replace
          data-testid={`get-quote-type-${t.key}`}
          className={`rounded-2xl border p-3 transition-colors ${active === t.key ? "border-[#111111] bg-[#111111] text-white" : "border-[#E5E7EB] bg-white text-[#111111] hover:border-[#9CA3AF]"}`}
        >
          <span className="block text-[14px] font-bold">{t.label}</span>
          <span className={`block text-[12px] ${active === t.key ? "text-white/70" : "text-[#6B7280]"}`}>{t.sub}</span>
        </Link>
      ))}
    </div>
  );
}

export default function GetQuote() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const asap = pathname.startsWith("/get-quote/asap");
  const recovery = params.get("mode") === "recovery";
  const checked = useRef(false);
  const [blockedUser, setBlockedUser] = useState(null);
  useNoindex();

  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    if (user && user.role !== "customer") setBlockedUser(user);
    if (user?.role !== "customer") return;
    if (asap) navigate(`/customer/asap${recovery ? "?mode=recovery" : ""}`, { replace: true });
    else navigate(`/customer/post-job${params.get("category") ? `?category=${encodeURIComponent(params.get("category"))}` : ""}`, { replace: true });
  }, [loading, user, asap, recovery, params, navigate]);

  if (loading || (!checked.current && user?.role === "customer")) return null;
  if (pathname !== "/get-quote" && pathname !== "/get-quote/asap") return <Navigate to="/get-quote" replace />;

  return (
    <div className="min-h-screen bg-white" data-testid="get-quote-page">
      <header className="border-b border-[#F3F4F6] px-4 py-3 md:px-8">
        <Link to="/" className="inline-flex items-center gap-2" data-testid="get-quote-logo">
          <span className="flex h-[32px] w-[32px] items-center justify-center rounded-[10px] bg-[#D62828]">
            <Package className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="text-[14px] font-bold tracking-[1.2px] text-[#111111] sm:text-[16px]">CARGO ONE</span>
        </Link>
      </header>
      {blockedUser && user ? (
        <div className="mx-auto max-w-[560px] px-6 py-10">
          <NonCustomerNote user={blockedUser} />
        </div>
      ) : (
        <>
          <TypeChooser active={asap ? (recovery ? "recovery" : "transport") : "book"} />
          {asap ? (
            <CustomerAsapRequest key={recovery ? "recovery" : "transport"} guest initialMode={recovery ? "breakdown_recovery" : "transport"} />
          ) : (
            <CustomerPostJob guest />
          )}
        </>
      )}
    </div>
  );
}
