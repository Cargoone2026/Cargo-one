import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Settings,
  FileText,
  HelpCircle,
  ChevronRight,
  User as UserIcon,
  Lock,
  Sliders,
  Package,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { api } from "@/lib/api";
import { ChangePasswordModal } from "@/components/ui-portal/ChangePasswordModal";

/**
 * Admin Profile.
 *
 * Personal ADMIN ACCOUNT is separated from PLATFORM CONFIGURATION here.
 * Personal:  name/phone edit, change password, session/logout, legal.
 * Platform:  service catalog, fee bands (each has its own dedicated screen).
 */
export default function AdminProfile() {
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
    try {
      await api("/auth/me", {
        method: "PUT",
        body: { name: form.name.trim(), phone: form.phone.trim() || null },
      });
      await refresh();
      setEditing(false);
    } catch (ex) {
      setErr(ex?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

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

        {editing ? (
          <form
            onSubmit={save}
            className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
            data-testid="admin-profile-edit-form"
          >
            <h2 className="mb-3 text-[16px] font-semibold text-[#111111]">
              Edit admin profile
            </h2>
            <Input
              label="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              testID="admin-profile-name-input"
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+44 7000 000000"
              testID="admin-profile-phone-input"
            />
            <div className="mb-3">
              <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                Email
              </span>
              <div
                className="flex items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 text-[14px] text-[#6B7280]"
                data-testid="admin-profile-email-readonly"
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
              <p className="mt-1 text-[12px] text-[#DC2626]" data-testid="admin-profile-edit-error">
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
                testID="admin-profile-edit-cancel"
              />
              <Button
                type="submit"
                title="Save changes"
                variant="primary"
                loading={saving}
                testID="admin-profile-edit-save"
              />
            </div>
          </form>
        ) : (
          <>
            <p className="mt-6 mb-2 px-1 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
              Admin account
            </p>
            <section className="overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
              <Row
                Icon={UserIcon}
                label="Edit admin profile"
                subtitle="Name, phone"
                testID="admin-profile-edit"
                onClick={() => setEditing(true)}
              />
              <Row
                Icon={Lock}
                label="Change password"
                subtitle="Requires current password"
                testID="admin-profile-change-password"
                onClick={() => setShowChangePwd(true)}
              />
            </section>

            <p className="mt-6 mb-2 px-1 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
              Platform configuration
            </p>
            <section className="overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
              <Row
                Icon={Package}
                label="Service catalog"
                subtitle="Categories, vehicles, capabilities"
                testID="admin-profile-catalog"
                onClick={() => navigate("/admin/catalog")}
              />
              <Row
                Icon={Sliders}
                label="Booking fee bands"
                subtitle="Deposit tiers by driver charge"
                testID="admin-profile-fee-bands"
                onClick={() => navigate("/admin/fee-bands")}
              />
            </section>

            <p className="mt-6 mb-2 px-1 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
              Legal &amp; support
            </p>
            <section className="overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
              <Row Icon={Settings} label="Account settings" subtitle="Preferences, Delete Account" testID="admin-profile-settings" onClick={() => navigate("/settings")} />
              <Row Icon={FileText} label="Terms &amp; Privacy" testID="admin-profile-terms" onClick={() => navigate("/settings/terms")} />
              <Row Icon={HelpCircle} label="Support" testID="admin-profile-help" onClick={() => navigate("/settings/support")} />
            </section>
          </>
        )}

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
      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
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
