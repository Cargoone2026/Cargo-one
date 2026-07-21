import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Settings, FileText, HelpCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui-portal/Button";

export default function AdminProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const initials = (user.name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-profile">
      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">
        <section
          className="flex flex-col items-center gap-2 rounded-[16px] border border-[#E5E7EB] p-6 text-center"
          data-testid="admin-profile-header"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#111111] text-[26px] font-bold text-white">
            {initials}
          </div>
          <h1 className="mt-2 text-[22px] font-bold text-[#111111]">{user.name}</h1>
          <p className="text-[14px] text-[#6B7280]">{user.email}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1 text-[11px] font-bold tracking-[0.8px] text-white">
            <ShieldCheck className="h-3.5 w-3.5" />
            ADMINISTRATOR
          </span>
        </section>

        <section className="mt-4 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
          <Row Icon={Settings} label="Platform settings" subtitle="Managed via Catalog & Fee Bands screens" testID="admin-profile-settings" onClick={() => navigate("/admin/catalog")} />
          <Row Icon={FileText} label="Terms &amp; Privacy" testID="admin-profile-terms" onClick={() => navigate("/settings/terms")} />
          <Row Icon={HelpCircle} label="Support" testID="admin-profile-help" onClick={() => navigate("/settings/support")} />
        </section>

        <div className="mt-6">
          <Button
            title="Log out"
            variant="outline"
            onClick={async () => {
              await logout();
              navigate("/", { replace: true });
            }}
            testID="admin-logout"
          />
        </div>
      </div>
    </div>
  );
}

function Row({ Icon, label, subtitle, testID, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className="flex w-full items-center gap-3 border-b border-[#F3F4F6] px-4 py-3 text-left last:border-b-0 hover:bg-[#F9FAFB]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F4]">
        <Icon className="h-5 w-5 text-[#111111]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-[#111111]">{label}</span>
        {subtitle && <span className="block text-[12px] text-[#6B7280]">{subtitle}</span>}
      </span>
      <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
    </button>
  );
}
