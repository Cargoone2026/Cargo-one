import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Star,
  FileText,
  Truck,
  Settings,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui-portal/Button";

export default function DriverProfile() {
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
    <div className="min-h-screen bg-white pb-6" data-testid="driver-profile">
      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">
        <section
          className="flex flex-col items-center gap-2 rounded-[16px] border border-[#E5E7EB] bg-white p-6 text-center"
          data-testid="driver-profile-header"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#D62828] text-[26px] font-bold text-white">
            {user.profile_photo ? (
              <img
                src={user.profile_photo}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <h1 className="mt-2 text-[22px] font-bold text-[#111111]">{user.name}</h1>
          <p className="text-[14px] text-[#6B7280]">{user.email}</p>
          {user.verified_driver && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-3 py-1 text-[11px] font-bold tracking-[0.8px] text-white"
              data-testid="verified-driver-badge"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              VERIFIED DRIVER
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F4F4] px-3 py-1 text-[12px] font-semibold text-[#111111]"
            data-testid="driver-status-pill"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  user.status === "active" ? "#16A34A" : "#F59E0B",
              }}
            />
            {user.status === "active" ? "Approved Driver" : "Pending Approval"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-3 py-1 text-[12px] font-semibold text-[#E55E00]">
            <Star className="h-3.5 w-3.5" />
            {Number(user.rating || 0).toFixed(1)} · {user.total_jobs || 0} jobs
          </span>
        </section>

        <section className="mt-4 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
          <RowLink
            Icon={FileText}
            label="Manage verification documents"
            subtitle={
              user.documents_verified
                ? "All approved ✓"
                : "Upload required documents to get approved"
            }
            testID="open-documents"
            onClick={() => navigate("/driver/documents")}
          />
          <RowLink
            Icon={Truck}
            label="My fleet"
            subtitle="Register / edit vehicles and capabilities"
            testID="open-fleet"
            onClick={() => navigate("/driver/fleet")}
          />
          <RowLink
            Icon={Settings}
            label="Account settings"
            subtitle="Terms, Privacy, Support, Delete Account"
            testID="open-settings"
            onClick={() => navigate("/settings")}
          />
        </section>

        <div className="mt-6">
          <Button
            title="Log out"
            variant="outline"
            onClick={async () => {
              await logout();
              navigate("/", { replace: true });
            }}
            testID="driver-logout"
          />
        </div>
      </div>
    </div>
  );
}

function RowLink({ Icon, label, subtitle, testID, onClick }) {
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
        <span className="block text-[14px] font-semibold text-[#111111]">
          {label}
        </span>
        {subtitle && (
          <span className="block text-[12px] text-[#6B7280]">{subtitle}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
    </button>
  );
}
