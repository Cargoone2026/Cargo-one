/**
 * @cargoone/core — Typed wrappers for the existing CargoOne backend
 * endpoints the mobile apps consume. Zero business logic — everything
 * flows through the shared `api()` client.
 */
import { api } from "./api";
import type {
  Bid,
  Booking,
  DriverProfile,
  Job,
  Review,
  TrackingResponse,
  User,
} from "./types";

// ── Customer ────────────────────────────────────────────────────────────

export const CustomerAPI = {
  myBookings: () => api<Booking[]>("/bookings/mine"),
  myJobs: () => api<Job[]>("/jobs/mine"),
  bookingDetail: (bookingId: string) => api<Booking>(`/bookings/${bookingId}`),
  jobDetail: (jobId: string) => api<Job>(`/jobs/${jobId}`),
  createJob: (payload: Record<string, unknown>) =>
    api<Job>("/jobs", { method: "POST", body: payload }),
  listBids: (jobId: string) => api<Bid[]>(`/jobs/${jobId}/bids`),
  acceptBid: (jobId: string, bidId: string) =>
    api<{ booking_id: string }>(`/jobs/${jobId}/bids/${bidId}/accept`, { method: "POST" }),
  driverProfile: (driverId: string) => api<DriverProfile>(`/users/${driverId}/profile`),
  createCheckout: (bookingId: string, originUrl: string) =>
    api<{ session_id: string; url: string }>(
      `/bookings/${bookingId}/deposit`,
      { method: "POST", body: { origin_url: originUrl } },
    ),
  paymentStatus: (sessionId: string) =>
    api<{ payment_status: "paid" | "initiated" | "expired" | "unpaid"; status?: string }>(
      `/payments/status/${sessionId}`,
    ),
  createAsapBooking: (jobId: string) =>
    api<Booking>(`/bookings`, { method: "POST", body: { job_id: jobId } }),
  cancelBooking: (bookingId: string) =>
    api<Booking>(`/bookings/${bookingId}/cancel`, { method: "POST" }),
  submitReview: (bookingId: string, rating: number, comment?: string) =>
    api<Review>("/reviews", {
      method: "POST",
      body: { booking_id: bookingId, rating, comment },
    }),
  // Messaging + notifications (mirrors web /customer/messages page).
  listThreads: () => api<any[]>("/threads").catch(() => [] as any[]),
  listMessages: (threadId: string) =>
    api<any[]>(`/threads/${threadId}/messages`).catch(() => [] as any[]),
  sendMessage: (threadId: string, body: string) =>
    api<any>(`/threads/${threadId}/messages`, { method: "POST", body: { body } }),
  listNotifications: () => api<any[]>("/notifications").catch(() => [] as any[]),
  markNotificationRead: (id: string) =>
    api<any>(`/notifications/${id}/read`, { method: "POST" }).catch(() => null),
  // Profile + account (aligned with web PUT /auth/me + change-password + document
  // upload contract used by frontend/src/pages/portal/customer/Profile.jsx).
  updateProfile: (patch: Record<string, unknown>) =>
    api<User>("/auth/me", { method: "PUT", body: patch }),
  changePassword: (current_password: string, new_password: string) =>
    api<{ ok: boolean; access_token?: string }>("/auth/me/change-password", {
      method: "POST",
      body: { current_password, new_password },
    }),
  uploadProfilePhoto: (base64: string) =>
    api<any>("/users/me/documents", {
      method: "POST",
      body: { doc_type: "profile_photo", base64 },
    }),
  deleteAccount: () => api<any>("/users/me", { method: "DELETE" }),
  tracking: (bookingId: string) => api<TrackingResponse>(`/tracking/${bookingId}`),
};

// ── Driver ──────────────────────────────────────────────────────────────

export const DriverAPI = {
  nearbyJobs: (lat?: number, lng?: number, radius = 250) => {
    const q =
      lat != null && lng != null
        ? `?lat=${lat}&lng=${lng}&radius=${radius}`
        : `?radius=${radius}`;
    return api<Job[]>(`/jobs/nearby${q}`);
  },
  jobDetail: (jobId: string) => api<Job>(`/jobs/${jobId}`),
  submitBid: (jobId: string, amount: number, message?: string, etaHours?: number) =>
    api<Bid>(`/jobs/${jobId}/bids`, {
      method: "POST",
      body: { amount, message, eta_hours: etaHours },
    }),
  acceptFixedPrice: (jobId: string) =>
    api<{ booking_id: string }>(`/jobs/${jobId}/accept`, { method: "POST" }),
  myBookings: () => api<Booking[]>("/driver/bookings"),
  bookingDetail: (bookingId: string) => api<Booking>(`/bookings/${bookingId}`),
  progressStatus: (bookingId: string, status: string) =>
    api<Booking>(`/bookings/${bookingId}/status`, { method: "POST", body: { status } }),
  earnings: () => api<{ total: number; period: string; jobs: number }>("/driver/earnings"),
  asapOffers: () => api<Job[]>("/driver/asap-offers"),
  claimAsap: (jobId: string) => api<Booking>(`/jobs/${jobId}/claim`, { method: "POST" }),
  goOnline: () => api("/driver/online", { method: "POST" }),
  goOffline: () => api("/driver/offline", { method: "POST" }),
  pushLocation: (lat: number, lng: number) =>
    api("/driver/location", { method: "POST", body: { lat, lng } }),
  // Fleet + additional lists used by native My Jobs / Fleet / Profile.
  acceptedJobs: () => api<Job[]>("/driver/accepted-jobs").catch(() => [] as Job[]),
  myBids: () => api<any[]>("/driver/my-bids").catch(() => [] as any[]),
  listVehicles: () => api<any[]>("/driver/vehicles").catch(() => [] as any[]),
  saveVehicle: (v: Record<string, unknown>) =>
    api<any>(v.id ? `/driver/vehicles/${v.id}` : "/driver/vehicles", {
      method: v.id ? "PUT" : "POST",
      body: v,
    }),
  deleteVehicle: (id: string) => api<any>(`/driver/vehicles/${id}`, { method: "DELETE" }),
  myReviews: (userId: string) => api<any[]>(`/users/${userId}/reviews`).catch(() => [] as any[]),
};

// ── Shared (both roles) ─────────────────────────────────────────────────

export interface GeoSuggestion {
  place_id?: string;
  formatted_address: string;
  town?: string;
}
export interface GeoAutocompleteResponse {
  suggestions: GeoSuggestion[];
  source: "google" | "manual";
}
export interface GeoDetails {
  formatted_address?: string;
  address_line?: string;
  postcode?: string;
  town?: string;
  region?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  source: "google" | "manual";
}
export interface QuoteEstimate {
  distance_miles: number;
  duration_minutes: number;
  suggested_price: number;
  requires_manual_review?: boolean;
  origin_country?: string;
  destination_country?: string;
  manual_review_message?: string;
}
export interface FeePreview {
  driver_charge: number;
  booking_fee: number;
  booking_fee_percent?: number;
  customer_total: number;
}

export const SharedAPI = {
  me: () => api<User>("/auth/me"),
  tracking: (bookingId: string) => api<TrackingResponse>(`/tracking/${bookingId}`),
  driverProfile: (driverId: string) => api<DriverProfile>(`/users/${driverId}/profile`),
  serviceCatalog: () => api<any>("/service-catalog"),
  categories: () => api<any[]>("/catalog/categories").catch(() => [] as any[]),
  vehicles: () => api<any[]>("/catalog/vehicles").catch(() => [] as any[]),
  // Server-side geocoding proxy — Google key stays backend-only.
  geoAutocomplete: (q: string) =>
    api<GeoAutocompleteResponse>(`/geo/autocomplete?q=${encodeURIComponent(q)}`).catch(
      () => ({ suggestions: [], source: "manual" as const }),
    ),
  geoDetails: (placeId: string) =>
    api<GeoDetails>(`/geo/details?place_id=${encodeURIComponent(placeId)}`),
  quoteEstimate: (params: Record<string, string | number | undefined | null>) => {
    const parts = Object.entries(params)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
    return api<QuoteEstimate>(`/quote/estimate?${parts.join("&")}`);
  },
  feePreview: (driverCharge: number) =>
    api<FeePreview>(`/booking-fees/preview?driver_charge=${driverCharge}`),
  asapQuote: (body: Record<string, unknown>) =>
    api<any>("/asap/quote", { method: "POST", body }),
  asapVehicles: () =>
    api<{ transport?: any[]; recovery?: any[] }>("/asap/vehicles").catch(() => ({
      transport: [],
      recovery: [],
    })),
};
