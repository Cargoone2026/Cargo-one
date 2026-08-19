import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Clock,
  Navigation,
  Lock,
  ShieldCheck,
  Star,
  Phone,
  CheckCircle2,
  MessageCircle,
  FileText,
  Send,
  MapPin,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { Button } from "@/components/ui-portal/Button";
import { RouteMap } from "@/components/ui-portal/RouteMap";
import { ActiveJobMapPanel } from "@/components/asap-uber";
import { JobExtras } from "@/components/ui-portal/JobExtras";
import { AcceptanceInfo } from "@/components/ui-portal/AcceptanceInfo";
import { PhotoGallery } from "@/components/ui-portal/PhotoUpload";
import { ReviewModal } from "@/components/ui-portal/ReviewModal";
import { RecentActivity } from "@/components/ui-portal/RecentActivity";
import { AsapDispatchPanel } from "@/components/ui-portal/AsapDispatchPanel";

const ACTIVE_STATUSES = new Set([
  "deposit_paid",
  "confirmed",
  "travelling",
  "arrived",
  "collected",
  "on_route",
]);

function fmtDur(mins) {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function CustomerBookingDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [b, setB] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [pod, setPod] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgErr, setMsgErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showReview, setShowReview] = useState(false);
  // R23 — my submitted review + counterparty's review of me (for reply UI).
  const [myReview, setMyReview] = useState(null);
  const [reviewOfMe, setReviewOfMe] = useState(null);
  const [paymentPollActive, setPaymentPollActive] = useState(false);
  const [err, setErr] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const bk = await api(`/bookings/${id}`);
      setB(bk);
      if (bk.payment_status === "paid") {
        const [t, m, p] = await Promise.all([
          api(`/tracking/${id}`).catch(() => null),
          api(`/bookings/${id}/messages`).catch(() => []),
          api(`/bookings/${id}/pod`).catch(() => null),
        ]);
        setTracking(t);
        setMessages(Array.isArray(m) ? m : []);
        setPod(p);
      }
      // R23 — pull the customer's own submitted review + the driver's
      // review of the customer (so we can render a reply CTA if any).
      if (["completed", "pod_uploaded"].includes(bk?.status)) {
        try {
          const mine = await api(`/bookings/${id}/review/mine`);
          setMyReview(mine || null);
        } catch {
          setMyReview(null);
        }
        try {
          const allForMe = await api(`/users/${bk.customer_id}/reviews`);
          const forThisBooking = (Array.isArray(allForMe) ? allForMe : []).find(
            (r) => r.booking_id === id,
          );
          setReviewOfMe(forThisBooking || null);
        } catch {
          setReviewOfMe(null);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-open the chat tab when reached via the messaging-email link
  // (e.g. https://.../customer/booking/<id>#chat).
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#chat") {
      setTab("chat");
    }
  }, []);

  // R59 — active ASAP bookings live on the new map-first Uber-style
  // dispatch screen (/customer/dispatch/:jobId), not this classic
  // BookingDetail. When a customer lands here for an ACTIVE ASAP (from
  // direct URL, refresh, logout/login, browser history, back-button,
  // etc.) we redirect them to the canonical dispatch route so the
  // experience is uniform across every entry point.
  //
  // We intentionally leave completed / cancelled ASAP bookings on this
  // screen so historical detail (POD, rating, cancellation summary)
  // remains accessible with its full information density.
  useEffect(() => {
    if (!b || !b.job_id) return;
    if ((b.service_timing || b.job?.service_timing) !== "asap") return;
    if (b.status === "completed" || b.status === "cancelled" || b.cancelled_at) return;
    // Replace to keep the browser history clean — the Bookings list
    // already links directly, so this handles the "landed here somehow"
    // fallback rather than being the primary path.
    navigate(`/customer/dispatch/${b.job_id}`, { replace: true });
  }, [b, navigate]);

  // ASAP flow — after deposit is paid and no driver assigned yet, the
  // Finding-a-driver panel is embedded inline below (see JSX). No more
  // sessionStorage-gated bounce to /customer/dispatch — the URL must stay
  // stable across nav/refresh/backgrounding so /customer/booking/:id is
  // always the source of truth. R19 fix.
  useEffect(() => {
    // Kept as a stub so linters don't strip the removed hook — if we ever
    // need to trigger side-effects on the ASAP-unclaimed transition, this
    // is the place.
  }, [b, paymentPollActive, navigate]);

  // Poll tracking every 12s while shipment is en route
  useEffect(() => {
    if (!b || b.payment_status !== "paid") return undefined;
    if (!ACTIVE_STATUSES.has(b.status)) return undefined;
    const iv = setInterval(async () => {
      try {
        const t = await api(`/tracking/${id}`);
        setTracking(t);
      } catch {
        // silent
      }
    }, 12000);
    return () => clearInterval(iv);
  }, [b, id]);

  // Round 3 — presence heartbeat + poll new messages every 6s while the
  // chat tab is open. The heartbeat suppresses new-message emails when the
  // recipient is actively looking at the conversation. Mark-as-read fires
  // on every open + on every incoming message so the sender's WhatsApp-style
  // ticks flip to "read" without needing a full page refresh.
  useEffect(() => {
    if (!id || !b || b.payment_status !== "paid" || tab !== "chat") return undefined;
    let cancelled = false;
    const ping = () => api(`/bookings/${id}/conversation/presence`, { method: "POST" })
      .catch(() => {});
    const markRead = () => api(`/bookings/${id}/messages/mark-read`, { method: "POST" })
      .catch(() => {});
    const refresh = async () => {
      try {
        const m = await api(`/bookings/${id}/messages`);
        if (!cancelled) setMessages(Array.isArray(m) ? m : []);
      } catch { /* silent */ }
    };
    ping();
    markRead();
    refresh();
    const iv1 = setInterval(ping, 20000);      // presence — every 20 s
    const iv2 = setInterval(refresh, 6000);    // fresh msgs + ticks — 6 s
    return () => { cancelled = true; clearInterval(iv1); clearInterval(iv2); };
  }, [id, b, tab]);

  // Stripe return: poll /payments/status until paid, then reload booking.
  // Poll ~30 times over 60 seconds to survive slow webhook processing.
  // If polling times out, the user gets a clear "still processing" message
  // with a manual refresh button — never a blank/dead screen.
  useEffect(() => {
    const payment = params.get("payment");
    const sessionId = params.get("session_id");
    if (payment !== "success" || !sessionId) return undefined;
    setPaymentPollActive(true);
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const s = await api(`/payments/status/${sessionId}`);
        if (s.payment_status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentPollActive(false);
          // Show the celebratory confirmation screen before handing off to
          // the live dispatch / booking detail flow.
          navigate(`/customer/booking-confirmed/${id}`, { replace: true });
        } else if (attempts > 30) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentPollActive(false);
          // Timeout — surface a manual reload option rather than a blank
          // page. The webhook may still finalise moments later.
          setErr("Your payment is still processing. Refresh this page in a few seconds — you won't be charged twice.");
        }
      } catch {
        // silent — /payments/status is public now, so this only fires on
        // a network blip. Continue polling; the webhook is the source of
        // truth and will finalise regardless.
      }
    };
    tick();
    pollRef.current = setInterval(tick, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function payDeposit() {
    if (!id) return;
    setPayLoading(true);
    try {
      const originUrl = window.location.origin;
      const res = await api(`/bookings/${id}/deposit`, {
        method: "POST",
        body: { origin_url: originUrl },
      });
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Payment could not be started");
    } finally {
      setPayLoading(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!msgText.trim() || !id) return;
    const text = msgText.trim();
    setMsgSending(true);
    setMsgErr(null);
    try {
      const m = await api(`/bookings/${id}/messages`, {
        method: "POST",
        body: { text },
      });
      setMessages((prev) => [...prev, m]);
      setMsgText("");
    } catch (ex) {
      setMsgErr(ex?.message || "Message could not be sent");
    } finally {
      setMsgSending(false);
    }
  }

  async function completeBooking() {
    if (!id) return;
    try {
      await api(`/bookings/${id}/complete`, { method: "POST" });
      load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Could not confirm delivery");
    }
  }

  // R68 — memoise map points on PRIMITIVES so RouteMapMapbox /
  // AsapMapCanvas effects don't refire on every parent re-render. Hooks
  // must be called BEFORE the `if (!b)` early return.
  const _job = b?.job || {};
  const _paidForMap = b?.payment_status === "paid";
  const mapPickup = useMemo(
    () =>
      _job.pickup_lat != null
        ? {
            lat: _job.pickup_lat,
            lng: _job.pickup_lng,
            town: _job.pickup_town,
            address: _paidForMap ? _job.pickup_address : undefined,
          }
        : null,
    [_job.pickup_lat, _job.pickup_lng, _job.pickup_town, _job.pickup_address, _paidForMap],
  );
  const mapDropoff = useMemo(
    () =>
      _job.dropoff_lat != null
        ? {
            lat: _job.dropoff_lat,
            lng: _job.dropoff_lng,
            town: _job.dropoff_town,
            address: _paidForMap ? _job.dropoff_address : undefined,
          }
        : null,
    [_job.dropoff_lat, _job.dropoff_lng, _job.dropoff_town, _job.dropoff_address, _paidForMap],
  );
  const _driverLat = tracking?.last_location?.lat;
  const _driverLng = tracking?.last_location?.lng;
  const mapDriver = useMemo(
    () => (_driverLat != null && _driverLng != null ? { lat: _driverLat, lng: _driverLng } : null),
    [_driverLat, _driverLng],
  );

  if (!b) {
    const isReturningFromStripe = params.get("payment") === "success";
    return (
      <div className="min-h-screen bg-white px-4 pt-6 md:px-8" data-testid="customer-booking-detail">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]"
          aria-label="Back"
          data-testid="booking-back"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        {isReturningFromStripe ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center" data-testid="payment-polling-fullscreen">
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-[#D62828] border-t-transparent" />
            <h2 className="text-[20px] font-bold text-[#111111]">Confirming your payment…</h2>
            <p className="max-w-[320px] text-[13px] text-[#6B7280]">
              We're finalising your booking with Stripe. This normally takes a few seconds. You won't be charged twice — you can safely refresh if this screen stays open for more than a minute.
            </p>
            {err ? (
              <div className="mt-2 rounded-[10px] bg-[#FFF7ED] px-3 py-2 text-[13px] text-[#78350F]">{err}</div>
            ) : null}
            <button
              type="button"
              onClick={() => window.location.reload()}
              data-testid="payment-refresh-button"
              className="mt-3 rounded-full bg-[#111111] px-5 py-2 text-[13px] font-semibold text-white hover:bg-black"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/customer", { replace: true })}
              data-testid="payment-back-home-button"
              className="text-[13px] font-medium text-[#6B7280] hover:text-[#111111]"
            >
              Back to my bookings
            </button>
          </div>
        ) : (
          <p className="mt-6 text-[13px] text-[#6B7280]">
            {loading ? "Loading booking…" : "Booking not found."}
          </p>
        )}
      </div>
    );
  }

  const job = b.job || {};
  const paid = b.payment_status === "paid";
  const bookingFee = Number(b.booking_fee ?? b.deposit_amount ?? 0);
  const driverCharge = Number(b.driver_charge ?? b.balance_due ?? 0);
  const total = Number(b.total_price ?? bookingFee + driverCharge);

  // R68 — non-hook derived values (safe to compute below the early return).
  const mapPhase =
    b.status === "travelling"
      ? "to_pickup"
      : b.status === "arrived"
        ? "arrived"
        : b.status === "collected" || b.status === "on_route"
          ? "to_dropoff"
          : b.status === "delivered" || b.status === "completed"
            ? "completed"
            : null;
  const mapTrail = tracking?.trail;
  const mapEtaMinutes = tracking?.eta_minutes ?? job.duration_minutes ?? null;
  const mapDistanceMiles = tracking?.remaining_miles ?? job.distance_miles ?? null;

  // R49 — Rebook helper. Cancelled bookings surface a prominent CTA that
  // stashes the essential job fields in sessionStorage and hops the
  // customer straight into the ASAP / PostJob wizard with the form
  // pre-filled. New deposit is paid as a fresh booking.
  const goRebook = () => {
    try {
      sessionStorage.setItem(
        "cargoone.rebook.payload",
        JSON.stringify({
          source_booking_id: b.id,
          job,
          service_type: b.service_type || job.service_type,
          service_timing: b.service_timing || job.service_timing,
        }),
      );
    } catch {}
    const isAsap = (b.service_timing || job.service_timing) === "asap";
    navigate(isAsap ? "/customer/asap?rebook=1" : "/customer/post-job?rebook=1");
  };

  return (
    <div className="min-h-screen bg-white pb-32 lg:pb-6" data-testid="customer-booking-detail">
      <header className="flex items-center gap-3 px-4 pt-6 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="booking-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">Booking</h1>
        <StatusPill status={b.status} />
      </header>

      {/* R49 — Rebook CTA on cancelled bookings. Full refund already
          issued; this hop pre-fills the ASAP / PostJob wizard so the
          customer can pay a fresh deposit and try again in one tap. */}
      {b.cancelled_at ? (
        <section
          className="mx-4 mt-3 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 md:mx-8"
          data-testid="rebook-banner"
        >
          <p className="text-[13px] font-semibold text-[#991B1B]">
            This booking was cancelled and your deposit was refunded.
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[#7F1D1D]">
            Need this job done? Re-post it as a fresh booking and pay a new
            deposit — we'll pre-fill everything from this booking so it takes
            a few taps.
          </p>
          <button
            type="button"
            onClick={goRebook}
            data-testid="rebook-cta"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#000000]"
          >
            <RotateCcw className="h-4 w-4" />
            Rebook this job
          </button>
        </section>
      ) : null}

      {/* R35 — Cancellation policy banner. Shown on any paid, non-cancelled
          booking regardless of job type (ASAP / scheduled / fixed / bidding).
          Wording depends on whether a driver has accepted yet. */}
      {b.payment_status === "paid" && !b.cancelled_at && b.status !== "completed" ? (
        <div
          className={`mx-4 mt-3 rounded-[10px] px-3 py-2 md:mx-8 ${
            b.assigned_driver_id
              ? "bg-[#FEF3C7] text-[#78350F]"
              : "bg-[#F1F5F9] text-[#334155]"
          }`}
          data-testid="cancellation-policy-banner"
        >
          <p className="text-[12px] leading-snug">
            {b.assigned_driver_id ? (
              <>
                <strong>Driver accepted — cancellation fee now applies.</strong>{" "}
                If you cancel, the fee will be deducted from your deposit only.
                The remaining booking balance will NOT be charged.
              </>
            ) : (
              <>
                <strong>Cancellation policy:</strong> If a driver accepts your booking,
                cancellation charges may apply. Any fee will be deducted from the
                deposit you've already paid — never from the full booking price.
              </>
            )}
          </p>
        </div>
      ) : null}


      {b.service_timing === "asap" && b.payment_status === "paid" && !b.assigned_driver_id && !b.cancelled_at ? (
        <div className="mx-4 mt-4 md:mx-8" data-testid="asap-dispatch-inline">
          <AsapDispatchPanel
            jobId={b.job_id}
            bookingId={b.id}
            onDriverFound={() => load()}
            onCancelled={() => navigate("/customer/bookings")}
          />
        </div>
      ) : null}

      {paymentPollActive ? (
        <div
          className="mx-4 mt-3 flex items-center gap-2 rounded-[10px] bg-[#FFF7ED] px-3 py-2 md:mx-8"
          data-testid="payment-polling"
        >
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#D62828] border-t-transparent" />
          <p className="text-[13px] text-[#78350F]">
            Confirming your Stripe payment…
          </p>
        </div>
      ) : null}

      {b.refund_status === "succeeded" && (
        <div
          className="mx-4 mt-3 rounded-[10px] bg-[#FEE2E2] border border-[#FCA5A5] px-3 py-2 md:mx-8"
          data-testid="booking-refunded-banner"
        >
          <p className="text-[13px] text-[#7F1D1D]">
            <span className="font-semibold">Refunded.</span>{" "}
            Your deposit of £{Number(b.deposit_amount || 0).toFixed(2)} has been
            returned to your original card. It may take 5–10 business days to
            appear on your statement.
          </p>
        </div>
      )}
      {(b.refund_status === "pending" || b.refund_status === "in_progress") && (
        <div
          className="mx-4 mt-3 rounded-[10px] bg-[#FEF3C7] border border-[#FDE68A] px-3 py-2 md:mx-8"
          data-testid="booking-refund-pending-banner"
        >
          <p className="text-[13px] text-[#78350F]">
            <span className="font-semibold">Refund in progress.</span>{" "}
            Stripe is processing your refund and it will appear on your card shortly.
          </p>
        </div>
      )}

      {paid && (
        <nav
          className="mx-4 mt-3 flex rounded-full bg-[#F4F4F4] p-1 md:mx-8"
          data-testid="booking-tabs"
        >
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")} testID="booking-tab-overview">
            Overview
          </TabButton>
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")} testID="booking-tab-chat">
            Chat
          </TabButton>
          <TabButton active={tab === "pod"} onClick={() => setTab("pod")} testID="booking-tab-pod">
            POD
          </TabButton>
        </nav>
      )}

      <div className="mx-auto max-w-[720px] px-4 pt-4 md:px-8">
        {(!paid || tab === "overview") && (
          <div className="space-y-4">
            <h2 className="text-[26px] font-bold leading-tight text-[#111111]">
              {job.title}
            </h2>

            {/* Round 4 — Recent activity timeline. Only rendered post-deposit
                (i.e. when the booking is actually live) so it never appears
                empty for a just-created but unpaid booking. */}
            {paid ? (
              <RecentActivity
                bookingId={id}
                testIdPrefix="customer-recent-activity"
              />
            ) : null}

            {(() => {
              // R68 — active booking → premium panel. Navigation is
              // suppressed for customers. Uses memoised primitives above.
              if (mapPhase && paid) {
                return (
                  <ActiveJobMapPanel
                    role="customer"
                    phase={mapPhase}
                    pickup={mapPickup}
                    dropoff={mapDropoff}
                    driver={mapDriver}
                    trail={mapTrail}
                    etaMinutes={mapEtaMinutes}
                    distanceMiles={mapDistanceMiles}
                    data-testid="customer-active-map-panel"
                  />
                );
              }

              return (
                <RouteMap
                  pickup={mapPickup}
                  dropoff={mapDropoff}
                  driver={mapDriver}
                  trail={mapTrail}
                  height={220}
                  summary={{
                    pickupTown: job.pickup_town,
                    dropoffTown: job.dropoff_town,
                    distanceMiles: job.distance_miles,
                    durationMinutes:
                      tracking?.eta_minutes != null
                        ? tracking.eta_minutes
                        : job.duration_minutes,
                  }}
                />
              );
            })()}

            {tracking?.eta_minutes != null && (
              <div
                className="flex gap-3 rounded-[12px] bg-[#F9FAFB] p-3"
                data-testid="tracking-eta"
              >
                <TrackChip
                  Icon={Clock}
                  color="#D62828"
                  value={fmtDur(tracking.eta_minutes)}
                  label={`ETA to ${tracking.target === "pickup" ? "pickup" : "you"}`}
                />
                <TrackChip
                  Icon={Navigation}
                  color="#FF6A00"
                  value={`${tracking.remaining_miles} mi`}
                  label="Remaining"
                />
              </div>
            )}

            <div className="space-y-3 rounded-[12px] bg-[#F9FAFB] p-4">
              <RouteRow
                color="#16A34A"
                label="Pickup"
                value={paid ? job.pickup_address : job.pickup_town}
              />
              <RouteRow
                color="#D62828"
                label="Dropoff"
                value={paid ? job.dropoff_address : job.dropoff_town}
              />
            </div>

            <AcceptanceInfo job={job} testIdPrefix="customer-booking-accept" />

            <JobExtras job={job} />

            {Array.isArray(job.photos) && job.photos.length > 0 && (
              <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4" data-testid="customer-booking-photos-block">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
                  Job photos
                </p>
                <PhotoGallery photos={job.photos} testId="customer-booking-photos" />
              </div>
            )}

            {b.other_party && (
              <div
                className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] p-3"
                data-testid="party-card"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] text-[16px] font-bold text-white">
                  {(b.other_party.name || "?")[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[14px] font-semibold text-[#111111]">
                      {b.other_party.name}
                    </p>
                    {b.other_party.verified_driver && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-1.5 py-0.5 text-[9px] font-bold text-white"
                        data-testid="party-verified"
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                        VERIFIED
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#6B7280]">
                    <Star className="h-3 w-3 fill-[#FF6A00] text-[#FF6A00]" />
                    <span>
                      {Number(b.other_party.rating || 0).toFixed(1)} ·{" "}
                      {b.other_party.total_jobs || 0} jobs
                    </span>
                  </div>
                  {b.other_party.phone && (
                    <p className="mt-1 text-[13px] text-[#6B7280]" data-testid="party-phone">
                      {b.other_party.phone}
                    </p>
                  )}
                </div>
                {b.other_party.phone ? (
                  <a
                    href={`tel:${b.other_party.phone}`}
                    aria-label="Call"
                    data-testid="call-party-button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F]"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTab("chat")}
                    data-testid="party-chat-fallback"
                    aria-label="Message driver"
                    title="Phone not on file — message via chat"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-[12px] border border-[#E5E7EB] p-4" data-testid="booking-summary">
              <SumRow label="Driver Charge" value={`£${driverCharge.toFixed(2)}`} />
              <SumRow
                label={
                  b.booking_fee_percent
                    ? `Cargo One Booking Fee (${Number(b.booking_fee_percent).toFixed(0)}%)`
                    : "Cargo One Booking Fee"
                }
                value={`£${bookingFee.toFixed(2)}`}
              />
              <SumRow
                label="Total Booking Price"
                value={`£${total.toFixed(2)}`}
                highlight={!b.assigned_driver_id}
                testID="booking-summary-total"
              />
              <div className="my-1 border-t border-[#F3F4F6]" />
              <SumRow
                label="Pay Driver On Delivery"
                value={`£${driverCharge.toFixed(2)}`}
                highlight={Boolean(b.assigned_driver_id)}
                testID="booking-summary-pay-driver"
              />
              <div className="my-1 border-t border-[#F3F4F6]" />
              <SumRow label="Pay Now (Booking Fee)" value={`£${bookingFee.toFixed(2)}`} testID="booking-summary-pay-now" />
            </div>

            {!paid && (
              <div
                className="flex items-start gap-3 rounded-[12px] border border-[#FFEDD5] bg-[#FFF7ED] p-4"
                data-testid="deposit-locked-notice"
              >
                <Lock className="mt-0.5 h-5 w-5 text-[#D62828]" />
                <div className="flex-1 text-[13px] leading-relaxed text-[#111111]">
                  <p className="font-semibold">Contact &amp; chat locked</p>
                  <p className="mt-1 text-[#6B7280]">
                    Pay the £{bookingFee.toFixed(2)} booking fee to unlock
                    driver details, exact addresses, and chat. The remaining
                    £{driverCharge.toFixed(2)} is paid directly to the driver
                    on delivery.
                  </p>
                </div>
              </div>
            )}

            {paid && b.status === "pod_uploaded" && (
              <Button
                title="Confirm delivery & complete"
                variant="primary"
                onClick={completeBooking}
                testID="complete-booking-button"
              />
            )}

            {paid && b.status === "completed" && b.other_party && !myReview && (
              <Button
                title="Leave a review"
                variant="secondary"
                onClick={() => setShowReview(true)}
                testID="leave-review-button"
              />
            )}

            {/* R23 — Once the customer has reviewed, hide the CTA and render
                the submitted review inline. Backend also enforces the
                one-review-per-(booking, from_id) invariant. */}
            {paid && b.status === "completed" && myReview ? (
              <div
                className="rounded-[16px] border border-[#E5E7EB] bg-white p-4"
                data-testid="customer-my-review-card"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[#6B7280]">
                    Your review
                  </span>
                  <span
                    className="text-[15px] font-bold text-[#E55E00]"
                    data-testid="customer-my-review-stars"
                  >
                    {"★".repeat(myReview.rating || 0)}
                    {"☆".repeat(5 - (myReview.rating || 0))}
                  </span>
                </div>
                {myReview.comment ? (
                  <p className="mt-2 text-[13px] leading-6 text-[#374151]">
                    {myReview.comment}
                  </p>
                ) : null}
                {myReview.reply ? (
                  <div
                    className="mt-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 text-[12px] text-[#374151]"
                    data-testid="customer-my-review-driver-reply"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
                      Driver's reply
                    </span>
                    <p className="mt-1">{myReview.reply}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* R23 — Driver's review of the customer (if any). Customer can
                reply exactly once — mirrors the driver-side reply UI. */}
            {paid && b.status === "completed" && reviewOfMe ? (
              <ReviewOfMeCard
                review={reviewOfMe}
                onReplied={async () => {
                  try {
                    const allForMe = await api(`/users/${b.customer_id}/reviews`);
                    const forThis = (Array.isArray(allForMe) ? allForMe : []).find(
                      (r) => r.booking_id === id,
                    );
                    setReviewOfMe(forThis || null);
                  } catch {
                    /* keep prior value */
                  }
                }}
              />
            ) : null}
          </div>
        )}

        {paid && tab === "chat" && (
          <div className="flex h-[65vh] flex-col rounded-[16px] border border-[#E5E7EB] bg-white">
            <div
              className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
              data-testid="chat-messages"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <MessageCircle className="h-10 w-10 text-[#9CA3AF]" />
                  <p className="text-[14px] text-[#6B7280]">
                    Start the conversation with your driver.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  // WhatsApp-style ticks: single grey (sent), double grey
                  // (delivered), double red (read). Non-mine messages don't
                  // show ticks — they're always displayed post-fetch.
                  let tick = null;
                  if (mine) {
                    if (m.read_at) {
                      tick = (
                        <span className="ml-1 text-[10px] font-bold text-[#FCA5A5]" aria-label="Read" title="Read">
                          ✓✓
                        </span>
                      );
                    } else if (m.delivered_at) {
                      tick = (
                        <span className="ml-1 text-[10px] text-white/70" aria-label="Delivered" title="Delivered">
                          ✓✓
                        </span>
                      );
                    } else {
                      tick = (
                        <span className="ml-1 text-[10px] text-white/70" aria-label="Sent" title="Sent">
                          ✓
                        </span>
                      );
                    }
                  }
                  const stamp = m.created_at ? new Date(m.created_at) : null;
                  const time = stamp
                    ? stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                      data-testid={`message-row-${m.id}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-[16px] px-3 py-2 text-[14px] ${
                          mine
                            ? "bg-[#D62828] text-white"
                            : "bg-[#F4F4F4] text-[#111111]"
                        }`}
                      >
                        {m.text}
                      </div>
                      <div className={`mt-0.5 flex items-center gap-1 text-[10px] text-[#9CA3AF] ${
                        mine ? "justify-end" : "justify-start"
                      }`}>
                        <span>{time}</span>
                        {mine ? (
                          <span data-testid={`message-tick-${m.id}`} className="inline-flex items-center">
                            {tick}
                          </span>
                        ) : null}
                      </div>
                      {m.moderated ? (
                        <div
                          className={`mt-1 flex max-w-[75%] items-center gap-1 text-[10.5px] font-medium leading-tight text-[#6B7280] ${
                            mine ? "justify-end" : "justify-start"
                          }`}
                          data-testid={`message-moderated-${m.id}`}
                          title="For your safety, contact details are hidden until pickup is complete."
                        >
                          <ShieldCheck className="h-3 w-3 text-[#D62828]" />
                          <span>
                            {mine
                              ? "Contact details hidden by Cargo One — please share them in person on collection."
                              : "Contact details hidden by Cargo One."}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-2 border-t border-[#E5E7EB] px-3 py-3"
            >
              <input
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Type a message"
                data-testid="chat-input"
                className="flex-1 rounded-full bg-[#F4F4F4] px-4 py-2 text-[14px] text-[#111111] outline-none focus:bg-white focus:ring-1 focus:ring-[#111111]"
              />
              <button
                type="submit"
                disabled={!msgText.trim() || msgSending}
                data-testid="chat-send-button"
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {msgErr ? (
              <p className="border-t border-[#F3F4F6] px-4 py-2 text-[12px] text-[#DC2626]">
                {msgErr}
              </p>
            ) : null}
          </div>
        )}

        {paid && tab === "pod" && (
          <div className="space-y-4">
            <h2 className="text-[24px] font-bold text-[#111111]">
              Proof of Delivery
            </h2>
            {pod ? (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-3 rounded-[12px] bg-[#F0FDF4] p-4"
                  data-testid="pod-delivered"
                >
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
                  <div>
                    <p className="text-[15px] font-semibold text-[#111111]">
                      Delivered
                    </p>
                    <p className="text-[12px] text-[#6B7280]">
                      {new Date(pod.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {Array.isArray(pod.photos) && pod.photos.length > 0 && (
                  <PodBlock label={`Photos (${pod.photos.length})`}>
                    <div className="grid grid-cols-3 gap-2">
                      {pod.photos.map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt=""
                          className="aspect-square rounded-[8px] object-cover"
                          data-testid={`pod-photo-${i}`}
                        />
                      ))}
                    </div>
                  </PodBlock>
                )}
                {pod.signature ? (
                  <PodBlock label="Customer signature">
                    {String(pod.signature).startsWith("data:") ? (
                      <img
                        src={pod.signature}
                        alt="signature"
                        data-testid="pod-signature"
                        className="h-32 w-full rounded-[8px] bg-white object-contain"
                      />
                    ) : (
                      <p className="text-[14px] font-semibold text-[#111111]">
                        Signed ✓
                      </p>
                    )}
                  </PodBlock>
                ) : null}
                {pod.notes ? (
                  <PodBlock label="Driver notes">
                    <p className="text-[14px] text-[#111111]">{pod.notes}</p>
                  </PodBlock>
                ) : null}
                {pod.lat != null ? (
                  <PodBlock
                    label={`GPS · ${new Date(pod.created_at).toLocaleString()}`}
                  >
                    <p className="inline-flex items-center gap-1 text-[13px] text-[#111111]">
                      <MapPin className="h-3.5 w-3.5 text-[#D62828]" />
                      {Number(pod.lat).toFixed(5)},{" "}
                      {Number(pod.lng).toFixed(5)}
                    </p>
                  </PodBlock>
                ) : null}
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 py-10 text-center"
                data-testid="pod-pending"
              >
                <FileText className="h-8 w-8 text-[#9CA3AF]" />
                <p className="text-[14px] text-[#6B7280]">
                  Driver will upload proof of delivery here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {!paid && (
        <div className="fixed inset-x-0 bottom-16 border-t border-[#E5E7EB] bg-white/95 p-3 backdrop-blur lg:bottom-0 lg:left-64">
          <div className="mx-auto max-w-[720px] px-1 md:px-8">
            <Button
              title={`Pay £${bookingFee.toFixed(2)} Booking Fee`}
              variant="primary"
              loading={payLoading}
              onClick={payDeposit}
              testID="pay-deposit-button"
            />
          </div>
        </div>
      )}

      {b.other_party && (
        <ReviewModal
          open={showReview}
          bookingId={b.id}
          targetName={b.other_party.name}
          onClose={() => setShowReview(false)}
          onSubmitted={load}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, testID, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testID}
      className={`flex-1 rounded-full py-2 text-[14px] font-semibold transition-colors ${
        active ? "bg-[#111111] text-white" : "text-[#6B7280] hover:text-[#111111]"
      }`}
    >
      {children}
    </button>
  );
}

function TrackChip({ Icon, color, value, label }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-[10px] bg-white px-3 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </span>
      <div>
        <p className="text-[14px] font-bold text-[#111111]">{value}</p>
        <p className="text-[11px] text-[#6B7280]">{label}</p>
      </div>
    </div>
  );
}

function RouteRow({ color, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.6px] text-[#6B7280]">
          {label}
        </p>
        <p className="text-[15px] font-semibold text-[#111111]">{value || "—"}</p>
      </div>
    </div>
  );
}

function SumRow({ label, value, highlight, testID }) {
  return (
    <div className="flex items-center justify-between" data-testid={testID}>
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span
        className={`${
          highlight
            ? "text-[18px] font-bold text-[#D62828]"
            : "text-[14px] font-semibold text-[#111111]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PodBlock({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
        {label}
      </p>
      {children}
    </div>
  );
}


function ReviewOfMeCard({ review, onReplied }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const stars =
    "★".repeat(review.rating || 0) + "☆".repeat(5 - (review.rating || 0));

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/reviews/${review.id}/reply`, {
        method: "POST",
        body: { text: text.trim() },
      });
      setReplying(false);
      setText("");
      onReplied?.();
    } catch (ex) {
      setErr(ex?.message || "Could not send reply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-[16px] border border-[#E5E7EB] bg-white p-4"
      data-testid="customer-review-of-me-card"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[#6B7280]">
          Your driver reviewed you
        </span>
        <span
          className="text-[15px] font-bold text-[#E55E00]"
          data-testid="customer-review-of-me-stars"
        >
          {stars}
        </span>
      </div>
      {review.comment ? (
        <p className="mt-2 text-[13px] leading-6 text-[#374151]">
          {review.comment}
        </p>
      ) : null}
      {review.reply ? (
        <div className="mt-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 text-[12px] text-[#374151]" data-testid="customer-review-of-me-reply">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">
            Your reply
          </span>
          <p className="mt-1">{review.reply}</p>
        </div>
      ) : replying ? (
        <form onSubmit={submit} className="mt-2" data-testid="customer-review-reply-form">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Write a short reply…"
            className="w-full rounded-[10px] border border-[#E5E7EB] p-2 text-[13px] focus:border-[#D62828] focus:outline-none"
            data-testid="customer-review-reply-input"
          />
          {err ? <p className="mt-1 text-[12px] text-[#DC2626]">{err}</p> : null}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setReplying(false)}
              className="rounded-full px-3 py-1 text-[12px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#D62828] disabled:opacity-60"
              data-testid="customer-review-reply-submit"
            >
              {busy ? "Sending…" : "Post reply"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setReplying(true)}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#111111] underline hover:text-[#D62828]"
          data-testid="customer-review-reply-btn"
        >
          Reply
        </button>
      )}
    </div>
  );
}
