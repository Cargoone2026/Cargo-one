import React from "react";

/**
 * Cargo One text input — ported from the Expo <Input /> component.
 */
export function Input({
  label,
  error,
  multiline = false,
  rows = 4,
  testId,
  containerClass = "",
  className = "",
  ...rest
}) {
  const baseInput =
    "w-full rounded-[12px] border bg-white px-4 py-3 text-[16px] text-[#111111] outline-none transition-colors focus:border-[#D62828] " +
    (error ? "border-[#DC2626]" : "border-[#E5E7EB]");
  return (
    <div className={`mb-4 ${containerClass}`}>
      {label && (
        <label className="mb-1 block text-[12px] font-medium uppercase tracking-wider text-[#6B7280]">
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          rows={rows}
          data-testid={testId}
          className={`${baseInput} resize-y ${className}`}
          {...rest}
        />
      ) : (
        <input data-testid={testId} className={`${baseInput} ${className}`} {...rest} />
      )}
      {error && <p className="mt-1 text-[12px] text-[#DC2626]">{error}</p>}
    </div>
  );
}
