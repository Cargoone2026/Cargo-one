/**
 * @cargoone/core — Booking and job data helpers.
 *
 * Each of these is a **pure function** — no React, no side effects, no
 * network. That keeps them cheap to reason about and easy to unit test.
 * The business rules they encode were already certified on web (R68/R70).
 */
import type { Booking, Job } from "./types";

/** R70 — newest-first ordering used by both apps' list screens. */
export function sortByCreatedAtDesc<T extends { created_at?: string; id?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const bt = b.created_at || "";
    const at = a.created_at || "";
    if (bt !== at) return bt.localeCompare(at);
    return (b.id || "").localeCompare(a.id || "");
  });
}

/**
 * Map booking.status → active-job-map phase (mirrors R68 web logic).
 * Returns `null` for pre-active states (quote/deposit_paid) so callers
 * can render a compact preview instead of the full active panel.
 */
export function bookingPhase(
  status: string | undefined,
): "to_pickup" | "arrived" | "to_dropoff" | "completed" | null {
  switch (status) {
    case "travelling":
      return "to_pickup";
    case "arrived":
      return "arrived";
    case "collected":
    case "on_route":
      return "to_dropoff";
    case "delivered":
    case "completed":
      return "completed";
    default:
      return null;
  }
}

/** Which map target we should Navigate to for a given phase. */
export function navigateTargetForPhase(
  phase: ReturnType<typeof bookingPhase>,
  job: Pick<Job, "pickup_lat" | "pickup_lng" | "dropoff_lat" | "dropoff_lng"> | null | undefined,
): { lat: number; lng: number } | null {
  if (!job) return null;
  if (phase === "to_dropoff" || phase === "arrived") {
    if (job.dropoff_lat != null && job.dropoff_lng != null) {
      return { lat: job.dropoff_lat, lng: job.dropoff_lng };
    }
  }
  if (job.pickup_lat != null && job.pickup_lng != null) {
    return { lat: job.pickup_lat, lng: job.pickup_lng };
  }
  return null;
}

/**
 * Merge active bookings + unpaid posted jobs into one newest-first list
 * (matches the customer-web Bookings.jsx behaviour post-R70).
 */
export function mergeActive<
  B extends { created_at?: string; id?: string },
  J extends { created_at?: string; id?: string },
>(active: B[], openJobs: J[]): (B | J)[] {
  return sortByCreatedAtDesc<(B | J) & { created_at?: string; id?: string }>([
    ...(active as any),
    ...(openJobs as any),
  ]) as (B | J)[];
}

/** Format currency (£) for display. */
export function money(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "£0";
  return `£${Number(n).toFixed(0)}`;
}

/** Format a distance (miles). */
export function miles(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Number(n).toFixed(1)} mi`;
}

/** Format an ETA in minutes → "2h 15m". */
export function eta(minutes: number | undefined | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Does the caller (customer) have permission to view driver contact yet? */
export function contactVisible(booking: Booking | null | undefined): boolean {
  if (!booking) return false;
  if (booking.payment_status !== "paid") return false;
  return ["travelling", "arrived", "collected", "on_route", "delivered", "completed"].includes(
    booking.status,
  );
}
