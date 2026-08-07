import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Lock, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui-portal/Button";
import { Input } from "@/components/ui-portal/Input";
import { StatusPill } from "@/components/ui-portal/StatusPill";
import { RouteMap } from "@/components/ui-portal/RouteMap";
import { JobExtras } from "@/components/ui-portal/JobExtras";
import { AcceptanceInfo } from "@/components/ui-portal/AcceptanceInfo";
import { PhotoGallery } from "@/components/ui-portal/PhotoUpload";

export default function DriverJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMsg, setBidMsg] = useState("");
  const [eta, setEta] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [fee, setFee] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setJob(await api(`/jobs/${id}`));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const dc = Number(bidAmount) || Number(job?.fixed_price);
    if (!dc || Number.isNaN(dc) || dc <= 0) {
      setFee(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await api(`/booking-fees/preview?driver_charge=${dc}`);
        if (!cancelled) setFee(r);
      } catch {
        if (!cancelled) setFee(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bidAmount, job?.fixed_price]);

  const accept = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      await api(`/jobs/${id}/accept`, { method: "POST" });
      navigate("/driver/my-jobs", { replace: true });
    } catch (e) {
      setErr(e?.message || "Could not accept job");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBid = async () => {
    setErr(null);
    if (!bidAmount) return;
    setSubmitting(true);
    try {
      await api(`/jobs/${id}/bids`, {
        method: "POST",
        body: {
          amount: Number(bidAmount),
          message: bidMsg || undefined,
          eta_hours: eta ? Number(eta) : undefined,
        },
      });
      navigate("/driver/my-jobs", { replace: true });
    } catch (e) {
      setErr(e?.message || "Could not place bid");
    } finally {
      setSubmitting(false);
    }
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-white px-4 pt-6 md:px-8" data-testid="driver-job-detail">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]"
          aria-label="Back"
          data-testid="driver-job-back"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <p className="mt-6 text-[13px] text-[#6B7280]">
          {loading ? "Loading job…" : "Job not found."}
        </p>
      </div>
    );
  }

  const pendingApproval = user?.status === "pending";
  const bidding = job.pricing_type === "bidding";

  return (
    <div className="min-h-screen bg-white pb-6" data-testid="driver-job-detail">
      <header className="flex items-center gap-3 px-4 pt-6 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="driver-job-back"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4] hover:bg-[#E5E7EB]"
        >
          <ChevronLeft className="h-5 w-5 text-[#111111]" />
        </button>
        <h1 className="flex-1 text-[20px] font-bold text-[#111111]">Job Details</h1>
        <StatusPill status={job.status} />
      </header>

      <div className="mx-auto max-w-[720px] space-y-3 px-4 pt-4 md:px-8">
        <h2 className="text-[26px] font-bold tracking-tight text-[#111111]">{job.title}</h2>
        <p className="text-[13px] capitalize text-[#6B7280]">
          {(job.category || "").replace(/_/g, " ")}
        </p>

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
          <RouteRow color="#16A34A" label="Pickup town" value={job.pickup_town} />
          <RouteRow color="#D62828" label="Dropoff town" value={job.dropoff_town} />
          <div className="border-t border-[#E5E7EB] pt-2 text-[13px] capitalize text-[#6B7280]">
            {job.distance_miles} mi · {job.weight_kg ? `${job.weight_kg}kg` : "Weight not specified"}
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

        <AcceptanceInfo job={job} testIdPrefix="driver-jobdetail-accept" />

        <JobExtras job={job} />

        {Array.isArray(job.photos) && job.photos.length > 0 && (
          <div className="rounded-[12px] border border-[#E5E7EB] p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[#6B7280]">
              Customer photos
            </p>
            <PhotoGallery photos={job.photos} testId="driver-job-photos" />
          </div>
        )}

        <div className="flex items-center justify-between rounded-[12px] bg-[#111111] p-4 text-white">
          <div>
            <p className="text-[13px] text-white/70">
              {job.pricing_type === "fixed" ? "Fixed price" : "Max budget"}
            </p>
            <p className="mt-0.5 text-[28px] font-bold tracking-tight">
              £{Number(job.fixed_price || job.max_budget || job.suggested_price).toFixed(0)}
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-[10px] bg-[#F9FAFB] p-3"
          data-testid="lock-notice"
        >
          <Lock className="h-4 w-4 text-[#6B7280]" />
          <p className="text-[13px] text-[#6B7280]">
            Customer details unlock after they pay the deposit.
          </p>
        </div>

        {pendingApproval && (
          <div
            className="flex items-center gap-2 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-3"
            data-testid="pending-approval-warning"
          >
            <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
            <p className="text-[13px] text-[#78350F]">
              Approval required. Upload documents to accept jobs.
            </p>
          </div>
        )}

        {!pendingApproval && job.status === "posted" && bidding && (
          <div
            className="space-y-3 rounded-[12px] border border-[#E5E7EB] p-4"
            data-testid="bid-box"
          >
            <div>
              <h3 className="text-[18px] font-bold text-[#111111]">Enter Your Bid</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
                This is what you&apos;ll receive after the delivery. Cargo
                One&apos;s booking fee is added on top.
              </p>
            </div>
            <Input
              label="Your bid (£)"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="150"
              inputMode="decimal"
              testID="driver-bid-amount"
            />
            {fee && (
              <div className="space-y-2 rounded-[10px] bg-[#F9FAFB] p-3" data-testid="bid-breakdown">
                <BreakRow label="Your Bid" value={`£${fee.driver_charge.toFixed(2)}`} strong />
                <BreakRow label="Cargo One Booking Fee" value={`£${fee.booking_fee.toFixed(2)}`} accent="#D62828" />
                <div className="my-1 border-t border-[#E5E7EB]" />
                <BreakRow label="Customer Pays" value={`£${fee.customer_total.toFixed(2)}`} big />
              </div>
            )}
            <Input
              label="ETA (hours, optional)"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="24"
              inputMode="numeric"
              testID="driver-bid-eta"
            />
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
                Message (optional)
              </span>
              <textarea
                rows={3}
                value={bidMsg}
                onChange={(e) => setBidMsg(e.target.value)}
                placeholder="Add a message to the customer"
                data-testid="driver-bid-message"
                className="w-full resize-none rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px] outline-none focus:border-[#111111]"
              />
            </label>
            {err ? (
              <p className="text-[13px] text-[#DC2626]" data-testid="bid-error">
                {err}
              </p>
            ) : null}
            <Button
              title="Place Bid"
              loading={submitting}
              onClick={submitBid}
              testID="driver-bid-submit"
            />
          </div>
        )}

        {!pendingApproval && job.status === "posted" && !bidding && (
          <div className="space-y-3">
            <div
              className="space-y-2 rounded-[12px] bg-[#F9FAFB] p-4"
              data-testid="accept-fixed-box"
            >
              <BreakRow
                label="You'll receive"
                value={`£${Number(job.fixed_price).toFixed(2)}`}
                big
              />
              {fee && (
                <>
                  <BreakRow
                    label="Cargo One Booking Fee (customer pays)"
                    value={`£${fee.booking_fee.toFixed(2)}`}
                    accent="#D62828"
                  />
                  <div className="my-1 border-t border-[#E5E7EB]" />
                  <BreakRow
                    label="Customer pays total"
                    value={`£${fee.customer_total.toFixed(2)}`}
                    strong
                  />
                </>
              )}
            </div>
            {err ? (
              <p className="text-[13px] text-[#DC2626]" data-testid="accept-error">
                {err}
              </p>
            ) : null}
            <Button
              title={`Accept — Earn £${Number(job.fixed_price).toFixed(0)}`}
              loading={submitting}
              onClick={accept}
              testID="driver-accept-fixed"
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
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.6px] text-[#6B7280]">
          {label}
        </p>
        <p className="text-[15px] font-semibold text-[#111111]">{value}</p>
      </div>
    </div>
  );
}

function BreakRow({ label, value, strong, big, accent }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span
        className={
          big
            ? "text-[20px] font-bold text-[#16A34A]"
            : strong
            ? "text-[16px] font-bold text-[#111111]"
            : "text-[14px] font-semibold"
        }
        style={{ color: accent }}
      >
        {value}
      </span>
    </div>
  );
}
