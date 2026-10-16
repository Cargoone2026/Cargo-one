// Same rules as backend is_valid_phone / web isValidPhone: UK 0xxxxxxxxx(x), +intl 7-15, 00intl.
export function isValidPhone(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const digits = String(raw).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) return /^\+\d{7,15}$/.test(digits);
  if (digits.startsWith("00")) return /^00\d{7,15}$/.test(digits);
  return /^0\d{9,10}$/.test(digits);
}
