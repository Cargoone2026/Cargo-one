// Cargo One design tokens - iOS Native Clean personality
// Red / Black / Orange / White / Grey premium logistics theme

export const colors = {
  // Brand
  brand: "#D62828",
  brandDark: "#B01F1F",
  brandLight: "#FEE2E2",
  accent: "#FF6A00",
  accentDark: "#E55E00",

  // Surface (light)
  bg: "#FFFFFF",
  bgSecondary: "#F4F4F4",
  bgTertiary: "#E5E7EB",
  bgDark: "#111111",
  bgDarkSecondary: "#1C1C1E",

  // Text
  text: "#111111",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  textInverse: "#FFFFFF",

  // Semantic
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  error: "#DC2626",
  errorBg: "#FEE2E2",
  info: "#3B82F6",
  infoBg: "#DBEAFE",

  // Border/Divider
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F3F4F6",

  // Overlay
  overlay: "rgba(0,0,0,0.5)",
  overlayLight: "rgba(0,0,0,0.15)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const weight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

export const STATUS_LABELS: Record<string, string> = {
  posted: "Posted",
  accepted: "Awaiting Deposit",
  deposit_paid: "Deposit Paid",
  confirmed: "Confirmed",
  travelling: "Driver Travelling",
  arrived: "Arrived at Pickup",
  collected: "Collected",
  on_route: "On Route",
  delivered: "Delivered",
  pod_uploaded: "POD Uploaded",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
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

export const CATEGORIES = [
  { id: "furniture", label: "Furniture", icon: "bed" },
  { id: "pallets", label: "Pallets", icon: "cube" },
  { id: "cars", label: "Cars", icon: "car" },
  { id: "motorcycles", label: "Motorcycles", icon: "bicycle" },
  { id: "house_moves", label: "House Moves", icon: "home" },
  { id: "parcels", label: "Parcels", icon: "cube-outline" },
  { id: "freight", label: "Freight", icon: "boat" },
  { id: "documents", label: "Documents", icon: "document" },
  { id: "boats", label: "Boats", icon: "boat-outline" },
  { id: "machinery", label: "Machinery", icon: "construct" },
];
