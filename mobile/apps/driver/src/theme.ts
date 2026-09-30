/**
 * CargoOne Driver — design tokens.
 *
 * Values mirror the working Driver web application 1:1 so mobile stays
 * visually indistinguishable from web wherever the layout allows.
 *   • Brand red         → #D62828     (primary CTA / links)
 *   • Deep black        → #111111     (headers, primary text)
 *   • Soft input bg     → #F4F4F4     (inputs, disabled surfaces)
 *   • Border grey       → #E5E7EB
 *   • Muted text        → #6B7280
 *   • Danger red text   → #DC2626
 *   • Success           → #16A34A
 *   • Warning amber     → #F59E0B
 *   • Screen bg         → #FFFFFF
 *
 * Do NOT invent new tokens on mobile — every colour used in a screen
 * must originate here so future audits against the web app stay easy.
 */
export const colors = {
  bg: "#FFFFFF",
  header: "#111111",
  text: "#111111",
  textMuted: "#6B7280",
  textOnDark: "#FFFFFF",
  brand: "#D62828",
  brandHover: "#B01F1F",
  inputBg: "#F4F4F4",
  border: "#E5E7EB",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#F59E0B",
  dividerLight: "#9CA3AF",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  input: 12,
  card: 12,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  bodySm: { fontSize: 14, fontWeight: "400" as const },
  label: { fontSize: 12, fontWeight: "600" as const },
  button: { fontSize: 16, fontWeight: "700" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
} as const;
