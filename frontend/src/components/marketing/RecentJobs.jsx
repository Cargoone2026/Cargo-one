import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Section } from "@/components/marketing/Section";
import { DRIVER_SIGNUP_HREF } from "@/data/seo";

const FEED_URL = `${process.env.REACT_APP_BACKEND_URL}/api/public/recent-jobs`;
const MIN_JOBS = 3;

async function fetchJobs(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const res = await fetch(`${FEED_URL}${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("feed");
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

// Anonymised "Recently posted jobs" list. Falls back to UK-wide; renders nothing if fewer than 3 jobs or on error.
export function RecentJobs({ town, category, title = "Recently posted jobs", postHref = "/auth/register?role=customer", limit = 6, header = null }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let items = await fetchJobs({ town, category, limit });
        let heading = title;
        if (items.length < MIN_JOBS && (town || category)) {
          items = await fetchJobs({ limit });
          heading = "Recently posted across the UK";
        }
        if (alive) setState(items.length >= MIN_JOBS ? { items, heading } : null);
      } catch {
        if (alive) setState(null);
      }
    })();
    return () => { alive = false; };
  }, [town, category, title, limit]);

  if (!state) return null;
  return (
    <Section>
      <div data-testid="recent-jobs">
        {header}
        <h2 className="text-[22px] font-bold text-[#111111] md:text-[26px]" data-testid="recent-jobs-heading">{state.heading}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="recent-jobs-list">
          {state.items.map((j, i) => <JobCard key={`${j.pickup_town}-${j.dropoff_town}-${i}`} j={j} i={i} />)}
        </ul>
        <p className="mt-3 text-[12px] text-[#9CA3AF]" data-testid="recent-jobs-privacy">Shown without names, addresses or prices to protect customer privacy.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={postHref} data-testid="recent-jobs-post-similar" className="inline-flex items-center gap-2 rounded-full bg-[#D62828] px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[#B01F1F]">
            Post a similar job <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to={DRIVER_SIGNUP_HREF} data-testid="recent-jobs-driver-signup" className="inline-flex items-center gap-2 rounded-full border border-[#111111] px-5 py-2.5 text-[14px] font-bold text-[#111111] transition-colors hover:bg-[#111111] hover:text-white">
            Drivers: sign up free to quote
          </Link>
        </div>
      </div>
    </Section>
  );
}

function JobCard({ j, i }) {
  return (
    <li className="rounded-[16px] border border-[#E5E7EB] bg-white p-4" data-testid={`recent-job-${i}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[15px] font-bold text-[#111111]">{j.category_label}</p>
        {j.is_open ? <span className="shrink-0 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-bold text-[#166534]" data-testid={`recent-job-open-${i}`}>Open</span> : null}
      </div>
      <p className="mt-1 flex items-center gap-1 text-[14px] text-[#374151]">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D62828]" />
        <span className="truncate">{j.pickup_town} → {j.dropoff_town}</span>
      </p>
      <p className="mt-1 text-[12px] text-[#6B7280]">{j.posted}</p>
    </li>
  );
}
