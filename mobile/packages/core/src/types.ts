/**
 * @cargoone/core — shared TypeScript types.
 *
 * Mirrors the JSON shapes returned by the existing CargoOne backend.
 * Kept intentionally narrow — only the fields we actually consume from
 * mobile clients. New fields on the server won't break the app.
 */

export type UserRole = "customer" | "driver" | "admin";

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  verified_driver?: boolean;
  approval_state?: "pending" | "approved" | "changes_requested" | "suspended";
  rating?: number;
  review_count?: number;
  total_jobs?: number;
  profile_photo?: string | null;
  vehicle?: { key?: string; make?: string; reg?: string } | null;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type ServiceTiming = "asap" | "scheduled";
export type PricingType = "fixed" | "bidding" | "quote";

export interface JobPoint {
  lat: number;
  lng: number;
  town?: string;
  address?: string;
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  category?: string;
  service_type?: "transport" | "recovery";
  service_timing?: ServiceTiming;
  pricing_type?: PricingType;
  fixed_price?: number | null;
  accepted_price?: number | null;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_town?: string;
  pickup_address?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  dropoff_town?: string;
  dropoff_address?: string;
  distance_miles?: number;
  duration_minutes?: number;
  requested_vehicle_key?: string;
  requested_vehicle_name?: string;
  vehicle_required?: string;
  recommended_vehicle?: string;
  // Cargo details (mirrors backend JobCreate / job doc)
  weight_kg?: number;
  volume_m3?: number;
  pallets?: number;
  item_count?: number;
  dimensions?: string;
  dimensions_l_m?: number;
  dimensions_w_m?: number;
  dimensions_h_m?: number;
  needs_forklift?: boolean;
  needs_loading_help?: boolean;
  loading_help?: boolean;
  // Photos of the cargo (backend returns URL strings post-photo-url rewrite)
  photos?: string[];
  status: string;
  customer_id: string;
  assigned_driver_id?: string | null;
  assigned_driver_name?: string | null;
  assigned_driver_rating?: number | null;
  cancelled_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  job_id: string;
  customer_id: string;
  driver_id?: string | null;
  status: string;
  payment_status: "pending" | "paid" | "refunded";
  total_price?: number;
  customer_total?: number;
  deposit_amount?: number;
  balance_due?: number;
  driver_charge?: number;
  booking_fee?: number;
  booking_fee_percent?: number;
  service_timing?: ServiceTiming;
  // Timeline
  created_at: string;
  updated_at?: string;
  accepted_at?: string | null;
  paid_at?: string | null;
  cancelled_at?: string | null;
  // Denormalised driver identity (mirrored from job at accept-time)
  assigned_driver_id?: string | null;
  assigned_driver_name?: string | null;
  assigned_driver_rating?: number | null;
  driver_accepted?: boolean;
  // Populated by /bookings/{id} — full job payload + `other_party` = the
  // other user in the booking, released only after deposit is paid AND
  // a driver has actually accepted.
  job?: Job;
  other_party?: User | null;
  // Proof of delivery
  pod_uploaded?: boolean;
}

export interface Bid {
  id: string;
  job_id: string;
  driver_id: string;
  driver_name?: string;
  driver_rating?: number;
  driver_review_count?: number;
  amount: number;
  message?: string;
  eta_hours?: number;
  verified_driver?: boolean;
  total_jobs?: number;
  status: string;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  from_id: string;
  from_name?: string;
  from_role: UserRole;
  target_id: string;
  rating: number;
  comment?: string;
  photos?: string[];
  created_at: string;
}

export interface DriverProfile extends User {
  reviews: Review[];
  completed_bookings: number;
}

export interface TrackingResponse {
  booking_id: string;
  last_location?: { lat: number; lng: number; ts?: string } | null;
  eta_minutes?: number | null;
  remaining_miles?: number | null;
  trail?: { lat: number; lng: number }[];
  active: boolean;
}
