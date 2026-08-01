import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Star,
  ShieldCheck,
  Megaphone,
  Tag as TagIcon,
  Hourglass,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { Button } from "@/components/ui-portal/Button";
import { RouteMap } from "@/components/ui-portal/RouteMap";
import { JobExtras } from "@/components/ui-portal/JobExtras";
import { PhotoGallery } from "@/components/ui-portal/PhotoUpload";

export default function CustomerJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [j, bs] = await Promise.all([
        api(`/jobs/${id}`),
        api(`/jobs/${id}/bids`).catch(() => []),
      ]);
      setJob(j);
      setBids(Array.isArray(bs) ? bs : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function acceptBid(bidId) {
    setAccepting(bidId);
    try {
      await api(`/bids/${bidId}/accept`, { method: "POST" });
      const booking = await api("/bookings", {
        method: "POST",
        body: { job_id: id },
      });
      navigate(`/customer/booking/${booking.id}`, { replace: true });
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Could not accept bid");
    } finally {
      setAccepting(null);
    }
  }

  async function goToBookingForFixedJob() {
    try {
      const booking = await api("/bookings", {
        method: "POST",
        body: { job_id: id },
      });
      navigate(`/customer/booking/${booking.id}`, { replace: true });
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Could not continue");
    }
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-white px-4 pt-6 md:px-8" data-testid="customer-job-detail">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]"
          aria-label="Back"
          data-testid="job-detail-back"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <p className="mt-6 text-[13px] text-[#6B7280]">
          {loading ? "Loading job…" : "Job not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="customer-job-detail">
      <header className="flex items-center gap-3 px-4 pt-6 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="job-detail-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">Job Details</h1>
        <button
          type="button"
          onClick={load}
          aria-label="Refresh"
          data-testid="job-detail-refresh"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <RefreshCw className={`h-4 w-4 text-[#111111] ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="mx-auto max-w-[720px] space-y-4 px-4 pt-4 md:px-8">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-[#111111]">
            {job.title}
          </h2>
          <StatusPill status={job.status} />
        </div>

        <RouteMap
          pickup={{ lat: job.pickup_lat, lng: job.pickup_lng, label: "Pickup" }}
          dropoff={{ lat: job.dropoff_lat, lng: job.dropoff_lng, label: "Dropoff" }}
          height={200}
          summary={{
            pickupTown: job.pickup_town,
            dropoffTown: job.dropoff_town,
            distanceMiles: job.distance_miles,
            durationMinutes: job.duration_minutes,
          }}
        />

        <div className="space-y-3 rounded-[12px] bg-[#F9FAFB] p-4">
          <RouteRow color="#16A34A" label="Pickup" value={job.pickup_town} />
          <RouteRow color="#D62828" label="Dropoff" value={job.dropoff_town} />
          <div className="border-t border-[#E5E7EB] pt-2 text-[13px] capitalize text-[#6B7280]">
            {job.distance_miles} mi · {(job.category || "").replace(/_/g, " ")}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E5E7EB] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
            Description
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-[#111111]">
            {job.description || "—"}
          </p>
        </div>

        <JobExtras job={job} />

        {Array.isArray(job.photos) && job.photos.length > 0 && (
          <div className="rounded-[12px] border border-[#E5E7EB] p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
              Job photos
            </p>
            <PhotoGallery photos={job.photos} testId="customer-job-photos" />
          </div>
        )}

        <div className="flex items-center justify-between rounded-[12px] bg-[#111111] p-4 text-white">
          <div>
            <p className="text-[13px] text-white/70">
              {job.pricing_type === "fixed" ? "Fixed price" : "Suggested price"}
            </p>
            <p className="mt-0.5 text-[28px] font-bold tracking-tight">
              £{Number(job.fixed_price || job.suggested_price).toFixed(0)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#111111]">
            {job.pricing_type === "bidding" ? (
              <>
                <Megaphone className="h-3.5 w-3.5" />
                Open to bids
              </>
            ) : (
              <>
                <TagIcon className="h-3.5 w-3.5" />
                Fixed
              </>
            )}
          </span>
        </div>

        {/* Bidding job — show bid list */}
        {job.status === "posted" && job.pricing_type === "bidding" && (
          <div className="pt-2">
            <h3 className="mb-3 text-[18px] font-bold text-[#111111]">
              Bids ({bids.length})
            </h3>
            {bids.length === 0 ? (
              <div
                className="flex flex-col items-center gap-2 py-10 text-center"
                data-testid="bids-empty"
              >
                <Hourglass className="h-8 w-8 text-[#9CA3AF]" />
                <p className="text-[14px] text-[#6B7280]">
                  Waiting for drivers to bid…
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {bids.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-[12px] border border-[#E5E7EB] p-4"
                    data-testid={`bid-card-${b.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/driver-profile/${b.driver_id}`}
                        data-testid={`bid-driver-link-${b.id}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111111] text-[16px] font-bold text-white hover:opacity-90"
                        aria-label="View driver profile"
                      >
                        {(b.driver_name || "D")[0]?.toUpperCase()}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[14px] font-semibold text-[#111111]">
                            Driver #{(b.driver_id || "").slice(0, 6)}
                          </p>
                          {b.verified_driver && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.5px] text-white"
                              data-testid={`verified-${b.id}`}
                            >
                              <ShieldCheck className="h-2.5 w-2.5" />
                              VERIFIED
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#6B7280]">
                          <Star className="h-3 w-3 fill-[#FF6A00] text-[#FF6A00]" />
                          <span>{Number(b.driver_rating || 0).toFixed(1)}</span>
                          {b.eta_hours ? (
                            <span>· ~{b.eta_hours}h ETA</span>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-[20px] font-bold text-[#111111]">
                        £{Number(b.amount).toFixed(0)}
                      </p>
                    </div>
                    {b.message ? (
                      <p className="mt-2 text-[13px] text-[#6B7280]">
                        {b.message}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <Button
                        title="Accept Bid"
                        small
                        variant="primary"
                        loading={accepting === b.id}
                        onClick={() => acceptBid(b.id)}
                        testID={`accept-bid-${b.id}`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Fixed price job waiting for driver */}
        {job.status === "posted" && job.pricing_type === "fixed" && (
          <div
            className="flex flex-col items-center gap-2 py-10 text-center"
            data-testid="fixed-waiting"
          >
            <Hourglass className="h-8 w-8 text-[#9CA3AF]" />
            <p className="text-[14px] text-[#6B7280]">
              Waiting for a driver to accept the fixed price…
            </p>
          </div>
        )}

        {/* Driver accepted */}
        {job.status === "accepted" && (
          <div className="space-y-3">
            <div
              className="flex items-start gap-3 rounded-[12px] bg-[#F0FDF4] p-4"
              data-testid="accepted-box"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#16A34A]" />
              <p className="flex-1 text-[14px] text-[#111111]">
                Driver accepted! Pay deposit to unlock contact details and chat.
              </p>
            </div>
            <Button
              title="Continue to Payment"
              variant="primary"
              onClick={goToBookingForFixedJob}
              testID="continue-to-payment-button"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RouteRow({ color, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.6px] text-[#6B7280]">
          {label}
        </p>
        <p className="text-[15px] font-semibold text-[#111111]">{value}</p>
      </div>
    </div>
  );
}
