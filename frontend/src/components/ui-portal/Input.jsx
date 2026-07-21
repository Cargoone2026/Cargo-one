import React, { forwardRef } from "react";

/**
 * Cargo One portal Input — web port of the Expo Input component.
 * Supports label + helper/error text and leading/trailing icons.
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    icon,
    trailing,
    className = "",
    inputClassName = "",
    testID,
    ...rest
  },
  ref,
) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1 block text-[13px] font-semibold text-[#111111]">
          {label}
        </span>
      )}
      <span
        className={`flex items-center gap-2 rounded-[12px] border bg-white px-3 py-2 ${
          error
            ? "border-[#DC2626]"
            : "border-[#E5E7EB] focus-within:border-[#111111]"
        }`}
      >
        {icon}
        <input
          ref={ref}
          data-testid={testID}
          className={`flex-1 bg-transparent text-[15px] text-[#111111] placeholder:text-[#9CA3AF] outline-none ${inputClassName}`}
          {...rest}
        />
        {trailing}
      </span>
      {error ? (
        <span className="mt-1 block text-[12px] text-[#DC2626]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-[#6B7280]">{hint}</span>
      ) : null}
    </label>
  );
});
