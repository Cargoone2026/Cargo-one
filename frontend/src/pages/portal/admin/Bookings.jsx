import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X as XIcon, Boxes, MapPin, CreditCard, RotateCcw, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { JobExtras } from "@/components/ui-portal/JobExtras";
import { AcceptanceInfo } from "@/components/ui-portal/AcceptanceInfo";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [refundTarget, setRefundTarget] = useState(null);   // booking pending confirmation
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundMsg, setRefundMsg] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null); // {id, stripe_session_id, stripe_payment_intent_id, ...}
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api("/admin/bookings").catch(() => []);
      setBookings(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openPayment = useCallback(async (b) => {
    setDetailBooking({ ...b, __loading: true });
    setDetailLoading(true);
    try {
      // Fetch the full booking so admin gets stripe_payment_intent_id + refunds[]
      const full = await api(`/bookings/${b.id}`);
      setDetailBooking(full);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const confirmRefund = useCallback(async () => {
    if (!refundTarget) return;
    setRefundBusy(true);
    setRefundMsg(null);
    try {
      const r = await api(`/admin/bookings/${refundTarget.id}/refund`, {
        method: "POST",
        body: { reason: "admin_full_refund" },
      });
      setRefundMsg(r?.note || "Refund recorded successfully.");
      // Reload the list so the new refund_status shows through
      await load();
      // Refresh the open detail panel if same booking
      if (detailBooking?.id === refundTarget.id) {
        const full = await api(`/bookings/${refundTarget.id}`);
        setDetailBooking(full);
      }
    } catch (e) {
      setRefundMsg(e?.message || "Refund failed. Please try again.");
    } finally {
      setRefundBusy(false);
      setRefundTarget(null);
    }
  }, [refundTarget, load, detailBooking]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((b) =>
      `${b.job?.title || ""} ${b.status || ""} ${b.customer_name || ""} ${b.driver_name || ""} ${b.payment_status || ""} ${b.stripe_session_id || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [bookings, q]);

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="admin-bookings">
      <header className="flex items-center justify-between px-4 pt-6 md:px-8">
        <h1 className="text-[30px] font-bold tracking-tight text-[#111111]">Bookings</h1>
        <span className="text-[13px] text-[#6B7280]">
          {filtered.length} of {bookings.length}
        </span>
      </header>

      <div className="mx-4 mt-3 flex items-center gap-2 rounded-[12px] bg-[#F4F4F4] px-3 py-2 md:mx-8">
        <Search className="h-4 w-4 text-[#6B7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, status, customer, driver, cs_test_…"
          data-testid="admin-bookings-search"
          className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9CA3AF]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear" data-testid="admin-bookings-search-clear">
            <XIcon className="h-4 w-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      {refundMsg && (
        <div
          className="mx-4 mt-3 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[12px] text-[#374151] md:mx-8"
          data-testid="admin-refund-msg"
        >
          {refundMsg}
        </div>
      )}

      <ul className="mx-4 mt-3 space-y-3 md:mx-8">
        {loading && bookings.length === 0 ? (
          <li className="text-[13px] text-[#6B7280]">Loading bookings…</li>
        ) : filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 py-16 text-center" data-testid="admin-bookings-empty">
            <Boxes className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[13px] text-[#6B7280]">
              {q ? "No matching bookings." : "No bookings yet."}
            </p>
          </li>
        ) : (
          filtered.map((b) => {
            const isRecovery = b.service_type === "breakdown_recovery";
            const isPaid = b.payment_status === "paid";
            const refunded = b.refund_status === "refunded";
            return (
              <li
                key={b.id}
                className="rounded-[12px] border border-[#E5E7EB] p-4"
                data-testid={`admin-booking-${b.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <p className="min-w-0 truncate text-[16px] font-semibold text-[#111111]">
                      {b.job?.title || "Booking"}
                    </p>
                    {isRecovery && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.5px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5"
                        data-testid={`admin-booking-recovery-badge-${b.id}`}
                      >
                        Recovery
                      </span>
                    )}
                  </div>
                  <StatusPill status={b.status} />
                </div>
                <div className="mt-2 flex items-center gap-1 text-[13px] text-[#6B7280]">
                  <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                  <span className="truncate">
                    {b.job?.pickup_town} → {b.job?.dropoff_town}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-2">
                  <div className="text-[12px] text-[#6B7280]">
                    Customer: {b.customer_name || "—"} · Driver: {b.driver_name || b.assigned_driver_name || "—"}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] ${
                        isPaid ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEF3C7] text-[#B45309]"
                      }`}
                    >
                      {b.payment_status || "unpaid"}
                    </span>
                    {refunded && (
                      <span className="rounded-full bg-[#FEE2E2] text-[#B91C1C] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]">
                        Refunded
                      </span>
                    )}
                    <span className="text-[16px] font-bold text-[#111111]">
                      £{Number(b.total_price || 0).toFixed(0)}
                    </span>
                  </div>
                </div>

                {isPaid && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPayment(b)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1 text-[12px] font-medium hover:bg-[#F9FAFB]"
                      data-testid={`admin-booking-view-payment-${b.id}`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      View payment
                    </button>
                    {!refunded && (
                      <button
                        type="button"
                        onClick={() => setRefundTarget(b)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#FCA5A5] px-3 py-1 text-[12px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                        data-testid={`admin-booking-refund-${b.id}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refund
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>

      {/* Refund confirmation dialog */}
      {refundTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-testid="admin-refund-dialog"
        >
          <div className="w-full max-w-md rounded-[16px] bg-white p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-[#B91C1C] shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-[18px] font-bold text-[#111111]">Refund this booking?</h2>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  This will refund the full deposit of{" "}
                  <span className="font-semibold text-[#111111]">
                    £{Number(refundTarget.deposit_amount || 0).toFixed(2)}
                  </span>{" "}
                  paid via Stripe. The booking will be marked as refunded and cannot be undone from this screen.
                </p>
                <div className="mt-3 rounded-[8px] bg-[#FEE2E2] border border-[#FCA5A5] px-3 py-2 text-[11px] text-[#7F1D1D]">
                  This will call Stripe immediately and issue a real refund on
                  the original card. The audit entry, Stripe refund ID and
                  booking status will update the moment Stripe returns.
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                disabled={refundBusy}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-[13px] font-medium hover:bg-[#F9FAFB] disabled:opacity-60"
                data-testid="admin-refund-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRefund}
                disabled={refundBusy}
                className="rounded-full bg-[#B91C1C] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#991B1B] disabled:opacity-60"
                data-testid="admin-refund-confirm"
              >
                {refundBusy ? "Processing…" : "Confirm refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment detail modal */}
      {detailBooking && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          data-testid="admin-payment-detail"
        >
          <div className="w-full max-w-lg rounded-[16px] bg-white p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-[18px] font-bold text-[#111111]">Payment details</h2>
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                aria-label="Close"
                className="text-[#6B7280] hover:text-[#111111]"
                data-testid="admin-payment-detail-close"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            {detailLoading ? (
              <p className="text-[13px] text-[#6B7280]">Loading…</p>
            ) : (
              <div className="space-y-3 text-[13px]">
                <DetailRow k="Booking ID" v={detailBooking.id} />
                <DetailRow k="Payment status" v={detailBooking.payment_status || "unpaid"} />
                <DetailRow k="Amount total" v={`£${Number(detailBooking.total_price || 0).toFixed(2)}`} />
                <DetailRow k="Deposit paid" v={`£${Number(detailBooking.deposit_amount || 0).toFixed(2)}`} />
                <DetailRow k="Paid at" v={detailBooking.paid_at || "—"} mono />
                <DetailRow k="Stripe session" v={detailBooking.stripe_session_id || "—"} mono />
                <DetailRow k="Payment intent" v={detailBooking.stripe_payment_intent_id || "—"} mono />
                <DetailRow k="Refund status" v={detailBooking.refund_status || "none"} />
                {detailBooking.job && (
                  <div className="pt-3 border-t border-[#F3F4F6]">
                    <AcceptanceInfo
                      job={detailBooking.job}
                      testIdPrefix="admin-booking-accept"
                    />
                  </div>
                )}
                {detailBooking.job && (
                  <div className="pt-3 border-t border-[#F3F4F6]">
                    <JobExtras job={detailBooking.job} />
                  </div>
                )}
                {/* R25 — Authoritative pricing breakdown. Reads the
                    immutable pricing_snapshot persisted at booking creation
                    so historical bookings ALWAYS show the exact
                    calculation used when the customer paid. */}
                {(detailBooking.pricing_snapshot || detailBooking.job?.pricing_snapshot) && (
                  <PricingBreakdownBlock
                    snapshot={detailBooking.pricing_snapshot || detailBooking.job.pricing_snapshot}
                    lineItems={detailBooking.job?.pricing_line_items}
                    booking={detailBooking}
                  />
                )}
                {detailBooking.job && Array.isArray(detailBooking.job.photos) && detailBooking.job.photos.length > 0 && (
                  <div
                    className="pt-3 border-t border-[#F3F4F6]"
                    data-testid="admin-booking-photos-block"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">
                      Customer photos ({detailBooking.job.photos.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {detailBooking.job.photos.map((p, i) => (
                        <a
                          key={i}
                          href={p}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`admin-booking-photo-${i}`}
                        >
                          <img
                            src={p}
                            alt=""
                            className="h-24 w-full rounded-[8px] border border-[#E5E7EB] object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(detailBooking.refunds) && detailBooking.refunds.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mt-4 mb-1">
                      Refund history
                    </p>
                    <ul className="space-y-2">
                      {detailBooking.refunds.map((r) => (
                        <li key={r.id} className="rounded-[8px] border border-[#E5E7EB] p-2 text-[12px]">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{r.state}</span>
                            <span className="text-[#6B7280]">{r.at}</span>
                          </div>
                          <div className="text-[#6B7280] mt-0.5">
                            £{Number(r.amount || 0).toFixed(2)} · admin: {r.admin_name || r.admin_id}
                          </div>
                          {r.stripe_refund_id && (
                            <div className="mt-1 font-mono text-[10px] text-[#374151]">
                              {r.stripe_refund_id}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ k, v, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] pb-2">
      <span className="text-[#6B7280] shrink-0">{k}</span>
      <span className={`text-right break-all text-[#111111] ${mono ? "font-mono text-[11px]" : ""}`}>
        {v}
      </span>
    </div>
  );
}

function PricingBreakdownBlock({ snapshot, lineItems, booking }) {
  if (!snapshot) return null;
  const inputs = snapshot.inputs || {};
  const items = Array.isArray(lineItems) && lineItems.length
    ? lineItems
    : buildLineItemsFromSnapshot(snapshot);

  return (
    <div
      className="pt-3 border-t border-[#F3F4F6]"
      data-testid="admin-booking-pricing-breakdown"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
          Quote breakdown
        </p>
        <span className="text-[10px] font-mono text-[#9CA3AF]">
          engine v{snapshot.engine_version || "—"}
        </span>
      </div>
      <div className="rounded-[10px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 space-y-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
          <span className="text-[#6B7280]">Vehicle</span>
          <span className="text-right font-semibold text-[#111]" data-testid="pricing-vehicle">
            {snapshot.vehicle_rate_card?.label || snapshot.resolved_vehicle_key}
          </span>
          <span className="text-[#6B7280]">Distance</span>
          <span className="text-right font-mono text-[#111]" data-testid="pricing-distance">
            {inputs.distance_miles?.toFixed?.(1) ?? inputs.distance_miles} mi
          </span>
          <span className="text-[#6B7280]">Driving time</span>
          <span className="text-right font-mono text-[#111]">
            {inputs.duration_minutes?.toFixed?.(0) ?? inputs.duration_minutes} min
          </span>
          <span className="text-[#6B7280]">Distance source</span>
          <span
            className="text-right text-[11px] font-semibold"
            style={{
              color: snapshot.low_confidence_distance ? "#B45309" : "#059669",
            }}
            data-testid="pricing-distance-source"
          >
            {inputs.distance_source}
            {snapshot.low_confidence_distance ? " (low-confidence)" : ""}
          </span>
          {inputs.service_type && (
            <>
              <span className="text-[#6B7280]">Service type</span>
              <span className="text-right text-[#111]">{inputs.service_type}</span>
            </>
          )}
          {inputs.service_timing && (
            <>
              <span className="text-[#6B7280]">Timing</span>
              <span className="text-right text-[#111]">{inputs.service_timing}</span>
            </>
          )}
          {inputs.transport_category && (
            <>
              <span className="text-[#6B7280]">Category</span>
              <span className="text-right text-[#111]">{inputs.transport_category}</span>
            </>
          )}
          {inputs.weight_kg != null && (
            <>
              <span className="text-[#6B7280]">Weight</span>
              <span className="text-right font-mono text-[#111]">{inputs.weight_kg} kg</span>
            </>
          )}
          {inputs.volume_m3 != null && (
            <>
              <span className="text-[#6B7280]">Volume</span>
              <span className="text-right font-mono text-[#111]">{inputs.volume_m3} m³</span>
            </>
          )}
        </div>

        <div className="border-t border-[#E5E7EB] pt-2 space-y-1">
          {items.map((li, i) => (
            <div key={i} className="flex justify-between text-[12px]" data-testid={`pricing-line-${li.key}`}>
              <span className="text-[#374151]">
                {li.label}
                {li.detail ? <span className="ml-1 text-[#9CA3AF]">{li.detail}</span> : null}
              </span>
              <span className="font-mono text-[#111]">£{Number(li.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-[#E5E7EB] pt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
          <span className="font-semibold text-[#111]">Driver charge (subtotal)</span>
          <span className="text-right font-bold text-[#111]" data-testid="pricing-driver-charge">
            £{Number(snapshot.driver_charge || 0).toFixed(2)}
          </span>
          <span className="text-[#6B7280]">
            + Cargo One booking fee ({booking?.booking_fee_percent ?? "—"}%)
          </span>
          <span className="text-right font-mono text-[#111]">
            £{Number(booking?.booking_fee || 0).toFixed(2)}
          </span>
          <span className="font-semibold text-[#111]">= Customer total</span>
          <span className="text-right font-bold text-[#DC2626]" data-testid="pricing-customer-total">
            £{Number(booking?.total_price || 0).toFixed(2)}
          </span>
          <span className="text-[#6B7280]">Deposit paid at booking</span>
          <span className="text-right font-mono text-[#111]">
            £{Number(booking?.deposit_amount || 0).toFixed(2)}
          </span>
          <span className="text-[#6B7280]">Balance on delivery</span>
          <span className="text-right font-mono text-[#111]">
            £{Number(booking?.balance_due || 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function buildLineItemsFromSnapshot(snap) {
  // If the job doc predates R25's `pricing_line_items` persistence, we
  // still render a minimal breakdown from the snapshot.
  const items = [];
  const v = snap.vehicle_rate_card || {};
  if (v.base_charge != null) {
    items.push({ key: "vehicle_base", label: `${v.label || "Vehicle"} base charge`, amount: v.base_charge });
  }
  const d = snap.inputs?.distance_miles || 0;
  if (d && v.per_mile) {
    items.push({ key: "distance", label: `Distance (${d.toFixed?.(1) ?? d} mi × £${v.per_mile})`, amount: +(d * v.per_mile).toFixed(2) });
  }
  const t = snap.inputs?.duration_minutes || 0;
  if (t && v.per_minute) {
    items.push({ key: "time", label: `Time (${t.toFixed?.(0) ?? t} min × £${v.per_minute})`, amount: +(t * v.per_minute).toFixed(2) });
  }
  if (snap.operational_flat_fees?.forklift) items.push({ key: "forklift", label: "Forklift", amount: snap.operational_flat_fees.forklift });
  if (snap.operational_flat_fees?.loading_help) items.push({ key: "loading_help", label: "Loading help", amount: snap.operational_flat_fees.loading_help });
  return items;
}

