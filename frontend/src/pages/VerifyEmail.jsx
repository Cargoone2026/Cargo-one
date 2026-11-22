import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, refresh } = useAuth();
  const [state, setState] = useState("checking");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    api(`/auth/verify-email-link?token=${encodeURIComponent(params.get("token") || "")}`)
      .then(() => {
        setState("ok");
        refresh().catch(() => {});
      })
      .catch(() => setState("expired"));
    return () => robots.remove();
  }, [params, refresh]);

  const home = user?.role === "driver" ? "/driver" : user?.role === "customer" ? "/customer" : "/auth/login";
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6" data-testid="verify-email-page">
      <div className="w-full max-w-[420px] text-center">
        {state === "checking" ? <p className="text-[15px] text-[#6B7280]">Checking your link…</p> : null}
        {state === "ok" ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#16A34A]" />
            <h1 className="mt-4 text-[28px] font-bold text-[#111111]" data-testid="verify-email-ok">Email verified</h1>
            <Link to={home} className="mt-6 inline-block rounded-full bg-[#D62828] px-6 py-3 font-bold text-white" data-testid="verify-email-continue">
              {user ? "Go to my dashboard" : "Log in"}
            </Link>
          </>
        ) : null}
        {state === "expired" ? (
          <>
            <h1 className="text-[24px] font-bold text-[#111111]" data-testid="verify-email-expired">Link expired</h1>
            <p className="mt-2 text-[14px] text-[#6B7280]">Log in and request a new code from your dashboard.</p>
            <Link to={home} className="mt-6 inline-block rounded-full bg-[#111111] px-6 py-3 font-bold text-white" data-testid="verify-email-request-new">
              Request a new code
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
