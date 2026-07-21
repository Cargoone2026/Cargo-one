import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  CreditCard,
  MapPin,
  Bell,
  Settings,
  HelpCircle,
  FileText,
  Info,
  Star,
  ChevronRight,
  Save,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";

/**
 * Customer Profile — Stage 2A-i.
 *
 * Safe edits allowed here (established `PUT /api/auth/me` contract):
 *   - name
 *   - phone
 *
 * Not in scope for 2A-i (stubbed rows, "coming soon"):
 *   - Payment methods (Stripe management belongs to Stage 2A-ii)
 *   - Saved addresses catalog CRUD
 *   - Notification preferences
 */
export default function CustomerProfile() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });

  const save = useCallback(
    async (e) => {
      e?.preventDefault?.();
      setSaving(true);
      setErr(null);
      try {
        await api("/auth/me", {
          method: "PUT",
          body: {
            name: form.name.trim(),
            phone: form.phone.trim() || null,
          },
        });
        await refresh();
        setEditing(false);
      } catch (ex) {
        setErr(ex?.message || "Could not save changes.");
      } finally {
        setSaving(false);
      }
    },
    [form, refresh],
  );

  if (!user) return null;

  const initials = (user.name || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="customer-profile">
      <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8">
        {/* Header card */}
        <section
          className="flex flex-col items-center gap-2 rounded-[16px] border border-[#E5E7EB] bg-white p-6 text-center"
          data-testid="profile-header"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#111111] text-[26px] font-bold text-white">
            {initials}
          </div>
          <h1 className="mt-2 text-[22px] font-bold text-[#111111]">
            {user.name}
          </h1>
          <p className="text-[14px] text-[#6B7280]">{user.email}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-3 py-1 text-[12px] font-semibold text-[#E55E00]">
            <Star className="h-3.5 w-3.5" />
            {Number(user.rating || 0).toFixed(1)} · {user.total_jobs || 0}{" "}
            shipments
          </span>
        </section>

        {/* Editable section */}
        {editing ? (
          <form
            onSubmit={save}
            className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
            data-testid="profile-edit-form"
          >
            <h2 className="mb-3 text-[16px] font-semibold text-[#111111]">
              Edit profile
            </h2>
            <Input
              label="Full name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              testID="profile-name-input"
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="+44 7000 000000"
              testID="profile-phone-input"
            />
            {err ? (
              <p
                className="mt-1 text-[12px] text-[#DC2626]"
                data-testid="profile-edit-error"
              >
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
                testID="profile-edit-cancel"
              />
              <Button
                type="submit"
                title="Save changes"
                variant="primary"
                loading={saving}
                testID="profile-edit-save"
              >
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save changes
                </span>
              </Button>
            </div>
          </form>
        ) : (
          <section className="mt-4 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
            <Row
              Icon={UserIcon}
              label="Edit profile"
              testID="profile-edit"
              onClick={() => setEditing(true)}
            />
            <Row
              Icon={CreditCard}
              label="Payment methods"
              subtitle="Available in the next migration stage"
              testID="profile-payment"
              disabled
            />
            <Row
              Icon={MapPin}
              label="Saved addresses"
              subtitle="Available in the next migration stage"
              testID="profile-addresses"
              disabled
            />
            <Row
              Icon={Bell}
              label="Notifications"
              subtitle="Available in the next migration stage"
              testID="profile-notif"
              disabled
            />
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
          <Row
            Icon={Settings}
            label="Settings"
            testID="profile-settings"
            onClick={() => navigate("/settings")}
            subtitle="Preferences, legal, account"
          />
          <Row
            Icon={HelpCircle}
            label="Help & Support"
            testID="profile-help"
            onClick={() => navigate("/settings/support")}
          />
          <Row
            Icon={FileText}
            label="Terms & Privacy"
            testID="profile-terms"
            onClick={() => navigate("/settings/terms")}
          />
          <Row
            Icon={Info}
            label="About Cargo One"
            testID="profile-about"
            onClick={() => navigate("/settings/about")}
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
            testID="profile-logout-button"
          />
        </div>
      </div>
    </div>
  );
}

function Row({ Icon, label, subtitle, testID, onClick, disabled }) {
  const Base = disabled ? "div" : "button";
  return (
    <Base
      type={disabled ? undefined : "button"}
      onClick={disabled ? undefined : onClick}
      data-testid={testID}
      aria-disabled={disabled || undefined}
      className={`flex w-full items-center gap-3 border-b border-[#F3F4F6] px-4 py-3 text-left last:border-b-0 ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:bg-[#F9FAFB]"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F4]">
        <Icon className="h-5 w-5 text-[#111111]" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-[#111111]">
          {label}
        </span>
        {subtitle ? (
          <span className="block text-[12px] text-[#6B7280]">{subtitle}</span>
        ) : null}
      </span>
      {!disabled ? (
        <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
      ) : null}
    </Base>
  );
}
