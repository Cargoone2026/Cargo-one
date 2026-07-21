import React from "react";

/**
 * FeatureCard — 3-column feature grid card used across marketing pages.
 * Accepts a Lucide icon component as `icon`.
 */
export function FeatureCard({ icon: Icon, title, body, accent = false }) {
  return (
    <div
      className={`flex min-w-[240px] flex-1 basis-[260px] flex-col gap-2 rounded-[20px] border p-6 ${
        accent
          ? "border-[#111] bg-[#0B0B0F]"
          : "border-[#E5E7EB] bg-white shadow-sm"
      }`}
    >
      <div
        className={`mb-1 flex h-12 w-12 items-center justify-center rounded-[14px] ${
          accent ? "bg-[#D62828]" : "bg-[#FEE2E2]"
        }`}
      >
        <Icon
          className={`h-6 w-6 ${accent ? "text-white" : "text-[#D62828]"}`}
          strokeWidth={2}
        />
      </div>
      <h3
        className={`text-[20px] font-bold ${
          accent ? "text-white" : "text-[#111111]"
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-[14px] leading-relaxed ${
          accent ? "text-white/70" : "text-[#6B7280]"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
