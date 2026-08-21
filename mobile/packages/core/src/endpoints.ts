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
  createCheckout: (bookingId: string, paymentMethodType: "card" | "cash" = "card") =>
    api<{ payment_intent_client_secret: string; publishable_key?: string }>(
      `/bookings/${bookingId}/payment/intent`,
      { method: "POST", body: { payment_method_type: paymentMethodType } },
    ),
  createAsapBooking: (jobId: string) =>
    api<Booking>(`/jobs/${jobId}/booking`, { method: "POST" }),
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
  // Profile + account.
  updateProfile: (patch: Record<string, unknown>) =>
    api<User>("/users/me", { method: "PATCH", body: patch }),
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
};

// ── Shared (both roles) ─────────────────────────────────────────────────

export const SharedAPI = {
  me: () => api<User>("/auth/me"),
  tracking: (bookingId: string) => api<TrackingResponse>(`/tracking/${bookingId}`),
  driverProfile: (driverId: string) => api<DriverProfile>(`/users/${driverId}/profile`),
  serviceCatalog: () => api<any>("/service-catalog"),
};
