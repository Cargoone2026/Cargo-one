/**
 * CargoOne Driver — design tokens.
 *
 * Mirrors `mobile/apps/customer/src/theme.ts` 1:1 so Driver mobile shares
 * the same visual DNA as Customer. Never invent new primitives here —
 * if something is missing, pull it from Customer first.
 */
export const colors = {
  brand: "#D62828",
  brandDark: "#B01F1F",
  brandTint: "#FEE2E2",

  accent: "#FF6A00",
  accentDark: "#E55E00",

  ink: "#111111",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  inkInverse: "#FFFFFF",

  bg: "#FFFFFF",
  bgSecondary: "#F4F4F4",
  bgTertiary: "#E5E7EB",

  sidebarBg: "#0B0B0F",
  sidebarBorder: "rgba(255,255,255,0.10)",
  sidebarMuted: "rgba(255,255,255,0.55)",
  sidebarInk: "rgba(255,255,255,0.72)",
  sidebarActiveBg: "rgba(214,40,40,0.15)",

  success: "#16A34A",
  successBg: "#DCFCE7",
  successInk: "#166534",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  warningInk: "#92400E",
  error: "#DC2626",
  errorBg: "#FEE2E2",
  errorInk: "#B91C1C",
  info: "#3B82F6",
  infoBg: "#DBEAFE",
  infoInk: "#1E40AF",

  border: "#E5E7EB",
  hairline: "#F3F4F6",
  overlay: "rgba(0,0,0,0.5)",
} as const;

export const radius = { sm: 8, md: 10, base: 12, lg: 16, xl: 20, pill: 999 } as const;

export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48,
} as const;

export const typography = {
  pageTitle: { fontSize: 30, fontWeight: "700" as const, letterSpacing: -0.4, color: colors.ink },
  h1Large:   { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.4, color: colors.ink },
  h1:        { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.ink },
  h2:        { fontSize: 20, fontWeight: "700" as const, color: colors.ink },
  sectionTitle: { fontSize: 20, fontWeight: "700" as const, color: colors.ink },
  cardTitle: { fontSize: 16, fontWeight: "600" as const, color: colors.ink },
  strong:    { fontSize: 16, fontWeight: "700" as const, color: colors.ink },
  body:      { fontSize: 14, color: colors.ink },
  bodyMuted: { fontSize: 14, color: colors.inkMuted, lineHeight: 20 },
  caption:   { fontSize: 13, color: colors.inkMuted },
  small:     { fontSize: 12, color: colors.inkMuted },
  micro: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    color: colors.inkMuted,
    textTransform: "uppercase" as const,
  },
  price:    { fontSize: 18, fontWeight: "700" as const, color: colors.ink },
  priceBig: { fontSize: 22, fontWeight: "800" as const, color: colors.ink },
} as const;

export const shadow = {
  card:   { shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,  shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  press:  { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  drawer: { shadowColor: "#000", shadowOpacity: 0.3,  shadowRadius: 18, shadowOffset: { width: 4, height: 0 }, elevation: 8 },
} as const;

/**
 * Driver-side status badge palette. Driver web dashboard uses a
 * subset of booking statuses on upcoming jobs — reuse Customer's
 * palette so drivers and customers see the same colour per status.
 */
export const STATUS_LABELS: Record<string, string> = {
  posted: "Posted",
  accepted: "Awaiting Deposit",
  deposit_paid: "Deposit Paid",
  confirmed: "Confirmed",
  travelling: "Travelling",
  arrived: "Arrived at Pickup",
  collected: "Collected",
  on_route: "On Route",
  delivered: "Delivered",
  pod_uploaded: "POD Uploaded",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  // Driver account statuses (used on Home header pill)
  active: "Online",
  pending: "Pending",
  changes_requested: "Action needed",
  suspended: "Suspended",
};

export const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  posted:       { bg: "#DBEAFE", fg: "#1E40AF" },
  accepted:     { bg: "#FEF3C7", fg: "#92400E" },
  deposit_paid: { bg: "#DCFCE7", fg: "#166534" },
  confirmed:    { bg: "#DCFCE7", fg: "#166534" },
  travelling:   { bg: "#FEE2E2", fg: "#991B1B" },
  arrived:      { bg: "#FEE2E2", fg: "#991B1B" },
  collected:    { bg: "#FEE2E2", fg: "#991B1B" },
  on_route:     { bg: "#FEE2E2", fg: "#991B1B" },
  delivered:    { bg: "#DCFCE7", fg: "#166534" },
  pod_uploaded: { bg: "#DCFCE7", fg: "#166534" },
  completed:    { bg: "#E5E7EB", fg: "#111111" },
  cancelled:    { bg: "#FEE2E2", fg: "#B91C1C" },
  refunded:     { bg: "#F4F4F4", fg: "#6B7280" },
  // Driver account statuses
  active:            { bg: "#DCFCE7", fg: "#166534" },
  pending:           { bg: "#FEF3C7", fg: "#92400E" },
  changes_requested: { bg: "#FEE2E2", fg: "#B91C1C" },
  suspended:         { bg: "#FEE2E2", fg: "#B91C1C" },
};

export const CARGO = {
  red: colors.brand,
  redDark: colors.brandDark,
  ink: colors.ink,
  muted: colors.inkMuted,
  faint: colors.inkFaint,
  hairline: colors.border,
  offwhite: colors.bgSecondary,
  green: colors.success,
  bg: colors.bg,
  border: colors.border,
  divider: colors.hairline,
} as const;

export const theme = { colors, radius, space, typography, shadow } as const;
