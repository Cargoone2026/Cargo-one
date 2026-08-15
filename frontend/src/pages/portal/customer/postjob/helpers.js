/**
 * R48 — Pure PostJob helpers. Extracted from PostJob.jsx so the parent
 * stays lean. No behaviour change; these are trivially unit-testable.
 */

export function volumeFromDims(l, w, h) {
  const ln = Number(l), wn = Number(w), hn = Number(h);
  if (ln > 0 && wn > 0 && hn > 0) return Number((ln * wn * hn).toFixed(2));
  return null;
}

export function fmtDur(mins) {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
