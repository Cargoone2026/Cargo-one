/**
 * CargoOne Driver — design tokens.
 *
 * Values mirror the working Driver web application 1:1 so mobile stays
 * visually indistinguishable from web wherever the layout allows.
 *
 * Do NOT invent new tokens on mobile — every colour used in a screen
 * must originate here so future audits against the web app stay easy.
 */
export const colors = {
  // Neutrals / text
  bg: "#FFFFFF",
  header: "#111111",
  text: "#111111",
  textMuted: "#6B7280",
  textOnDark: "#FFFFFF",
  textWhiteFaint: "rgba(255,255,255,0.6)",
  headerBtnBg: "rgba(255,255,255,0.10)",

  // Brand
  brand: "#D62828",
  brandHover: "#B01F1F",

  // Inputs / borders / surfaces
  inputBg: "#F4F4F4",
  border: "#E5E7EB",
  surface: "#F9FAFB",
  surfaceHover: "#F3F4F6",
  dividerLight: "#9CA3AF",

  // Status / semantic
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#F59E0B",
  info: "#2563EB",
  accentPurple: "#7C3AED",
  accentOrange: "#FF6A00",
  amberText: "#B45309",
  darkAmberText: "#78350F",

  // Card icon-ring tints (background / foreground pairs — from web dashboard)
  tintRedBg: "#FEE2E2",
  tintRedFg: "#D62828",
  tintBlueBg: "#DBEAFE",
  tintBlueFg: "#2563EB",
  tintAmberBg: "#FEF3C7",
  tintAmberFg: "#F59E0B",
  tintGreenBg: "#DCFCE7",
  tintGreenFg: "#16A34A",
  tintPurpleBg: "#F3E8FF",
  tintPurpleFg: "#7C3AED",
  tintOrangeBg: "#FFF7ED",
  tintOrangeFg: "#FF6A00",

  // Warning banners
  bannerPendingBg: "#FFFBEB",
  bannerPendingBorder: "#FDE68A",
  bannerChangesBg: "#FEF2F2",
  bannerChangesBorder: "#DC2626",
  bannerChangesHint: "#78350F",
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
  card: 14,
  chip: 10,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "700" as const },
  headerName: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.5 },
  cardTitle: { fontSize: 16, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  bodySm: { fontSize: 14, fontWeight: "400" as const },
  label: { fontSize: 12, fontWeight: "600" as const },
  button: { fontSize: 16, fontWeight: "700" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  micro: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.6 },
  statValue: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  ratingValue: { fontSize: 42, fontWeight: "700" as const, letterSpacing: -0.5 },
  jobPrice: { fontSize: 16, fontWeight: "700" as const },
} as const;
