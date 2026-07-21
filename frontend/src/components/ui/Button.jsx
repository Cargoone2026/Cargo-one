import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Cargo One brand button — ported from the Expo <Button /> component.
 * Variants: primary (brand red), secondary (accent orange), outline (dark border),
 * ghost (grey fill), dark (black).
 */
export function Button({
  title,
  onClick,
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  small = false,
  fullWidth = true,
  className = "",
  testId,
  children,
}) {
  const isDisabled = disabled || loading;
  const variantClasses = {
    primary: "bg-[#D62828] text-white hover:bg-[#B01F1F]",
    secondary: "bg-[#FF6A00] text-white hover:bg-[#E55E00]",
    outline: "border-[1.5px] border-[#111111] text-[#111111] bg-transparent hover:bg-[#F4F4F4]",
    ghost: "bg-[#F4F4F4] text-[#111111] hover:bg-[#E5E7EB]",
    dark: "bg-[#111111] text-white hover:bg-black",
  }[variant];
  const sizeClasses = small ? "px-4 py-2 min-h-[36px] text-[14px]" : "px-6 py-3 min-h-[52px] text-[16px]";
  const width = fullWidth ? "w-full" : "";
  const disabledClasses = isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      data-testid={testId}
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors ${variantClasses} ${sizeClasses} ${width} ${disabledClasses} ${className}`}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children ?? title}
    </button>
  );
}
