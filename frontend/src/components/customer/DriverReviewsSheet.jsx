import React, { useCallback, useEffect, useState } from "react";
import { X, Star, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

/**
 * R69 — Driver reviews modal.
 *
 * Lightweight bottom sheet the customer can open to inspect a driver's
 * rating, verified status and INDIVIDUAL REVIEW COMMENTS *before* they
 * accept a bid (Bidding jobs) or before they pay the deposit on an
 * accepted Fixed Price job.
 *
 * Backed by `GET /api/users/{driver_id}/profile` which already returns
 * `rating`, `review_count`, `verified_driver`, and the last 10 review
 * documents (rating + comment + from_name + created_at). No private
 * contact information is exposed — R37 remains intact.
 */
export function DriverReviewsSheet({ driverId, driverName, open, onClose }) {
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api(`/users/${driverId}/profile`);
      setP(res);
    } catch (e) {
      setErr(e?.message || "Could not load reviews");
      setP(null);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const reviews = Array.isArray(p?.reviews) ? p.reviews : [];
  const rating = Number(p?.rating || 0);
  const reviewCount = Number(p?.review_count ?? reviews.length ?? 0);
  const verified = !!p?.verified_driver;
  const displayName = driverName || p?.name || "Driver";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-reviews-title"
      data-testid="driver-reviews-sheet"
    >
      <div
        className="w-full max-w-[520px] rounded-t-[20px] bg-white p-5 sm:rounded-[20px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 id="driver-reviews-title" className="truncate text-[18px] font-bold text-[#111111]">
              Reviews for {displayName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-[#FF6A00] text-[#FF6A00]" />
                <b className="text-[#111111]">{rating.toFixed(1)}</b>
                <span>· {reviewCount} review{reviewCount === 1 ? "" : "s"}</span>
              </span>
              {verified && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.5px] text-white"
                  data-testid="driver-reviews-verified"
                >
                  <ShieldCheck className="h-2.5 w-2.5" />
                  VERIFIED
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reviews"
            data-testid="driver-reviews-close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
          >
            <X className="h-4 w-4 text-[#111111]" />
          </button>
        </div>

        {loading && (
          <p className="py-8 text-center text-[13px] text-[#6B7280]" data-testid="driver-reviews-loading">
            Loading reviews…
          </p>
        )}
        {err && !loading && (
          <p className="py-4 text-[13px] text-[#DC2626]" data-testid="driver-reviews-error">
            {err}
          </p>
        )}
        {!loading && !err && reviews.length === 0 && (
          <p className="py-8 text-center text-[13px] text-[#6B7280]" data-testid="driver-reviews-empty">
            This driver hasn&apos;t received any written reviews yet.
          </p>
        )}
        {!loading && reviews.length > 0 && (
          <ul className="space-y-3" data-testid="driver-reviews-list">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-[12px] border border-[#E5E7EB] p-3"
                data-testid={`driver-review-${r.id}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className="flex items-center gap-0.5"
                    aria-label={`${r.rating || 0} out of 5 stars`}
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < Math.round(r.rating || 0)
                            ? "fill-[#FF6A00] text-[#FF6A00]"
                            : "text-[#E5E7EB]"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF]">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                {r.comment && (
                  <p className="text-[13px] leading-relaxed text-[#111111]">
                    {r.comment}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-[#6B7280]">
                  — {r.from_name || "Customer"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DriverReviewsSheet;
