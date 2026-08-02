/**
 * Cargo One — Client-side input validators.
 *
 * Keep the rules permissive (never block a user for a legitimate value);
 * these are advisory checks that surface "did you mean…?" feedback before
 * the request round-trips to the backend.
 */

/**
 * Very permissive phone check. Accepts:
 *  - UK mobile:      07xxx xxx xxx (10-11 digits)
 *  - UK landline:    01xxx / 02xxx / 03xxx (10-11 digits)
 *  - International:  +[country][subscriber], 8-15 digits total
 * Spaces, dashes and parentheses are stripped before checking.
 */
export function isValidPhone(raw) {
  if (!raw) return false;
  const digits = String(raw).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) {
    return /^\+\d{7,15}$/.test(digits);
  }
  if (digits.startsWith("00")) {
    return /^00\d{7,15}$/.test(digits);
  }
  // UK domestic — must start with 0, 10-11 digits total
  return /^0\d{9,10}$/.test(digits);
}

/**
 * UK postcode validator — supports every legal outward + inward code (incl.
 * GIR 0AA, special formats). Case- and whitespace-insensitive.
 */
export function isValidUKPostcode(raw) {
  if (!raw) return false;
  const norm = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  // Standard: A9 9AA, A9A 9AA, A99 9AA, AA9 9AA, AA9A 9AA, AA99 9AA
  return /^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(norm);
}

/**
 * Normalise a UK postcode to the canonical "XX9 9XX" form. Returns the
 * original input if not a recognised UK postcode.
 */
export function formatUKPostcode(raw) {
  if (!raw) return "";
  const norm = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!isValidUKPostcode(norm)) return raw;
  return `${norm.slice(0, -3)} ${norm.slice(-3)}`;
}

/**
 * Very permissive email check — good enough for the register / profile
 * forms; the backend has authoritative validation via EmailStr.
 */
export function isValidEmail(raw) {
  if (!raw) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw).trim());
}
