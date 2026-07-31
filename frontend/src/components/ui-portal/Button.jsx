import React from "react";

/**
 * Cargo One portal Button — web port of the Expo Button component.
 * Variants: primary | secondary | outline | ghost | dark
 */
export function Button({
  title,
  onClick,
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  fullWidth = true,
  small = false,
  className = "",
  testID,
  children,
  ...rest
}) {
  // Accept both `testID` (RN-style) and `data-testid` (web-standard) props.
  const dataTestId = rest["data-testid"] || testID;
  // Strip out data-testid from rest so it isn't spread twice.
  const { ["data-testid"]: _omit, ...restProps } = rest;
  const isDisabled = disabled || loading;
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold transition-colors select-none";
  const size = small
    ? "min-h-[36px] px-4 py-1.5 text-[14px]"
    : "min-h-[52px] px-6 py-3 text-[16px]";
  const width = fullWidth ? "w-full" : "w-auto";

  let variantCls = "";
  if (variant === "primary") {
    variantCls =
      "bg-[#D62828] text-white hover:bg-[#B01F1F] active:bg-[#B01F1F]";
  } else if (variant === "secondary") {
    variantCls =
      "bg-[#FF6A00] text-white hover:bg-[#E55E00] active:bg-[#E55E00]";
  } else if (variant === "outline") {
    variantCls =
      "bg-transparent text-[#111111] border-[1.5px] border-[#111111] hover:bg-[#111111] hover:text-white";
  } else if (variant === "ghost") {
    variantCls = "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]";
  } else if (variant === "dark") {
    variantCls = "bg-[#111111] text-white hover:bg-[#1C1C1E]";
  }

  const disabledCls = isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      data-testid={dataTestId}
      className={`${base} ${size} ${width} ${variantCls} ${disabledCls} ${className}`}
      {...restProps}
    >
      {loading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        children || title
      )}
    </button>
  );
}
