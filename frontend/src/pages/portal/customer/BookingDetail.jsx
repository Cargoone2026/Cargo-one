import React, { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { Button } from "@/components/ui-portal/Button";
import { RouteMap } from "@/components/ui-portal/RouteMap";
import { JobExtras } from "@/components/ui-portal/JobExtras";
import { PhotoGallery } from "@/components/ui-portal/PhotoUpload";
import { ReviewModal } from "@/components/ui-portal/ReviewModal";

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
  const [paymentPollActive, setPaymentPollActive] = useState(false);
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
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // ASAP flow — after deposit is paid and no driver assigned yet on THIS
  // booking, bounce the customer to /customer/dispatch/{jobId} so they see
  // the live "searching for a driver" screen. Guarded by a session flag so
  // we only fire the redirect ONCE per booking (otherwise, when the Dispatch
  // page later hands control back to us after a driver claim, we'd loop).
  useEffect(() => {
    if (!b) return;
    if (b.service_timing !== "asap") return;
    if (b.payment_status !== "paid") return;
    if (b.assigned_driver_id) return;
    if (paymentPollActive) return;
    // Once per booking — the Dispatch page owns the "searching" experience.
    // If the customer later comes back to this URL directly, we respect that.
    let alreadyBounced = false;
    try {
      alreadyBounced = sessionStorage.getItem(`asap-bounced:${b.id}`) === "1";
    } catch { /* ignore */ }
    if (alreadyBounced) return;
    let jobId = null;
    try { jobId = sessionStorage.getItem(`asap:${b.id}`); } catch { /* ignore */ }
    jobId = jobId || b.job_id;
    if (!jobId) return;
    try { sessionStorage.setItem(`asap-bounced:${b.id}`, "1"); } catch { /* ignore */ }
    navigate(`/customer/dispatch/${jobId}`, { replace: true });
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

  // Stripe return: poll /payments/status until paid, then reload booking
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
        } else if (attempts > 10) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentPollActive(false);
        }
      } catch {
        // silent
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

  if (!b) {
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
        <p className="mt-6 text-[13px] text-[#6B7280]">
          {loading ? "Loading booking…" : "Booking not found."}
        </p>
      </div>
    );
  }

  const job = b.job || {};
  const paid = b.payment_status === "paid";
  const bookingFee = Number(b.booking_fee ?? b.deposit_amount ?? 0);
  const driverCharge = Number(b.driver_charge ?? b.balance_due ?? 0);
  const total = Number(b.total_price ?? bookingFee + driverCharge);

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

            <RouteMap
              pickup={
                job.pickup_lat != null
                  ? { lat: job.pickup_lat, lng: job.pickup_lng, label: "Pickup" }
                  : null
              }
              dropoff={
                job.dropoff_lat != null
                  ? { lat: job.dropoff_lat, lng: job.dropoff_lng, label: "Dropoff" }
                  : null
              }
              driver={
                tracking?.last_location
                  ? {
                      lat: tracking.last_location.lat,
                      lng: tracking.last_location.lng,
                    }
                  : null
              }
              trail={tracking?.trail}
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
                    <p className="mt-1 text-[13px] text-[#6B7280]">
                      {b.other_party.phone}
                    </p>
                  )}
                </div>
                {b.other_party.phone && (
                  <a
                    href={`tel:${b.other_party.phone}`}
                    aria-label="Call"
                    data-testid="call-party-button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F]"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-[12px] border border-[#E5E7EB] p-4" data-testid="booking-summary">
              <SumRow label="Driver Charge" value={`£${driverCharge.toFixed(2)}`} />
              <SumRow label="Cargo One Booking Fee" value={`£${bookingFee.toFixed(2)}`} />
              <div className="my-1 border-t border-[#F3F4F6]" />
              <SumRow label="Total Booking Price" value={`£${total.toFixed(2)}`} highlight />
              <div className="my-1 border-t border-[#F3F4F6]" />
              <SumRow label="Pay Now (Booking Fee)" value={`£${bookingFee.toFixed(2)}`} testID="booking-summary-pay-now" />
              <SumRow label="Pay Driver On Delivery" value={`£${driverCharge.toFixed(2)}`} />
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

            {paid && b.status === "completed" && b.other_party && (
              <Button
                title="Leave a review"
                variant="secondary"
                onClick={() => setShowReview(true)}
                testID="leave-review-button"
              />
            )}
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
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
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
