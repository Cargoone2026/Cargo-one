import React from "react";

/**
 * AsapTopStatusPill — floating top-center capsule for the ASAP UX.
 *
 * Mirrors the "$412.30 | 14" style pill from the Uber driver reference,
 * adapted to CargoOne's brand — jet-black body, ivory text, subtle
 * gradient stroke. The pill is deliberately compact so the map stays
 * the primary visual surface.
 *
 * Layout (left to right):
 *   [icon]  [left slot]  ·  [main slot]  ·  [right slot]  [right icon?]
 *
 * Any slot can be omitted. When only `main` is provided the pill
 * degrades to a simple status label ("You're offline", "Searching…").
 *
 * Variants:
 *   • dark    — default. Black body, live green dot when `pulse` is set.
 *   • success — emerald-tinted for confirmed states ("Driver accepted").
 *   • warning — amber for degraded states ("Waiting for GPS fix").
 *   • muted   — neutral grey (offline / paused).
 */
const VARIANTS = {
  dark: "bg-neutral-900 text-white border-neutral-800",
  success: "bg-emerald-900/95 text-emerald-50 border-emerald-700/40",
  warning: "bg-amber-900/95 text-amber-50 border-amber-700/40",
  muted: "bg-neutral-800/90 text-neutral-100 border-neutral-700/60",
};

const DOT_COLOR = {
  dark: "bg-emerald-400",
  success: "bg-emerald-300",
  warning: "bg-amber-300",
  muted: "bg-neutral-400",
};

export function AsapTopStatusPill({
  icon: Icon,
  left,
  main,
  right,
  variant = "dark",
  pulse = false,
  rightIcon: RightIcon,
  onClick,
  className = "",
  "data-testid": testId = "asap-top-status-pill",
}) {
  const variantClasses = VARIANTS[variant] || VARIANTS.dark;
  const dotClass = DOT_COLOR[variant] || DOT_COLOR.dark;

  const parts = [];
  if (left) parts.push(<span key="l" className="text-[13px] font-medium">{left}</span>);
  if (main) parts.push(
    <span key="m" className="text-[15px] font-semibold tabular-nums tracking-tight">
      {main}
    </span>
  );
  if (right) parts.push(
    <span key="r" className="text-[13px] text-white/70 tabular-nums">
      {right}
    </span>
  );

  const separated = parts.reduce((acc, node, i) => {
    if (i > 0) {
      // Visible vertical bar for sighted users; a screen-reader-only
      // bullet so assistive tech reads e.g. "Driver accepted · £141.50"
      // instead of concatenating the text nodes.
      acc.push(
        <React.Fragment key={`sep-${i}`}>
          <span className="sr-only"> · </span>
          <span className="mx-2 h-4 w-px bg-white/25" aria-hidden="true" />
        </React.Fragment>
      );
    }
    acc.push(node);
    return acc;
  }, []);

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-testid={testId}
      className={[
        "pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2",
        "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-md",
        "transition-transform active:scale-[0.98]",
        variantClasses,
        onClick ? "cursor-pointer" : "",
        className,
      ].join(" ")}
    >
      {pulse && (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotClass} opacity-70`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`} />
        </span>
      )}
      {Icon && <Icon className="h-4 w-4 shrink-0 text-white/80" aria-hidden="true" />}
      {separated.length > 0 && (
        <span className="flex min-w-0 items-center whitespace-nowrap">{separated}</span>
      )}
      {RightIcon && (
        <RightIcon className="ml-1 h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />
      )}
    </Wrapper>
  );
}

export default AsapTopStatusPill;
