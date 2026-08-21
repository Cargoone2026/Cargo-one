/**
 * theme.ts — CargoOne native design tokens, extracted verbatim from
 * frontend/src/index.css + Dashboard.jsx so the native surface reads
 * as the same product as the web customer portal. Do not invent new
 * values; match the web exactly.
 */
export const theme = {
  color: {
    brand: "#D62828",
    brandDark: "#B71C1C",
    ink: "#111111",
    inkMuted: "#6B7280",
    surface: "#FFFFFF",
    surfaceMuted: "#F4F4F4",
    border: "#E5E7EB",
    hairline: "#F3F4F6",
    tintRed: "#FEE2E2",
    tintOrange: "#FFF7ED",
    accentOrange: "#FF6A00",
    accentSuccess: "#16A34A",
    accentSuccessBg: "#DCFCE7",
    accentSuccessInk: "#166534",
    focus: "#D62828",
  },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
  type: {
    h1: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.4, color: "#111111" },
    h1Large: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.6, color: "#111111" },
    h2: { fontSize: 20, fontWeight: "700" as const, color: "#111111" },
    h3: { fontSize: 16, fontWeight: "600" as const, color: "#111111" },
    body: { fontSize: 14, color: "#111111" },
    bodyMuted: { fontSize: 14, color: "#6B7280" },
    caption: { fontSize: 13, color: "#6B7280" },
    micro: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5, color: "rgba(255,255,255,0.75)" },
  },
  shadow: {
    card: { shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  },
} as const;
