import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ChevronLeft } from "lucide-react";

/**
 * ComingNext — placeholder for Stage 2A-ii Customer workflows
 * (Post Job wizard, Booking detail, Job detail). Provides a graceful
 * on-brand landing for links that would otherwise 404 while Stage 2A-i
 * is under user review.
 */
export default function ComingNext({ area = "This screen" }) {
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-12 text-center"
      data-testid="portal-coming-next"
    >
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FEE2E2]">
        <Sparkles className="h-7 w-7 text-[#D62828]" />
      </span>
      <h1 className="text-[22px] font-bold text-[#111111]">
        {area} arrives in the next migration stage
      </h1>
      <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-[#6B7280]">
        Stage 2A-ii covers Post Job, quotes &amp; pricing, bid acceptance,
        Stripe deposit, tracking, POD and reviews. It will be enabled here
        after you approve the current stage.
      </p>
      <Link
        to="/customer"
        data-testid="coming-next-back"
        className="mt-6 inline-flex items-center gap-1 rounded-full border border-[#111111] px-5 py-2 text-[14px] font-semibold text-[#111111] hover:bg-[#111111] hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to home
      </Link>
    </div>
  );
}
