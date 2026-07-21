export const colors = {
  brand: "#D62828", brandDark: "#B01F1F", brandLight: "#FEE2E2",
  accent: "#FF6A00", accentDark: "#E55E00",
  bg: "#FFFFFF", bgSecondary: "#F4F4F4", bgTertiary: "#E5E7EB",
  bgDark: "#111111", bgDarkSecondary: "#1C1C1E",
  text: "#111111", textSecondary: "#6B7280", textTertiary: "#9CA3AF", textInverse: "#FFFFFF",
  success: "#16A34A", successBg: "#DCFCE7",
  warning: "#F59E0B", warningBg: "#FEF3C7",
  error: "#DC2626", errorBg: "#FEE2E2",
  info: "#3B82F6", infoBg: "#DBEAFE",
  border: "#E5E7EB", borderStrong: "#D1D5DB", divider: "#F3F4F6",
  overlay: "rgba(0,0,0,0.5)", overlayLight: "rgba(0,0,0,0.15)",
};

export const CONTENT_MAX_WIDTH = 1200;

export const STATUS_LABELS = {
  posted: "Posted", accepted: "Awaiting Deposit", deposit_paid: "Deposit Paid",
  confirmed: "Confirmed", travelling: "Driver Travelling", arrived: "Arrived at Pickup",
  collected: "Collected", on_route: "On Route", delivered: "Delivered",
  pod_uploaded: "POD Uploaded", completed: "Completed", cancelled: "Cancelled",
};

export const STATUS_COLOR = {
  posted: { bg: "#DBEAFE", fg: "#1E40AF" },
  accepted: { bg: "#FEF3C7", fg: "#92400E" },
  deposit_paid: { bg: "#DCFCE7", fg: "#166534" },
  confirmed: { bg: "#DCFCE7", fg: "#166534" },
  travelling: { bg: "#FEE2E2", fg: "#991B1B" },
  arrived: { bg: "#FEE2E2", fg: "#991B1B" },
  collected: { bg: "#FEE2E2", fg: "#991B1B" },
  on_route: { bg: "#FEE2E2", fg: "#991B1B" },
  delivered: { bg: "#DCFCE7", fg: "#166534" },
  pod_uploaded: { bg: "#DCFCE7", fg: "#166534" },
  completed: { bg: "#E5E7EB", fg: "#111111" },
  cancelled: { bg: "#F3F4F6", fg: "#6B7280" },
};

// Supported markets — mirrors backend/markets.py for AddressAutocomplete web fallback
export const SUPPORTED_MARKETS = [
  { iso2: "GB", name: "United Kingdom", postalCodeLabel: "Postcode" },
  { iso2: "IE", name: "Ireland", postalCodeLabel: "Eircode" },
  { iso2: "FR", name: "France", postalCodeLabel: "Code postal" },
  { iso2: "DE", name: "Germany", postalCodeLabel: "PLZ" },
  { iso2: "NL", name: "Netherlands", postalCodeLabel: "Postcode" },
];

export function marketName(iso2) {
  const m = SUPPORTED_MARKETS.find((x) => x.iso2 === iso2);
  return m ? m.name : iso2 || "";
}
