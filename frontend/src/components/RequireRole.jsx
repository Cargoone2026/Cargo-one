import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Role-based route guard.
 *
 * - Unauthenticated → redirect to /auth/login (preserving the intended path).
 * - Authenticated but wrong role → redirect to that user's own portal.
 * - Correct role → render children.
 */
export function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-[14px] text-[#6B7280]">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }
  if (user.role !== role) {
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
  return children;
}
