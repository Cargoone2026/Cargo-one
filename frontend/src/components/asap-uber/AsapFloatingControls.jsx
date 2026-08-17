import React from "react";

/**
 * AsapFloatingControls — right-side vertical stack of circular icon
 * buttons for the ASAP map surface (recenter, layers, notifications, …).
 *
 * Props:
 *   buttons  — [{ id, icon: LucideIcon, label, onClick, active?,
 *                 badge?, testId?, variant? }]
 *              `active` gives the button a filled black look; `variant`
 *              overrides ('primary' | 'accent') for stand-out actions
 *              like "Go online". `badge` renders a small counter.
 *   position — 'right' (default) | 'left'. Left is used on the customer
 *              tracking screen so it doesn't collide with the driver
 *              card's right-side actions.
 *   className — pass-through.
 */
const VARIANTS = {
  ghost: "bg-white/95 text-neutral-900 border-white/60 hover:bg-white",
  primary: "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800",
  accent: "bg-[#EA580C] text-white border-[#EA580C] hover:bg-[#C2410C]",
  danger: "bg-red-600 text-white border-red-600 hover:bg-red-700",
};

export function AsapFloatingControls({
  buttons = [],
  position = "right",
  className = "",
  "data-testid": testId = "asap-floating-controls",
}) {
  if (!buttons || buttons.length === 0) return null;

  const positionClass =
    position === "left" ? "left-3 sm:left-4" : "right-3 sm:right-4";

  return (
    <div
      data-testid={testId}
      className={[
        "pointer-events-auto absolute z-20 flex flex-col gap-2",
        positionClass,
        className,
      ].join(" ")}
    >
      {buttons.map((b) => {
        const Icon = b.icon;
        const variantClass = VARIANTS[b.variant || (b.active ? "primary" : "ghost")];
        return (
          <button
            key={b.id}
            type="button"
            onClick={b.onClick}
            aria-label={b.label}
            title={b.label}
            data-testid={b.testId || `asap-fab-${b.id}`}
            className={[
              "relative flex h-11 w-11 items-center justify-center rounded-full border",
              "shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)] backdrop-blur-md",
              "transition-transform active:scale-95",
              variantClass,
              b.disabled ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            disabled={b.disabled}
          >
            {Icon ? <Icon className="h-[18px] w-[18px]" aria-hidden="true" /> : null}
            {b.badge ? (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[18px] text-white text-center"
                aria-hidden="true"
              >
                {b.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default AsapFloatingControls;
