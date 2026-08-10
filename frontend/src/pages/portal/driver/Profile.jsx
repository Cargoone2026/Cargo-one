import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Camera,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { api } from "@/lib/api";
import { isValidPhone, isValidUKPostcode } from "@/lib/validators";
import { ChangePasswordModal } from "@/components/ui-portal/ChangePasswordModal";

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

export default function DriverProfile() {
  const { user, logout, refresh } = useAuth();
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

  // Driver reviews + cancellation history (informational — no threshold logic).
  const [reviews, setReviews] = useState([]);
  const [cancelCount, setCancelCount] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const [rvs, mine] = await Promise.all([
          api(`/users/${user.id}/reviews`),
          api("/driver/cancellations/mine"),
        ]);
        if (!alive) return;
        setReviews(Array.isArray(rvs) ? rvs : []);
        setCancelCount(typeof mine?.count === "number" ? mine.count : 0);
      } catch (_e) {
        if (alive) setCancelCount(0);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  if (!user) return null;

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setErr(null);
    const trimmedPhone = form.phone.trim();
    if (!isValidPhone(trimmedPhone)) {
      setErr("Enter a valid phone number (e.g. 07700 900123 or +44 7700 900123).");
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
          phone: trimmedPhone,
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
  };

  const uploadPhoto = useCallback(
    async (file) => {
      if (!file) return;
      setPhotoErr(null);
      setPhotoBusy(true);
      try {
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

  const removePhoto = useCallback(async () => {
    setPhotoErr(null);
    setPhotoBusy(true);
    try {
      await api("/auth/me", { method: "PUT", body: { profile_photo: null } });
      await refresh();
    } catch (ex) {
      setPhotoErr(ex?.message || "Could not remove photo.");
    } finally {
      setPhotoBusy(false);
    }
  }, [refresh]);

  const phoneMissing = !isValidPhone((user.phone || "").trim());

  const initials = (user.name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avgRating = Number(user.rating || 0);
  const reviewCount = user.review_count ?? reviews.length;

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
          <div className="relative">
            {user.profile_photo ? (
              <img
                src={user.profile_photo}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
                data-testid="driver-profile-photo-img"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#D62828] text-[26px] font-bold text-white">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoBusy}
              data-testid="driver-profile-photo-upload-btn"
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
              data-testid="driver-profile-photo-input"
              onChange={(e) => uploadPhoto(e.target.files?.[0])}
            />
          </div>
          {user.profile_photo ? (
            <button
              type="button"
              onClick={removePhoto}
              disabled={photoBusy}
              data-testid="driver-profile-photo-remove-btn"
              className="mt-1 text-[12px] font-semibold text-[#6B7280] underline hover:text-[#D62828] disabled:opacity-60"
            >
              Remove photo
            </button>
          ) : null}
          {photoErr ? (
            <p className="mt-2 text-[12px] text-[#DC2626]" data-testid="driver-profile-photo-error">
              {photoErr}
            </p>
          ) : null}
          {photoBusy ? (
            <p className="mt-2 text-[12px] text-[#6B7280]">Uploading…</p>
          ) : null}
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
              style={{ backgroundColor: user.status === "active" ? "#16A34A" : "#F59E0B" }}
            />
            {user.status === "active" ? "Approved Driver" : "Pending Approval"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-3 py-1 text-[12px] font-semibold text-[#E55E00]">
            <Star className="h-3.5 w-3.5" />
            {avgRating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? "review" : "reviews"} · {user.total_jobs || 0} jobs
          </span>
        </section>

        {editing ? (
          <form
            onSubmit={save}
            className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
            data-testid="driver-profile-edit-form"
          >
            <h2 className="mb-3 text-[16px] font-semibold text-[#111111]">Edit profile</h2>
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
              <span className="mb-1 block text-[13px] font-semibold text-[#111111]">Email</span>
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

            <div className="mb-2 flex items-center gap-2 pt-1 text-[13px] font-semibold text-[#111111]">
              <MapPin className="h-4 w-4 text-[#6B7280]" /> Registered address
            </div>
            <Input
              label="Address line 1"
              value={form.address_line1}
              onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
              testID="driver-profile-address-line1-input"
              placeholder="123 Example Street"
            />
            <Input
              label="Address line 2 (optional)"
              value={form.address_line2}
              onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
              testID="driver-profile-address-line2-input"
              placeholder="Flat 2 / Building name"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                label="Town / City"
                value={form.town}
                onChange={(e) => setForm((f) => ({ ...f, town: e.target.value }))}
                testID="driver-profile-town-input"
              />
              <Input
                label="County"
                value={form.county}
                onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))}
                testID="driver-profile-county-input"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                label="Postcode"
                value={form.postcode}
                onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value.toUpperCase() }))}
                testID="driver-profile-postcode-input"
                placeholder="EC4Y 1AA"
              />
              <div className="mb-3">
                <label className="mb-1 block text-[13px] font-semibold text-[#111111]">Country</label>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  data-testid="driver-profile-country-input"
                  className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-3 text-[14px] text-[#111111] focus:border-[#D62828] focus:outline-none"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
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
              subtitle="Name, phone, registered address"
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

        {!editing && (user.address_line1 || user.town || user.postcode) ? (
          <section
            className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
            data-testid="driver-profile-address-view"
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
              <MapPin className="h-4 w-4 text-[#6B7280]" /> Registered address
            </div>
            <div className="mt-2 text-[13px] leading-6 text-[#374151]">
              {user.address_line1 ? <p>{user.address_line1}</p> : null}
              {user.address_line2 ? <p>{user.address_line2}</p> : null}
              <p>
                {[user.town, user.county].filter(Boolean).join(", ")}
                {user.postcode ? ` · ${user.postcode}` : ""}
              </p>
              {user.country ? <p className="text-[12px] text-[#6B7280]">{user.country}</p> : null}
            </div>
          </section>
        ) : null}

        {/* R23 — informational cancellation-history banner. No auto-suspend. */}
        {typeof cancelCount === "number" && cancelCount > 0 ? (
          <section
            className="mt-4 flex items-start gap-3 rounded-[12px] border border-[#F59E0B] bg-[#FFFBEB] p-3"
            data-testid="driver-cancel-history-banner"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
            <div className="min-w-0 flex-1 text-[13px] text-[#92400E]">
              <p className="font-semibold">Cancellations on record: {cancelCount}</p>
              <p className="mt-0.5">
                Frequent or invalid cancellations may affect your driver account.
                Keep cancellations to genuine reasons only.
              </p>
            </div>
          </section>
        ) : null}

        <section
          className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white p-4"
          data-testid="driver-profile-reviews"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#111111]">
              <Star className="h-4 w-4 text-[#E55E00]" />
              Customer reviews
            </div>
            <span className="text-[12px] text-[#6B7280]" data-testid="driver-reviews-count">
              {reviewCount} total
            </span>
          </div>
          {reviews.length === 0 ? (
            <p className="text-[13px] text-[#6B7280]">
              No reviews yet. Complete deliveries to start collecting reviews from customers.
            </p>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {reviews.slice(0, 5).map((rv) => (
                <ReviewRow
                  key={rv.id}
                  review={rv}
                  canReply={rv.target_id === user.id && !rv.reply}
                  onReplied={async () => {
                    const fresh = await api(`/users/${user.id}/reviews`);
                    setReviews(Array.isArray(fresh) ? fresh : []);
                  }}
                />
              ))}
            </ul>
          )}
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
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
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
        <span className="block text-[14px] font-semibold text-[#111111]">{label}</span>
        {subtitle && <span className="block text-[12px] text-[#6B7280]">{subtitle}</span>}
      </span>
      <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
    </button>
  );
}

function ReviewRow({ review, canReply, onReplied }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const stars = "★".repeat(review.rating || 0) + "☆".repeat(5 - (review.rating || 0));

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/reviews/${review.id}/reply`, { method: "POST", body: { text: text.trim() } });
      setReplying(false);
      setText("");
      onReplied?.();
    } catch (ex) {
      setErr(ex?.message || "Could not send reply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-3" data-testid={`driver-review-${review.id}`}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#111111]">{review.from_name || "Customer"}</span>
        <span className="text-[13px] font-bold text-[#E55E00]" data-testid={`driver-review-stars-${review.id}`}>
          {stars}
        </span>
      </div>
      {review.comment ? (
        <p className="mt-1 text-[13px] leading-6 text-[#374151]">{review.comment}</p>
      ) : null}
      {review.reply ? (
        <div className="mt-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 text-[12px] text-[#374151]" data-testid={`driver-review-reply-${review.id}`}>
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
            <MessageSquare className="h-3 w-3" /> Your reply
          </span>
          <p className="mt-1">{review.reply}</p>
        </div>
      ) : canReply ? (
        replying ? (
          <form onSubmit={submit} className="mt-2" data-testid={`driver-review-reply-form-${review.id}`}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Write a short reply…"
              className="w-full rounded-[10px] border border-[#E5E7EB] p-2 text-[13px] focus:border-[#D62828] focus:outline-none"
              data-testid={`driver-review-reply-input-${review.id}`}
            />
            {err ? <p className="mt-1 text-[12px] text-[#DC2626]">{err}</p> : null}
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setReplying(false)}
                className="rounded-full px-3 py-1 text-[12px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#D62828] disabled:opacity-60"
                data-testid={`driver-review-reply-submit-${review.id}`}
              >
                {busy ? "Sending…" : "Post reply"}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#111111] underline hover:text-[#D62828]"
            data-testid={`driver-review-reply-btn-${review.id}`}
          >
            <MessageSquare className="h-3 w-3" /> Reply
          </button>
        )
      ) : null}
    </li>
  );
}

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
