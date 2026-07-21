import React from "react";
import { Link, Navigate } from "react-router-dom";
import { LogOut, Package } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Phase 2 Stage 1 placeholder for the three role portals.
 *
 * Behaviour:
 *   - Redirects unauthenticated users to /auth/login.
 *   - Enforces role match — a customer cannot land on /driver, etc.
 *   - Renders a minimal, branded landing that clearly states the portal
 *     screens are coming in the next Phase 2 stage.
 */
export function PortalStub({ role, title }) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-[14px] text-[#6B7280]">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth/login" replace />;
  if (user.role !== role) {
    // Route the user to their correct portal
    const target =
      user.role === "customer"
        ? "/customer"
        : user.role === "driver"
        ? "/driver"
        : user.role === "admin"
        ? "/admin"
        : "/";
    return <Navigate to={target} replace />;
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4]" data-testid={`portal-stub-${role}`}>
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#D62828]">
              <Package className="h-5 w-5 text-white" strokeWidth={2.4} />
            </div>
            <span className="text-[16px] font-bold tracking-[1.5px] text-[#111111]">
              CARGO ONE
            </span>
          </Link>
          <button
            type="button"
            onClick={logout}
            data-testid="portal-logout"
            className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-4 py-2 text-[14px] font-semibold text-[#111111] hover:bg-[#F4F4F4]"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
        <div className="mx-auto max-w-[560px] rounded-[20px] border border-[#E5E7EB] bg-white p-8 text-center">
          <p className="text-[12px] font-bold tracking-[2px] text-[#D62828]">
            {role.toUpperCase()} PORTAL
          </p>
          <h1 className="mt-2 text-[24px] font-bold text-[#111111]">
            {title}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[#6B7280]">
            You're signed in as{" "}
            <span className="font-semibold text-[#111111]">{user.email}</span>{" "}
            ({user.role}). The full {role} portal — with jobs, bookings, tracking,
            POD and messaging — is being ported from the source app and arrives in
            the next Phase 2 stage.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <p
              data-testid="portal-status-active"
              className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[12px] font-semibold text-[#166534]"
            >
              Cookie session active — authenticated via /api/auth/me
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
