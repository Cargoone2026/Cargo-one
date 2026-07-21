import React from "react";
import { Link } from "react-router-dom";

export function Hero({
  bgImage,
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  compact = false,
  align = "left",
}) {
  const overlay = compact
    ? "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.65), rgba(0,0,0,0.75))"
    : "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.6), rgba(0,0,0,0.85))";
  const bgLayers = bgImage
    ? `${overlay}, url("${bgImage}")`
    : "linear-gradient(180deg, #0B0B0F, #111111)";

  const alignClass = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <section
      className="w-full overflow-hidden bg-[#111]"
      data-testid="marketing-hero"
      style={{
        backgroundImage: bgLayers,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        className={`mx-auto flex w-full max-w-[1200px] flex-col px-4 md:px-10 ${alignClass}`}
        style={{
          paddingTop: compact ? 48 : 72,
          paddingBottom: compact ? 48 : 72,
        }}
      >
        {eyebrow ? (
          <div className="mb-3 rounded-full bg-[#D62828]/90 px-3 py-1">
            <span className="text-[12px] font-bold tracking-[1px] text-white">
              {eyebrow}
            </span>
          </div>
        ) : null}
        <h1
          className={`max-w-[860px] whitespace-pre-line font-bold tracking-[-0.5px] text-white`}
          style={{
            fontSize: compact ? "clamp(32px, 5vw, 44px)" : "clamp(40px, 6vw, 60px)",
            lineHeight: 1.05,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className="mt-4 max-w-[640px] text-white/85"
            style={{
              fontSize: "clamp(16px, 1.6vw, 20px)",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        ) : null}
        {(primaryCta || secondaryCta) && (
          <div className={`mt-7 flex flex-wrap gap-3 ${align === "center" ? "justify-center" : ""}`}>
            {primaryCta && (
              <Link
                to={primaryCta.href}
                data-testid="hero-primary"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#D62828] px-6 py-3 text-[16px] font-bold text-white transition-colors hover:bg-[#B01F1F]"
              >
                {primaryCta.label}
              </Link>
            )}
            {secondaryCta && (
              <Link
                to={secondaryCta.href}
                data-testid="hero-secondary"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3 text-[16px] font-semibold text-white transition-colors hover:bg-white/20"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
