import React, { useEffect } from "react";
/**
 * CustomerDispatch (CLASSIC) — retained as an internal fallback while
 * the new map-first Uber-style customer ASAP live-tracking UX is being
 * rolled out. Not routed; the live route `/customer/dispatch/:jobId`
 * renders the new `Dispatch.jsx`. Rollback = swap the import in
 * `App.js` from `./Dispatch` to `./DispatchClassic` — no other changes.
 */
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { AsapDispatchPanel } from "@/components/ui-portal/AsapDispatchPanel";

/**
 * Customer-side dispatch screen — thin wrapper around AsapDispatchPanel.
 *
 * The panel itself is server-authoritative. This route stays around so
 * historic /customer/dispatch/:jobId links keep working, but it now looks
 * up the associated booking id on mount so the Cancel-and-refund CTA can
 * fire (customer cancel endpoint is booking-scoped).
 *
 * When a driver is assigned, the panel calls onDriverFound → we navigate
 * to the booking detail so the customer picks up the confirmed view.
 */
export default function CustomerDispatch() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [bookingId, setBookingId] = React.useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bookings = await api("/bookings/mine");
        if (!alive) return;
        const match = (bookings || []).find((b) => b.job_id === jobId);
        if (match) setBookingId(match.id);
      } catch { /* ignore — panel still works without cancel */ }
    })();
    return () => { alive = false; };
  }, [jobId]);

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="customer-dispatch">
      <AsapDispatchPanel
        jobId={jobId}
        bookingId={bookingId}
        onDriverFound={() => {
          if (bookingId) navigate(`/customer/booking/${bookingId}`, { replace: true });
        }}
        onCancelled={() => navigate("/customer/bookings")}
      />
    </div>
  );
}
