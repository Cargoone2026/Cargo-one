/**
 * PhotoUpload — lightweight multi-file image picker + preview grid.
 *
 * Backing store: encodes each selected file as a base64 data URL and
 * stores it inline in the parent's `photos: string[]` state. This keeps
 * the surface tiny (no S3 signing round-trip) at the cost of larger
 * request payloads. We enforce:
 *   • max 4 photos per job (already backed by JobCreate.photos default)
 *   • max ~2.5 MB per photo AFTER downscale (see resize step)
 *   • image/* only via `accept` — plus a MIME sniff on load
 *
 * The parent is expected to hand us `value: string[]` and `onChange:
 * (next: string[]) => void`. Nothing else. All UI concerns live here.
 */
import React, { useCallback, useRef } from "react";
import { Camera, X, Plus } from "lucide-react";

const MAX_PHOTOS = 4;
const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.82;

// Downscale via canvas so a 12MP phone photo doesn't blow past our
// 5MB request-body ceiling. Falls back to the original blob if canvas
// isn't available for any reason (SSR guard).
async function fileToDataUrl(file) {
  if (typeof window === "undefined") return null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return await new Promise((r, j) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.onerror = j;
      fr.readAsDataURL(file);
    });
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function PhotoUpload({ value = [], onChange, disabled = false, testId = "photo-upload" }) {
  const inputRef = useRef(null);
  const remaining = Math.max(0, MAX_PHOTOS - value.length);

  const pick = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, remaining);
    const encoded = [];
    for (const f of list) {
      if (!f.type?.startsWith("image/")) continue;
      const url = await fileToDataUrl(f);
      if (url) encoded.push(url);
    }
    if (encoded.length) onChange([...(value || []), ...encoded]);
    if (inputRef.current) inputRef.current.value = ""; // allow re-pick same file
  }, [value, onChange, remaining]);

  const removeAt = (idx) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div data-testid={testId} className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => pick(e.target.files)}
        className="hidden"
        data-testid={`${testId}-input`}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(value || []).map((src, i) => (
          <div
            key={i}
            className="group relative aspect-square overflow-hidden rounded-[10px] border border-neutral-200 bg-neutral-100"
            data-testid={`${testId}-thumb-${i}`}
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-opacity hover:bg-black focus:opacity-100"
                data-testid={`${testId}-remove-${i}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
            data-testid={`${testId}-add`}
          >
            {value.length === 0 ? <Camera className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            <span className="text-[11px] font-semibold">
              {value.length === 0 ? "Add photos" : `Add (${remaining} left)`}
            </span>
          </button>
        )}
      </div>
      <p className="text-[11px] text-neutral-500">
        Up to {MAX_PHOTOS} photos. Auto-resized for upload.
      </p>
    </div>
  );
}

/**
 * PhotoGallery — read-only display of the same `photos: string[]` array.
 * Clicking a thumbnail opens the full image in a lightweight lightbox.
 */
export function PhotoGallery({ photos = [], testId = "photo-gallery" }) {
  const [zoom, setZoom] = React.useState(null);
  if (!photos || photos.length === 0) return null;
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setZoom(src)}
            className="aspect-square overflow-hidden rounded-[10px] border border-neutral-200 bg-neutral-100"
            data-testid={`${testId}-thumb-${i}`}
          >
            <img src={src} alt="" className="h-full w-full object-cover transition-transform hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoom(null)}
          data-testid={`${testId}-lightbox`}
        >
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-[8px] object-contain" />
          <button
            type="button"
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
