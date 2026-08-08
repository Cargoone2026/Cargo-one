import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Star,
  FileText,
  Truck,
  Settings,
  ChevronRight,
  User as UserIcon,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { api } from "@/lib/api";
import { isValidPhone } from "@/lib/validators";
import { ChangePasswordModal } from "@/components/ui-portal/ChangePasswordModal";

export default function DriverProfile() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });
  if (!user) return null;

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setErr(null);
    const trimmedPhone = form.phone.trim();
    if (!isValidPhone(trimmedPhone)) {
      setErr(
        "Enter a valid phone number (e.g. 07700 900123 or +44 7700 900123).",
      );
      setSaving(false);
      return;
    }
    try {
      await api("/auth/me", {
        method: "PUT",
        body: { name: form.name.trim(), phone: trimmedPhone },
      });
      await refresh();
      setEditing(false);
    } catch (ex) {
      setErr(ex?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const phoneMissing = !isValidPhone((user.phone || "").trim());

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
        {phoneMissing && !editing ? (
          <div
            className="mb-4 flex items-start gap-3 rounded-[12px] border border-[#F59E0B] bg-[#FFFBEB] p-3"
            data-testid="driver-phone-missing-banner"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
            <div className="min-w-0 flex-1 text-[13px] text-[#92400E]">
              <p className="font-semibold">Add your phone number</p>
              <p className="mt-0.5">
                Customers cannot call you after their booking is confirmed until you add a phone.
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid="driver-phone-missing-cta"
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#D62828]"
              >
                Add phone number
              </button>
            </div>
          </div>
        ) : null}
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

        {editing ? (
          <form
            onSubmit={save}
            className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
            data-testid="driver-profile-edit-form"
          >
            <h2 className="mb-3 text-[16px] font-semibold text-[#111111]">
              Edit profile
            </h2>
            <Input
              label="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              testID="driver-profile-name-input"
              required
            />
            <Input
              label="Phone (required)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+44 7000 000000"
              testID="driver-profile-phone-input"
              required
            />
            <div className="mb-3">
              <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                Email
              </span>
              <div
                className="flex items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 text-[14px] text-[#6B7280]"
                data-testid="driver-profile-email-readonly"
              >
                <span className="flex-1 truncate">{user.email}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#9CA3AF]">
                  Locked
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[#6B7280]">
                Email changes require a verified email-change flow (coming soon).
              </p>
            </div>
            {err ? (
              <p className="mt-1 text-[12px] text-[#DC2626]" data-testid="driver-profile-edit-error">
                {err}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Button
                title="Cancel"
                variant="ghost"
                fullWidth={false}
                onClick={() => {
                  setForm({ name: user.name || "", phone: user.phone || "" });
                  setErr(null);
                  setEditing(false);
                }}
                testID="driver-profile-edit-cancel"
              />
              <Button
                type="submit"
                title="Save changes"
                variant="primary"
                loading={saving}
                testID="driver-profile-edit-save"
              />
            </div>
          </form>
        ) : (
          <section className="mt-4 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
            <RowLink
              Icon={UserIcon}
              label="Edit profile"
              subtitle="Name, phone"
              testID="driver-profile-edit"
              onClick={() => setEditing(true)}
            />
            <RowLink
              Icon={Lock}
              label="Change password"
              subtitle="Requires current password"
              testID="driver-profile-change-password"
              onClick={() => setShowChangePwd(true)}
            />
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
        )}

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
      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
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
