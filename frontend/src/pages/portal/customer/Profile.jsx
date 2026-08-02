import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  Settings,
  HelpCircle,
  FileText,
  Info,
  Star,
  ChevronRight,
  Save,
  Lock,
  Camera,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { ChangePasswordModal } from "@/components/ui-portal/ChangePasswordModal";
import { isValidPhone, isValidUKPostcode } from "@/lib/validators";

const COUNTRIES = [
  "United Kingdom",
  "Ireland",
  "France",
  "Germany",
  "Netherlands",
  "Belgium",
  "Spain",
  "Italy",
  "Poland",
  "Other",
];

/**
 * Customer Profile.
 *
 * Safe edits allowed here (established `PUT /api/auth/me` contract):
 *   - name
 *   - phone
 *
 * Email remains READ-ONLY until a verified email-change flow (with email
 * delivery infrastructure) is approved by the owner.
 *
 * Deferred (backlog, no backend contract yet — NOT rendered as placeholder):
 *   - Payment methods (Stripe management)
 *   - Saved addresses catalog CRUD
 *   - Notification preferences
 */
export default function CustomerProfile() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState(null);
  const photoInputRef = useRef(null);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    address_line1: user?.address_line1 || "",
    address_line2: user?.address_line2 || "",
    town: user?.town || "",
    county: user?.county || "",
    postcode: user?.postcode || "",
    country: user?.country || "United Kingdom",
  });

  const save = useCallback(
    async (e) => {
      e?.preventDefault?.();
      setSaving(true);
      setErr(null);
      if (form.phone && !isValidPhone(form.phone)) {
        setErr("Please enter a valid phone number (e.g. 07700 900 123 or +44 7700 900123).");
        setSaving(false);
        return;
      }
      if (form.postcode && form.country === "United Kingdom" && !isValidUKPostcode(form.postcode)) {
        setErr("Please enter a valid UK postcode (e.g. EC4Y 1AA).");
        setSaving(false);
        return;
      }
      try {
        await api("/auth/me", {
          method: "PUT",
          body: {
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            address_line1: form.address_line1.trim() || null,
            address_line2: form.address_line2.trim() || null,
            town: form.town.trim() || null,
            county: form.county.trim() || null,
            postcode: form.postcode.trim() || null,
            country: form.country || null,
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

  const uploadPhoto = useCallback(
    async (file) => {
      if (!file) return;
      setPhotoErr(null);
      setPhotoBusy(true);
      try {
        // Downscale to 512x512 JPEG @ 0.85 to keep the base64 payload well
        // under 500 KB regardless of source image size.
        const dataUrl = await readAndResize(file, 512, 0.85);
        await api("/users/me/documents", {
          method: "POST",
          body: { doc_type: "profile_photo", base64: dataUrl },
        });
        await refresh();
      } catch (ex) {
        setPhotoErr(ex?.message || "Could not upload photo. Please try a different image.");
      } finally {
        setPhotoBusy(false);
      }
    },
    [refresh],
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
          <div className="relative">
            {user.profile_photo ? (
              <img
                src={user.profile_photo}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
                data-testid="profile-photo-img"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#111111] text-[26px] font-bold text-white">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoBusy}
              data-testid="profile-photo-upload-btn"
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#D62828] text-white shadow-md hover:bg-[#B01F1F] disabled:opacity-60"
              aria-label="Upload profile photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="profile-photo-input"
              onChange={(e) => uploadPhoto(e.target.files?.[0])}
            />
          </div>
          {photoErr ? (
            <p className="mt-2 text-[12px] text-[#DC2626]" data-testid="profile-photo-error">
              {photoErr}
            </p>
          ) : null}
          {photoBusy ? (
            <p className="mt-2 text-[12px] text-[#6B7280]">Uploading…</p>
          ) : null}
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
              placeholder="07700 900 123"
              testID="profile-phone-input"
            />

            <fieldset className="mb-3 space-y-3 rounded-[12px] border border-[#F3F4F6] bg-[#FAFAFA] p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#D62828]" />
                  Address
                </span>
              </legend>
              <Input
                label="Address line 1"
                value={form.address_line1}
                onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                placeholder="12 Fleet Street"
                testID="profile-address1-input"
              />
              <Input
                label="Address line 2"
                value={form.address_line2}
                onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
                placeholder="Flat 3, Riverside Building"
                testID="profile-address2-input"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Town / City"
                  value={form.town}
                  onChange={(e) => setForm((f) => ({ ...f, town: e.target.value }))}
                  placeholder="London"
                  testID="profile-town-input"
                />
                <Input
                  label="County"
                  value={form.county}
                  onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))}
                  placeholder="Greater London"
                  testID="profile-county-input"
                />
                <Input
                  label="Postcode"
                  value={form.postcode}
                  onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                  placeholder="EC4Y 1AA"
                  testID="profile-postcode-input"
                />
                <div className="mb-3">
                  <label className="mb-1 block text-[13px] font-semibold text-[#111111]">
                    Country
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    data-testid="profile-country-input"
                    className="h-11 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F4F4F4] px-3 text-[14px] text-[#111111] outline-none focus:border-[#D62828]"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
            <div className="mb-3">
              <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                Email
              </span>
              <div
                className="flex items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 text-[14px] text-[#6B7280]"
                data-testid="profile-email-readonly"
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
                  setForm({
                    name: user.name || "",
                    phone: user.phone || "",
                    address_line1: user.address_line1 || "",
                    address_line2: user.address_line2 || "",
                    town: user.town || "",
                    county: user.county || "",
                    postcode: user.postcode || "",
                    country: user.country || "United Kingdom",
                  });
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
              subtitle="Name, phone, address"
              testID="profile-edit"
              onClick={() => setEditing(true)}
            />
            <Row
              Icon={Lock}
              label="Change password"
              subtitle="Requires current password"
              testID="profile-change-password"
              onClick={() => setShowChangePwd(true)}
            />
          </section>
        )}

        {/* Read-only address summary */}
        {!editing && (user.address_line1 || user.town || user.postcode) ? (
          <section
            className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
            data-testid="profile-address-summary"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F4]">
                <MapPin className="h-5 w-5 text-[#D62828]" />
              </span>
              <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#111111]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
                  Saved address
                </p>
                {user.address_line1 ? <p className="mt-0.5">{user.address_line1}</p> : null}
                {user.address_line2 ? <p>{user.address_line2}</p> : null}
                <p>
                  {[user.town, user.county].filter(Boolean).join(", ")}
                  {(user.town || user.county) && user.postcode ? " · " : ""}
                  {user.postcode}
                </p>
                {user.country ? <p className="text-[#6B7280]">{user.country}</p> : null}
              </div>
            </div>
          </section>
        ) : null}

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
      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
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

/**
 * Read a File and downscale to a JPEG dataURL bounded by `maxDim` (longest
 * edge), at the given quality. Keeps profile-photo payloads small enough to
 * be safely embedded in a JSON POST body.
 */
function readAndResize(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("Please choose an image file (JPG, PNG or WebP)."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}
