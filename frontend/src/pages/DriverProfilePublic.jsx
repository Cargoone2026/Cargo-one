import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Star, ShieldCheck, Truck, Calendar } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Driver reputation page — restores parity with the original
 * Expo `app/driver-profile/[id].tsx`. Backend endpoint
 * `GET /api/users/:user_id/profile` requires an authenticated user
 * (any role) and exposes safe public-facing reputation data (name,
 * rating, review count, vehicle summary, review excerpts). This is
 * the same in-app "view a driver's public profile" surface as the
 * Expo source — accessible to any signed-in user, not to search
 * engines. Was accidentally omitted from the React Web migration;
 * restored in Phase 2D.
 *
 * Route: /driver-profile/:id
 */
export default function DriverProfilePublic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNeedsAuth(false);
    try {
      const res = await api(`/users/${id}/profile`);
      setP(res);
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("token") || msg.includes("401") || msg.includes("unauthor")) {
        setNeedsAuth(true);
      }
      setP(null);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 md:px-8" data-testid="driver-profile-public">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="driver-profile-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <p className="mt-6 text-[13px] text-[#6B7280]">Loading profile…</p>
      </div>
    );
  }
  if (!p) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 md:px-8" data-testid="driver-profile-public">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="driver-profile-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        {needsAuth ? (
          <div className="mt-6" data-testid="dpp-signin-required">
            <p className="text-[15px] font-semibold text-[#111111]">
              Sign in to view driver profiles
            </p>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              Driver reputation pages are visible to signed-in Cargo One users.
            </p>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/auth/login?next=${encodeURIComponent(
                    `/driver-profile/${id}`,
                  )}`,
                )
              }
              data-testid="dpp-signin-cta"
              className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#D62828] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#B01F1F]"
            >
              Sign in
            </button>
          </div>
        ) : (
          <p className="mt-6 text-[13px] text-[#DC2626]">Profile not found.</p>
        )}
      </div>
    );
  }

  const initials = (p.name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const memberSince = p.created_at
    ? new Date(p.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : "—";

  return (
    <div className="min-h-screen bg-white pb-8" data-testid="driver-profile-public">
      <header className="flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="driver-profile-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">Public profile</h1>
      </header>

      <div className="mx-auto max-w-[720px] space-y-4 px-4 py-6 md:px-8">
        <section
          className="flex flex-col items-center gap-2 rounded-[16px] border border-[#E5E7EB] p-6 text-center"
          data-testid="dpp-header"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#D62828] text-[30px] font-bold text-white">
            {p.profile_photo ? (
              <img
                src={p.profile_photo}
                alt=""
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <h2 className="mt-2 text-[22px] font-bold text-[#111111]">{p.name}</h2>
          <p className="text-[12px] uppercase tracking-[1.5px] text-[#6B7280]">
            {p.role === "driver" ? "Verified transport partner" : p.role}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {p.verified_driver && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-3 py-1 text-[11px] font-bold tracking-[0.8px] text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                VERIFIED DRIVER
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-3 py-1 text-[12px] font-semibold text-[#E55E00]">
              <Star className="h-3.5 w-3.5" />
              {Number(p.rating || 0).toFixed(1)} · {p.total_jobs || 0} jobs
            </span>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="dpp-stats">
          <Stat label="Rating" value={`${Number(p.rating || 5).toFixed(1)}★`} />
          <Stat label="Deliveries" value={String(p.completed_bookings ?? p.total_jobs ?? 0)} />
          <Stat label="Reviews" value={String(p.review_count ?? 0)} />
        </div>

        {p.vehicle && (
          <section
            className="rounded-[16px] border border-[#E5E7EB] p-4"
            data-testid="dpp-vehicle"
          >
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#D62828]" />
              <h3 className="text-[15px] font-bold text-[#111111]">Vehicle</h3>
            </div>
            <p className="mt-2 text-[14px] text-[#111111]">
              {p.vehicle.vehicle_type_name ||
                p.vehicle.vehicle_type_key ||
                "Vehicle"}
              {p.vehicle.registration ? ` · ${p.vehicle.registration}` : ""}
            </p>
          </section>
        )}

        <section
          className="rounded-[16px] border border-[#E5E7EB] p-4"
          data-testid="dpp-member"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#D62828]" />
            <p className="text-[13px] text-[#6B7280]">Member since {memberSince}</p>
          </div>
        </section>

        {Array.isArray(p.reviews) && p.reviews.length > 0 && (
          <section data-testid="dpp-reviews">
            <h3 className="mb-3 text-[18px] font-bold text-[#111111]">
              Reviews ({p.reviews.length})
            </h3>
            <ul className="space-y-3">
              {p.reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[12px] border border-[#E5E7EB] p-4"
                  data-testid={`dpp-review-${r.id}`}
                >
                  <div className="flex items-center gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.round(r.rating || 0)
                            ? "fill-[#FF6A00] text-[#FF6A00]"
                            : "text-[#E5E7EB]"
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-[12px] text-[#6B7280]">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-[14px] leading-relaxed text-[#111111]">
                      {r.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-[12px] bg-[#F9FAFB] p-3">
      <p className="text-[20px] font-bold text-[#111111]">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">
        {label}
      </p>
    </div>
  );
}
