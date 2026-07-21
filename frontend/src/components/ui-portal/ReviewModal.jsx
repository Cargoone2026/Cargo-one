import React, { useRef, useState } from "react";
import { X, Star, Camera, ImagePlus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "./Button";

/**
 * ReviewModal — web port of the Expo ReviewModal.
 *
 * POSTs to /api/bookings/:id/review with { rating, comment?, photos[] }.
 * Photo uploads use a <input type="file"> and read files as base64
 * data-URLs (identical wire format to the Expo app).
 */
export function ReviewModal({
  open,
  bookingId,
  targetName,
  onClose,
  onSubmitted,
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;

  async function addFiles(files) {
    const arr = Array.from(files || []).slice(0, 6 - photos.length);
    for (const f of arr) {
      // eslint-disable-next-line no-await-in-loop
      const data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      setPhotos((prev) => [...prev, data]);
    }
  }

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      await api(`/bookings/${bookingId}/review`, {
        method: "POST",
        body: { rating, comment: comment.trim() || undefined, photos },
      });
      onSubmitted?.();
      onClose?.();
      setComment("");
      setPhotos([]);
      setRating(5);
    } catch (e) {
      setErr(e?.message || "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      data-testid="review-modal"
    >
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden bg-white sm:max-w-[520px] sm:rounded-[20px]">
        <header className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex-1">
            <p className="text-[11px] font-bold tracking-[1.5px] text-[#D62828]">
              LEAVE A REVIEW
            </p>
            <h2 className="text-[18px] font-bold text-[#111111]">
              How was {targetName}?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="review-close"
            className="rounded-full p-2 hover:bg-[#F4F4F4]"
          >
            <X className="h-5 w-5 text-[#111111]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Rating stars */}
          <div className="mb-4 flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                data-testid={`review-star-${n}`}
                aria-label={`${n} stars`}
                className="rounded-full p-1"
              >
                <Star
                  className={`h-8 w-8 ${
                    n <= rating
                      ? "fill-[#FF6A00] text-[#FF6A00]"
                      : "text-[#E5E7EB]"
                  }`}
                />
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
              Your review (optional)
            </span>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share how the delivery went"
              data-testid="review-comment"
              className="w-full resize-none rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] text-[#111111] outline-none focus:border-[#111111]"
            />
          </label>

          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-[8px] border border-[#E5E7EB]"
                >
                  <img
                    src={p}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="review-add-photo"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E5E7EB] px-3 py-3 text-[13px] font-semibold text-[#6B7280] hover:border-[#111111]"
          >
            <ImagePlus className="h-4 w-4" />
            Add photo ({photos.length}/6)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />

          {err ? (
            <p
              className="mt-2 text-[12px] text-[#DC2626]"
              data-testid="review-error"
            >
              {err}
            </p>
          ) : null}
        </div>

        <footer className="border-t border-[#E5E7EB] p-3">
          <Button
            title="Submit review"
            variant="primary"
            loading={submitting}
            onClick={submit}
            testID="review-submit"
          />
        </footer>
      </div>
    </div>
  );
}
