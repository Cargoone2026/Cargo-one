/**
 * Cargo One Driver — client-side validators.
 *
 * Ported verbatim from `frontend/src/lib/validators.js` so the driver
 * mobile Register form applies identical rules to the web Driver Register
 * page. Keep the rules permissive — the backend has authoritative checks.
 */

/**
 * Very permissive phone check. Accepts:
 *   • UK mobile      07xxx xxx xxx        (10-11 digits)
 *   • UK landline    01xxx / 02xxx / 03xxx (10-11 digits)
 *   • International  +[country][subscriber] (8-15 digits total)
 * Spaces, dashes and parentheses are stripped before checking.
 */
export function isValidPhone(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const digits = String(raw).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) return /^\+\d{7,15}$/.test(digits);
  if (digits.startsWith("00")) return /^00\d{7,15}$/.test(digits);
  return /^0\d{9,10}$/.test(digits);
}

/**
 * UK postcode validator — supports every legal outward + inward code
 * (incl. GIR 0AA, special formats). Case- and whitespace-insensitive.
 */
export function isValidUKPostcode(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const norm = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  return /^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(norm);
}

/** Very permissive email check — good enough for the register form. */
export function isValidEmail(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw).trim());
}
