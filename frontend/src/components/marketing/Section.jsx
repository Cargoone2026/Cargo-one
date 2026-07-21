import React from "react";

/**
 * Marketing content section wrapper. Mirrors the Expo <Section /> component.
 */
export function Section({
  children,
  bg = "#FFFFFF",
  narrow = false,
  paddedY = true,
  className = "",
  testId,
}) {
  return (
    <section
      style={{ backgroundColor: bg }}
      className={`flex w-full items-center ${className}`}
      data-testid={testId}
    >
      <div
        className={`mx-auto w-full px-4 md:px-10 ${
          paddedY ? "py-14 md:py-20" : ""
        }`}
        style={{ maxWidth: narrow ? 820 : 1200 }}
      >
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, onDark = false }) {
  const fg = onDark ? "#fff" : "#111111";
  const sub = onDark ? "rgba(255,255,255,0.7)" : "#6B7280";
  return (
    <div className="mb-6 flex flex-col items-center gap-2 text-center">
      {eyebrow ? (
        <p className="text-[12px] font-bold tracking-[2px] text-[#D62828]">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className="max-w-[760px] text-[28px] font-bold leading-tight tracking-[-0.5px] md:text-[36px]"
        style={{ color: fg }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className="max-w-[620px] text-[16px] leading-relaxed md:text-[18px]"
          style={{ color: sub }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
