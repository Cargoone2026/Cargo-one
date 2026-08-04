import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Clock,
  Navigation,
  Play,
  Square,
  Phone,
  MessageCircle,
  Send,
  Camera,
  Image as ImageIcon,
  X as XIcon,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { RecentActivity } from "@/components/ui-portal/RecentActivity";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { RouteMap } from "@/components/ui-portal/RouteMap";
import { JobExtras } from "@/components/ui-portal/JobExtras";
import { PhotoGallery } from "@/components/ui-portal/PhotoUpload";
import { SignaturePad } from "@/components/ui-portal/SignaturePad";

const STATUS_FLOW = [
  { key: "travelling", label: "Start Trip to Pickup" },
  { key: "arrived", label: "Arrived at Pickup" },
  { key: "collected", label: "Collected Cargo" },
  { key: "on_route", label: "On Route to Dropoff" },
  { key: "delivered", label: "Delivered" },
];
const ACTIVE_STATUSES = new Set([
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

export default function DriverBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [b, setB] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [pod, setPod] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [msgErr, setMsgErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [tab, setTab] = useState("overview");
  const [podNotes, setPodNotes] = useState("");
  const [podPhotos, setPodPhotos] = useState([]);
  const [podSignature, setPodSignature] = useState(null);
  const [podSubmitting, setPodSubmitting] = useState(false);
  const [podErr, setPodErr] = useState(null);

  // Tracking control state
  const [trackingOn, setTrackingOn] = useState(false);
  const [locErr, setLocErr] = useState(null);
  const [lastPush, setLastPush] = useState(null);
  const watchIdRef = useRef(null);
  const lastPushedRef = useRef(null);
  const cameraFileRef = useRef(null);
  const libraryFileRef = useRef(null);

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

  // Auto-open Chat tab when arriving via the "View & Reply" email link
  // (…/driver/booking/<id>#chat).
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#chat") {
      setTab("chat");
    }
  }, []);

  // Round 3 — driver-side chat presence + read receipts poller. Mirrors
  // the customer BookingDetail effect: pings the presence endpoint while
  // the driver has the Chat tab open (suppresses the customer's throttled
  // email), marks incoming messages as read, and refreshes every 6 s so
  // the driver sees the customer's replies and the "read" ticks flip live.
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
    const iv1 = setInterval(ping, 20000);
    const iv2 = setInterval(refresh, 6000);
    return () => { cancelled = true; clearInterval(iv1); clearInterval(iv2); };
  }, [id, b, tab]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setTrackingOn(false);
  }, []);

  const startTracking = useCallback(() => {
    setLocErr(null);
    if (!("geolocation" in navigator)) {
      setLocErr("Geolocation is not supported by this browser.");
      return;
    }
    if (!id) return;
    const wid = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const now = Date.now();
        // Only POST if moved >= 30m OR >= 45s elapsed
        if (lastPushedRef.current) {
          const dLat = (lat - lastPushedRef.current.lat) * 111000;
          const dLng =
            (lng - lastPushedRef.current.lng) *
            111000 *
            Math.cos((lat * Math.PI) / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          if (dist < 30 && now - lastPushedRef.current.t < 45000) return;
        }
        try {
          await api(`/tracking/${id}`, { method: "POST", body: { lat, lng } });
          lastPushedRef.current = { lat, lng, t: now };
          setLastPush({ lat, lng, t: now });
        } catch {
          // silent — background HTTP errors will just retry on next fix
        }
      },
      (e) => {
        if (e.code === 1) setLocErr("Location permission denied. Enable it in your browser.");
        else if (e.code === 2) setLocErr("Location unavailable. Check GPS or network.");
        else if (e.code === 3) setLocErr("Location request timed out. Try again.");
        else setLocErr(e.message || "Location error.");
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    watchIdRef.current = wid;
    setTrackingOn(true);
  }, [id, stopTracking]);

  // Auto-stop tracking when component unmounts
  useEffect(() => stopTracking, [stopTracking]);

  // If shipment status leaves the active range, auto-stop tracking
  useEffect(() => {
    if (b && trackingOn && !ACTIVE_STATUSES.has(b.status)) stopTracking();
  }, [b, trackingOn, stopTracking]);

  async function updateStatus(status) {
    if (!id) return;
    setUpdating(true);
    try {
      await api(`/bookings/${id}/status`, { method: "POST", body: { status } });
      load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Could not update status");
    } finally {
      setUpdating(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!msgText.trim() || !id) return;
    const text = msgText.trim();
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
    }
  }

  async function addPhotoFile(file) {
    if (!file) return;
    const data = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    setPodPhotos((prev) => [...prev, data]);
  }

  async function uploadPOD() {
    if (!id) return;
    if (podPhotos.length === 0 || !podSignature) return;
    setPodErr(null);
    setPodSubmitting(true);
    try {
      // Best-effort snapshot of GPS at POD moment
      let lat, lng;
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, {
              enableHighAccuracy: true,
              timeout: 5000,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          // ignore — POD is still valid without GPS
        }
      }
      await api(`/bookings/${id}/pod`, {
        method: "POST",
        body: {
          photos: podPhotos,
          signature: podSignature,
          notes: podNotes || "Delivered as agreed.",
          lat,
          lng,
        },
      });
      stopTracking();
      load();
      setTab("pod");
    } catch (e) {
      setPodErr(e?.message || "Could not upload POD");
    } finally {
      setPodSubmitting(false);
    }
  }

  if (!b) {
    return (
      <div className="min-h-screen bg-white px-4 pt-6 md:px-8" data-testid="driver-booking-detail">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="driver-booking-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]"
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
  const currentIdx = STATUS_FLOW.findIndex((s) => s.key === b.status);
  const nextStatus =
    currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentIdx + 1]
      : b.status === "deposit_paid" || b.status === "confirmed"
      ? STATUS_FLOW[0]
      : null;

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-6" data-testid="driver-booking-detail">
      <header className="flex items-center gap-3 px-4 pt-6 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="driver-booking-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">Booking</h1>
        <StatusPill status={b.status} />
      </header>

      {paid && (
        <nav
          className="mx-4 mt-3 flex rounded-full bg-[#F4F4F4] p-1 md:mx-8"
          data-testid="driver-booking-tabs"
        >
          {["overview", "chat", "pod"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              data-testid={`driver-tab-${t}`}
              className={`flex-1 rounded-full py-2 text-[13px] font-semibold ${
                tab === t ? "bg-[#111111] text-white" : "text-[#6B7280]"
              }`}
            >
              {t === "overview" ? "Overview" : t === "chat" ? "Chat" : "POD"}
            </button>
          ))}
        </nav>
      )}

      <div className="mx-auto max-w-[720px] px-4 pt-4 md:px-8">
        {(!paid || tab === "overview") && (
          <div className="space-y-4">
            <h2 className="text-[24px] font-bold tracking-tight text-[#111111]">
              {job.title}
            </h2>

            {paid ? (
              <RecentActivity
                bookingId={id}
                testIdPrefix="driver-recent-activity"
              />
            ) : null}

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

            <JobExtras job={job} />

            {Array.isArray(job.photos) && job.photos.length > 0 && (
              <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-4" data-testid="driver-booking-photos-block">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
                  Customer photos
                </p>
                <PhotoGallery photos={job.photos} testId="driver-booking-photos" />
              </div>
            )}

            {tracking?.eta_minutes != null && (
              <div
                className="flex gap-3 rounded-[12px] bg-[#F9FAFB] p-3"
                data-testid="driver-tracking-eta"
              >
                <ChipStat
                  Icon={Clock}
                  color="#D62828"
                  value={fmtDur(tracking.eta_minutes)}
                  label={`ETA to ${tracking.target === "pickup" ? "pickup" : "customer"}`}
                />
                <ChipStat
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

            {b.other_party && (
              <div
                className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] p-3"
                data-testid="driver-party-card"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] text-[16px] font-bold text-white">
                  {(b.other_party.name || "?")[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[#111111]">
                    {b.other_party.name}
                  </p>
                  {b.other_party.phone && (
                    <p className="text-[13px] text-[#6B7280]">{b.other_party.phone}</p>
                  )}
                </div>
                {b.other_party.phone && (
                  <a
                    href={`tel:${b.other_party.phone}`}
                    aria-label="Call customer"
                    data-testid="call-customer-button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F]"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}

            <div
              className="space-y-2 rounded-[12px] border border-[#E5E7EB] p-4"
              data-testid="driver-earnings-summary"
            >
              <SumRow
                label="Your bid (you receive)"
                value={`£${Number(b.driver_charge ?? b.balance_due ?? 0).toFixed(2)}`}
                big
              />
              <SumRow
                label="Cargo One Booking Fee (collected via Stripe)"
                value={`£${Number(b.booking_fee ?? b.deposit_amount ?? 0).toFixed(2)}`}
              />
              <SumRow
                label="Customer pays total"
                value={`£${Number(b.total_price || 0).toFixed(2)}`}
              />
              <div className="my-1 border-t border-[#F3F4F6]" />
              <SumRow
                label="You collect from customer on delivery"
                value={`£${Number(b.driver_charge ?? b.balance_due ?? 0).toFixed(2)}`}
                strong
              />
            </div>

            {!paid && (
              <div
                className="flex items-center gap-2 rounded-[10px] bg-[#F9FAFB] p-3"
                data-testid="driver-waiting-payment"
              >
                <Clock className="h-4 w-4 text-[#F59E0B]" />
                <p className="text-[13px] text-[#6B7280]">
                  Waiting for customer to pay deposit. Details unlock once paid.
                </p>
              </div>
            )}

            {paid && ACTIVE_STATUSES.has(b.status) && (
              <div
                className="space-y-2 rounded-[12px] border border-[#E5E7EB] p-4"
                data-testid="tracking-controls"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-bold text-[#111111]">
                      Foreground tracking
                    </p>
                    <p className="text-[12px] text-[#6B7280]">
                      {trackingOn
                        ? "Sharing your location with the customer."
                        : "Turn on to share live position while en-route."}
                    </p>
                  </div>
                  {trackingOn ? (
                    <Button
                      title="Stop"
                      variant="outline"
                      fullWidth={false}
                      small
                      onClick={stopTracking}
                      testID="stop-tracking-button"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Square className="h-3.5 w-3.5" />
                        Stop
                      </span>
                    </Button>
                  ) : (
                    <Button
                      title="Start"
                      variant="primary"
                      fullWidth={false}
                      small
                      onClick={startTracking}
                      testID="start-tracking-button"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Play className="h-3.5 w-3.5" />
                        Start
                      </span>
                    </Button>
                  )}
                </div>
                {locErr && (
                  <div
                    className="flex items-start gap-2 rounded-[10px] bg-[#FEF2F2] p-2"
                    data-testid="location-error"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-[#DC2626]" />
                    <p className="text-[12px] text-[#7F1D1D]">{locErr}</p>
                  </div>
                )}
                {lastPush && (
                  <p
                    className="text-[11px] text-[#6B7280]"
                    data-testid="tracking-last-push"
                  >
                    Last update at {new Date(lastPush.t).toLocaleTimeString()} —{" "}
                    {lastPush.lat.toFixed(5)}, {lastPush.lng.toFixed(5)}
                  </p>
                )}
              </div>
            )}

            {paid && nextStatus && b.status !== "delivered" && b.status !== "pod_uploaded" && (
              <Button
                title={nextStatus.label}
                loading={updating}
                onClick={() => updateStatus(nextStatus.key)}
                testID={`update-status-${nextStatus.key}`}
              />
            )}

            {paid && b.status === "delivered" && (
              <Button
                title="Upload Proof of Delivery"
                onClick={() => setTab("pod")}
                testID="go-to-pod-tab"
              />
            )}
          </div>
        )}

        {paid && tab === "chat" && (
          <div className="flex h-[65vh] flex-col rounded-[16px] border border-[#E5E7EB] bg-white">
            <div
              className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
              data-testid="driver-chat-messages"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <MessageCircle className="h-10 w-10 text-[#9CA3AF]" />
                  <p className="text-[14px] text-[#6B7280]">
                    Chat with your customer.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  let tick = null;
                  if (mine) {
                    if (m.read_at) {
                      tick = <span className="ml-1 text-[10px] font-bold text-[#FCA5A5]" title="Read">✓✓</span>;
                    } else if (m.delivered_at) {
                      tick = <span className="ml-1 text-[10px] text-white/70" title="Delivered">✓✓</span>;
                    } else {
                      tick = <span className="ml-1 text-[10px] text-white/70" title="Sent">✓</span>;
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
                      data-testid={`driver-message-row-${m.id}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-[16px] px-3 py-2 text-[14px] ${
                          mine ? "bg-[#D62828] text-white" : "bg-[#F4F4F4] text-[#111111]"
                        }`}
                      >
                        {m.text}
                      </div>
                      <div className={`mt-0.5 flex items-center gap-1 text-[10px] text-[#9CA3AF] ${
                        mine ? "justify-end" : "justify-start"
                      }`}>
                        <span>{time}</span>
                        {mine ? (
                          <span data-testid={`driver-message-tick-${m.id}`}>{tick}</span>
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
                data-testid="driver-chat-input"
                className="flex-1 rounded-full bg-[#F4F4F4] px-4 py-2 text-[14px] text-[#111111] outline-none focus:bg-white focus:ring-1 focus:ring-[#111111]"
              />
              <button
                type="submit"
                disabled={!msgText.trim()}
                data-testid="driver-chat-send"
                aria-label="Send"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D62828] text-white hover:bg-[#B01F1F] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {msgErr && (
              <p className="border-t border-[#F3F4F6] px-4 py-2 text-[12px] text-[#DC2626]">
                {msgErr}
              </p>
            )}
          </div>
        )}

        {paid && tab === "pod" && (
          <div className="space-y-4">
            <h2 className="text-[24px] font-bold text-[#111111]">
              Proof of Delivery
            </h2>
            {pod ? (
              <div className="space-y-3">
                <div
                  className="flex items-center gap-3 rounded-[12px] bg-[#F0FDF4] p-4"
                  data-testid="driver-pod-uploaded"
                >
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
                  <div>
                    <p className="text-[15px] font-semibold text-[#111111]">
                      POD uploaded ✓
                    </p>
                    <p className="text-[12px] text-[#6B7280]">
                      {new Date(pod.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {pod.notes && (
                  <PodField label="Notes">
                    <p className="text-[14px] text-[#111111]">{pod.notes}</p>
                  </PodField>
                )}
                {pod.lat != null && (
                  <PodField label="GPS">
                    <p className="text-[13px] text-[#111111]">
                      {Number(pod.lat).toFixed(5)},{" "}
                      {Number(pod.lng).toFixed(5)}
                    </p>
                  </PodField>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <PodStep index="1" title="Take delivery photos">
                  <div className="grid grid-cols-3 gap-2">
                    {podPhotos.map((p, i) => (
                      <div key={i} className="relative aspect-square overflow-hidden rounded-[8px] border border-[#E5E7EB]">
                        <img src={p} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() =>
                            setPodPhotos((prev) => prev.filter((_, j) => j !== i))
                          }
                          data-testid={`pod-remove-photo-${i}`}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1"
                        >
                          <XIcon className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => cameraFileRef.current?.click()}
                      data-testid="pod-add-photo-camera"
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#111111]"
                    >
                      <Camera className="h-5 w-5 text-[#111111]" />
                      <span className="text-[11px] font-semibold text-[#111111]">Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => libraryFileRef.current?.click()}
                      data-testid="pod-add-photo-library"
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#111111]"
                    >
                      <ImageIcon className="h-5 w-5 text-[#111111]" />
                      <span className="text-[11px] font-semibold text-[#111111]">Library</span>
                    </button>
                  </div>
                  <input
                    ref={cameraFileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => addPhotoFile(e.target.files?.[0])}
                  />
                  <input
                    ref={libraryFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      Array.from(e.target.files || []).forEach(addPhotoFile);
                    }}
                  />
                </PodStep>
                <PodStep index="2" title="Customer signature">
                  <SignaturePad onChange={setPodSignature} testID="pod-signature-pad" />
                </PodStep>
                <PodStep index="3" title="Delivery notes">
                  <Input
                    value={podNotes}
                    onChange={(e) => setPodNotes(e.target.value)}
                    placeholder="e.g. Left with reception"
                    testID="pod-notes-input"
                  />
                </PodStep>
                <div
                  className="space-y-1 rounded-[10px] bg-[#F9FAFB] p-3"
                  data-testid="pod-checklist"
                >
                  <Check ok={podPhotos.length > 0} label={`Photos (${podPhotos.length})`} />
                  <Check ok={!!podSignature} label="Signature captured" />
                  <Check ok={true} label="GPS attempted at submit" />
                  <Check ok={true} label="Timestamped" />
                </div>
                {podErr && (
                  <p className="text-[13px] text-[#DC2626]" data-testid="pod-error">
                    {podErr}
                  </p>
                )}
                <Button
                  title="Submit POD"
                  variant="primary"
                  disabled={podPhotos.length === 0 || !podSignature}
                  loading={podSubmitting}
                  onClick={uploadPOD}
                  testID="submit-pod"
                />
              </div>
            )}
          </div>
        )}
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
function ChipStat({ Icon, color, value, label }) {
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
function SumRow({ label, value, big, strong }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span
        className={
          big
            ? "text-[18px] font-bold text-[#111111]"
            : strong
            ? "text-[16px] font-bold text-[#16A34A]"
            : "text-[14px] font-semibold text-[#111111]"
        }
      >
        {value}
      </span>
    </div>
  );
}
function PodStep({ index, title, children }) {
  return (
    <div>
      <p className="mb-2 text-[15px] font-bold text-[#111111]">
        {index}. {title}
      </p>
      {children}
    </div>
  );
}
function PodField({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Check({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
          ok ? "bg-[#16A34A] text-white" : "bg-[#E5E7EB] text-[#9CA3AF]"
        }`}
      >
        {ok ? "✓" : ""}
      </span>
      <span className={`text-[13px] ${ok ? "text-[#111111]" : "text-[#9CA3AF]"}`}>
        {label}
      </span>
    </div>
  );
}
