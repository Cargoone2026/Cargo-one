/**
 * @cargoone/core — Typed wrappers for the existing CargoOne backend
 * endpoints the mobile apps consume. Zero business logic — everything
 * flows through the shared `api()` client.
 */
import { api } from "./api";
import type {
  Bid,
  Booking,
  DispatchState,
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
    api<{ ok: boolean }>(`/bids/${bidId}/accept`, { method: "POST" }),
  // Scheduled marketplace flow: after acceptBid, the customer creates
  // a Booking against the job — backend picks up the accepted price
  // and computes deposit + total. Returns the full Booking; caller
  // navigates to Payment with booking.id.
  createBooking: (jobId: string) =>
    api<Booking>("/bookings", { method: "POST", body: { job_id: jobId } }),
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
    // Universal customer cancel — server routes to cancel-and-refund
    // for paid bookings, or plain cancel for unpaid/failed-payment
    // bookings. Single call regardless of payment_status.
    api<any>(`/customer/bookings/${bookingId}/cancel`, { method: "POST" }),
  // Cancel a normal posted/accepted Job that has not yet progressed into
  // a paid booking with an assigned driver. No Stripe / no fee — backend
  // rejects with 409 if a driver has accepted or a paid booking exists,
  // in which case the client must use cancelBooking instead.
  cancelJob: (jobId: string) =>
    api<{ ok: true; job_id: string; refund: null } | { ok: true; already_cancelled: true; job_id: string }>(
      `/customer/jobs/${jobId}/cancel`,
      { method: "POST" },
    ),
  cancelPreview: (bookingId: string) =>
    api<any>(`/customer/bookings/${bookingId}/cancel-preview`),
  // Native Stripe PaymentSheet (R71).
  //  * createDepositIntent → mints PaymentIntent + Customer + EphemeralKey
  //    on the backend. Reuses the same open PI on retries so there is no
  //    duplicate charge risk.
  //  * paymentIntentStatus → polling reconciler after PaymentSheet.
  //    Backend finalises against the SAME booking_id regardless of
  //    which path (webhook vs polling) lands first.
  createDepositIntent: (bookingId: string) =>
    api<{
      payment_intent_id: string;
      client_secret: string;
      ephemeral_key: string;
      customer_id: string;
      publishable_key: string;
      amount: number;
      currency: string;
    }>(`/bookings/${bookingId}/deposit-intent`, { method: "POST" }),
  paymentIntentStatus: (paymentIntentId: string) =>
    api<{
      payment_intent_id: string;
      booking_id: string;
      payment_status: "paid" | "initiated" | "failed" | "processing" | string;
      booking_status?: string;
    }>(`/payments/pi-status/${paymentIntentId}`),
  submitReview: (bookingId: string, rating: number, comment?: string) =>
    api<Review>("/reviews", {
      method: "POST",
      body: { booking_id: bookingId, rating, comment },
    }),
  // Messaging + notifications (mirrors web /customer/messages page).
  // Web uses /messages/summary for conversation previews — /threads doesn't
  // exist on the backend. Return shape (per row):
  //   { booking_id, job_title, pickup_town, dropoff_town, counterparty:{
  //     name, profile_photo, rating }, last_message:{ created_at, text, mine,
  //     read_at, delivered_at, has_photo, moderated }, unread_count }
  listThreads: () => api<any[]>("/messages/summary").catch(() => [] as any[]),
  listMessages: (bookingId: string) =>
    api<any[]>(`/bookings/${bookingId}/messages`).catch(() => [] as any[]),
  sendMessage: (bookingId: string, body: string) =>
    api<any>(`/bookings/${bookingId}/messages`, { method: "POST", body: { body } }),
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
  registerPushToken: (token: string, platform: "ios" | "android") =>
    api<{ ok: boolean }>("/users/me/push-tokens", {
      method: "POST",
      body: { token, platform },
    }),
  unregisterPushToken: (token: string) =>
    api<{ ok: boolean }>(`/users/me/push-tokens/${encodeURIComponent(token)}`, {
      method: "DELETE",
    }),
  tracking: (bookingId: string) => api<TrackingResponse>(`/tracking/${bookingId}`),
  // ASAP Uber-like searching state — mirrors what web
  // CustomerDispatch page polls every 4s at /customer/dispatch/{jobId}.
  // Backend returns the job snapshot + assigned_driver_* fields once a
  // driver has accepted, plus optional search_radius_miles.
  dispatchState: (jobId: string) => api<DispatchState>(`/customer/dispatch/${jobId}`),
};

// ── Driver ──────────────────────────────────────────────────────────────

/**
 * R71.16.2 (Driver P0-a) — response types for the driver endpoints as
 * they are actually returned by the existing backend. Kept as
 * best-effort structural types: fields the mobile UI does not read
 * yet are typed as `unknown | undefined` rather than `any` so drift
 * shows up at compile-time.
 */
export interface DriverDashboard {
  user?: {
    id?: string;
    name?: string;
    rating?: number;
    review_count?: number;
    changes_requested_reason?: string | null;
    changes_requested_doc_types?: string[];
    status?: string;
  };
  earnings?: DriverEarningsSummary;
  bids?: { active?: number; accepted?: number };
  fleet?: {
    count?: number;
    active_count?: number;
    capabilities?: string[];
    vehicles?: DriverVehicle[];
  };
  jobs?: {
    nearby_count?: number;
    active_count?: number;
    upcoming_count?: number;
    upcoming?: Booking[];
  };
  verification?: {
    account_status?: string;
    docs_verified?: number;
    docs_pending?: number;
    docs_rejected?: number;
  };
}

export interface DriverEarningsSummary {
  today?: number;
  week?: number;
  month?: number;
  all_time?: number;
  completed_count?: number;
}

export interface DriverLiveStatus {
  online?: boolean;
  last_lat?: number | null;
  last_lng?: number | null;
  last_heartbeat_at?: string | null;
  active_booking_id?: string | null;
  offer_count?: number;
}

export interface DriverBid {
  id: string;
  job_id: string;
  amount: number;
  message?: string;
  status?: "pending" | "accepted" | "rejected" | string;
  is_winning?: boolean;
  created_at?: string;
  job?: Partial<Job>;
}

export interface DriverMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
  delivered_at?: string | null;
  has_photo?: boolean;
  moderated?: boolean;
  mine?: boolean;
}

export interface DriverNotification {
  id: string;
  user_id?: string;
  title: string;
  body: string;
  data?: {
    booking_id?: string;
    job_id?: string;
    type?: string;
    [k: string]: unknown;
  };
  read?: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface DriverVehicle {
  id: string;
  vehicle_type_key?: string;
  vehicle_type_name?: string;
  registration?: string;
  make?: string;
  model?: string;
  year?: number;
  colour?: string;
  capabilities?: string[];
  is_default?: boolean;
  status?: "active" | "pending" | "rejected" | string;
}

export interface DriverDocument {
  id: string;
  doc_type: string;
  status?: "pending" | "verified" | "rejected" | string;
  base64?: string;
  url?: string;
  created_at?: string;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
}

export interface DocumentUploadPayload {
  doc_type: string;
  base64: string;
  filename?: string;
  content_type?: string;
}

export interface POD {
  id?: string;
  booking_id: string;
  photos?: string[];       // base64 or URLs
  signature?: string;      // base64 or URL
  note?: string;
  captured_at?: string;
}

export interface PODUploadPayload {
  photos?: string[];       // base64
  signature?: string;      // base64
  note?: string;
}

export interface DriverCancelReason {
  code: string;
  label: string;
}

export interface DriverCancellationRow {
  booking_id: string;
  reason_code?: string;
  note?: string | null;
  at: string;
  fee_deducted?: number;
  refund_owed?: number;
}

export const DriverAPI = {
  // ── Available jobs / job detail ────────────────────────────────────
  nearbyJobs: (lat?: number, lng?: number, radius = 250) => {
    const q =
      lat != null && lng != null
        ? `?lat=${lat}&lng=${lng}&radius=${radius}`
        : `?radius=${radius}`;
    return api<Job[]>(`/jobs/nearby${q}`);
  },
  jobDetail: (jobId: string) => api<Job>(`/jobs/${jobId}`),
  // R71.16.5 (Driver P1-a) — catalog data driving the AvailableJobs
  // capability filter chips. Categories are exposed via SharedAPI; add
  // a driver-scoped capabilities wrapper here so we do not have to
  // widen SharedAPI (which would touch shared code the Customer app
  // consumes).
  capabilities: () =>
    api<{ key: string; name: string }[]>("/catalog/capabilities").catch(() => []),

  // ── Job actions (Accept / Bid / Claim) ─────────────────────────────
  acceptFixedPrice: (jobId: string) =>
    api<{ booking_id: string }>(`/jobs/${jobId}/accept`, { method: "POST" }),
  submitBid: (
    jobId: string,
    amount: number,
    message?: string,
    etaHours?: number,
  ) =>
    api<Bid>(`/jobs/${jobId}/bids`, {
      method: "POST",
      body: { amount, message, eta_hours: etaHours },
    }),
  // R71.16.2 (Driver P0-a) — ASAP Live-mode claim. Endpoint name unchanged.
  claimAsap: (jobId: string) => api<Booking>(`/jobs/${jobId}/claim`, { method: "POST" }),

  // ── My work lists ───────────────────────────────────────────────────
  // R71.16.2 (Driver P0-a) — REWIRE: mobile previously hit
  //   /driver/bookings          → does NOT exist. Web uses /bookings/mine.
  //   /driver/asap-offers       → does NOT exist. Web uses /driver/live/offers.
  //   /driver/earnings          → does NOT exist. Web reads /driver/dashboard.
  //   /driver/online|offline    → do NOT exist. Web uses /driver/live/*.
  //   /driver/location          → does NOT exist. Web uses /driver/live/heartbeat.
  // The correct backend routes are used below.
  myBookings: () => api<Booking[]>("/bookings/mine"),
  acceptedJobs: () =>
    api<Job[]>("/driver/accepted-jobs").catch(() => [] as Job[]),
  myBids: () => api<DriverBid[]>("/driver/my-bids").catch(() => [] as DriverBid[]),
  bookingDetail: (bookingId: string) => api<Booking>(`/bookings/${bookingId}`),

  // ── Dashboard + Earnings (driven from /driver/dashboard) ───────────
  dashboard: () => api<DriverDashboard>("/driver/dashboard"),
  // R71.16.4 (Driver P0-c) — Global unread-message count for the
  // dashboard message-chime + inbox badge. Matches the endpoint the
  // web Dashboard.jsx polls every 15 s. Add-only on DriverAPI so
  // shared core / CustomerAPI are not affected.
  messagesUnreadCount: () =>
    api<{ total: number }>("/messages/unread-count").catch(() => ({ total: 0 })),
  // Convenience — the web Earnings page re-uses the `earnings` block
  // from /driver/dashboard rather than a dedicated endpoint. Kept
  // separate here so screens can request just what they need without
  // committing to a full dashboard shape.
  earnings: () =>
    api<DriverDashboard>("/driver/dashboard").then((d) => d.earnings || {
      today: 0, week: 0, month: 0, all_time: 0, completed_count: 0,
    }),
  myCancellations: () =>
    api<DriverCancellationRow[]>("/driver/cancellations/mine").catch(
      () => [] as DriverCancellationRow[],
    ),

  // ── Live Mode (ASAP dispatch) ──────────────────────────────────────
  liveStatus: () => api<DriverLiveStatus>("/driver/live/status"),
  goOnline: (lat: number, lng: number) =>
    api<DriverLiveStatus>("/driver/live/online", {
      method: "POST",
      body: { lat, lng },
    }),
  goOffline: () => api<DriverLiveStatus>("/driver/live/offline", { method: "POST" }),
  heartbeat: (lat: number, lng: number) =>
    api<{ ok: boolean }>("/driver/live/heartbeat", {
      method: "POST",
      body: { lat, lng },
    }),
  asapOffers: () => api<Job[]>("/driver/live/offers"),
  // Kept for backwards-compatibility with existing screens that still
  // call DriverAPI.pushLocation(lat, lng). Routes to the correct
  // /driver/live/heartbeat endpoint.
  pushLocation: (lat: number, lng: number) =>
    api<{ ok: boolean }>("/driver/live/heartbeat", {
      method: "POST",
      body: { lat, lng },
    }),

  // ── Active-booking lifecycle ───────────────────────────────────────
  progressStatus: (bookingId: string, status: string) =>
    api<Booking>(`/bookings/${bookingId}/status`, {
      method: "POST",
      body: { status },
    }),
  bookingMessages: (bookingId: string) =>
    api<DriverMessage[]>(`/bookings/${bookingId}/messages`).catch(
      () => [] as DriverMessage[],
    ),
  postMessage: (bookingId: string, body: string) =>
    api<DriverMessage>(`/bookings/${bookingId}/messages`, {
      method: "POST",
      body: { body },
    }),
  markMessagesRead: (bookingId: string) =>
    api<{ ok: boolean }>(`/bookings/${bookingId}/messages/mark-read`, {
      method: "POST",
    }).catch(() => ({ ok: false })),
  presencePing: (bookingId: string) =>
    api<{ ok: boolean }>(`/bookings/${bookingId}/conversation/presence`, {
      method: "POST",
    }).catch(() => ({ ok: false })),
  uploadPOD: (bookingId: string, payload: PODUploadPayload) =>
    api<POD>(`/bookings/${bookingId}/pod`, {
      method: "POST",
      body: payload,
    }),
  fetchPOD: (bookingId: string) =>
    api<POD | null>(`/bookings/${bookingId}/pod`).catch(() => null),
  pushTracking: (bookingId: string, lat: number, lng: number) =>
    api<{ ok: boolean }>(`/tracking/${bookingId}`, {
      method: "POST",
      body: { lat, lng },
    }).catch(() => ({ ok: false })),
  // Driver-initiated cancellation (uses the existing backend endpoint
  // + reason list; the customer refund/cancel path is not touched).
  cancelReasons: () =>
    api<DriverCancelReason[]>("/driver/cancel-reasons").catch(
      () => [] as DriverCancelReason[],
    ),
  cancelBooking: (
    bookingId: string,
    reasonCode: string,
    note?: string,
  ) =>
    api<{ ok: boolean }>(`/driver/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: { reason_code: reasonCode, note },
    }),

  // ── Reviews ─────────────────────────────────────────────────────────
  myReviews: (userId: string) =>
    api<Review[]>(`/users/${userId}/reviews`).catch(() => [] as Review[]),
  replyToReview: (reviewId: string, text: string) =>
    api<{ ok: boolean }>(`/reviews/${reviewId}/reply`, {
      method: "POST",
      body: { text },
    }),

  // ── Notifications ──────────────────────────────────────────────────
  listNotifications: () =>
    api<DriverNotification[]>("/notifications").catch(() => [] as DriverNotification[]),
  markNotificationRead: (id: string) =>
    api<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }).catch(
      () => ({ ok: false }),
    ),

  // ── Fleet (vehicles) ───────────────────────────────────────────────
  listVehicles: () =>
    api<DriverVehicle[]>("/driver/vehicles").catch(() => [] as DriverVehicle[]),
  saveVehicle: (v: Record<string, unknown>) =>
    api<DriverVehicle>(v.id ? `/driver/vehicles/${v.id}` : "/driver/vehicles", {
      method: v.id ? "PUT" : "POST",
      body: v,
    }),
  deleteVehicle: (id: string) =>
    api<{ ok: boolean }>(`/driver/vehicles/${id}`, { method: "DELETE" }),

  // ── Documents / verification ───────────────────────────────────────
  listDocs: () =>
    api<DriverDocument[]>("/users/me/documents").catch(() => [] as DriverDocument[]),
  submitDoc: (payload: DocumentUploadPayload) =>
    api<DriverDocument>("/users/me/documents", {
      method: "POST",
      body: payload,
    }),
  fetchDoc: (docId: string) =>
    api<DriverDocument>(`/users/me/documents/${docId}`),
  resubmitVerification: () =>
    api<{ ok: boolean }>("/auth/me/resubmit-verification", { method: "POST" }),

  // ── Password reset ─────────────────────────────────────────────────
  // R71.16.3 (Driver P0-b) — the shared `requestPasswordReset` helper
  // in @cargoone/core hits `/auth/request-password-reset`, but the
  // backend route is `/auth/forgot-password` (see server.py:1083, and
  // the web page frontend/src/pages/auth/ForgotPassword.jsx which
  // uses that path). Provide the correct wrapper here so the Driver
  // password-reset screen can call it without changing shared code
  // (which would leak into the Customer app).
  requestPasswordReset: (email: string) =>
    api<{ ok: boolean } | Record<string, unknown>>("/auth/forgot-password", {
      method: "POST",
      body: { email: email.trim().toLowerCase() },
      auth: false,
    }),

  // ── Booking-fee preview (driver-charge → customer total) ───────────
  feePreview: (driverCharge: number) =>
    api<FeePreview>(`/booking-fees/preview?driver_charge=${driverCharge}`),

  // ── Push token registration ────────────────────────────────────────
  // Identical shape to CustomerAPI's push registration — kept here so
  // DriverAPI is self-sufficient for the driver push bridge.
  registerPushToken: (token: string, platform: "ios" | "android") =>
    api<{ ok: boolean }>("/users/me/push-tokens", {
      method: "POST",
      body: { token, platform },
    }),
  unregisterPushToken: (token: string) =>
    api<{ ok: boolean }>(`/users/me/push-tokens/${encodeURIComponent(token)}`, {
      method: "DELETE",
    }),
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
