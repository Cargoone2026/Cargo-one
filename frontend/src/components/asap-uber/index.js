/**
 * ASAP + Active-Job Uber-style UX — shared component barrel.
 *
 * These components power the map-first experience across:
 *   - Driver ASAP Live Mode (full screen)              — R54
 *   - Customer ASAP live tracking (full screen)        — R55
 *   - Driver / Customer active-booking detail (panel)  — R68
 *
 * All CargoOne business logic (dispatch, pricing, payments, contact
 * privacy, cancellation, tracking authorisation) lives in the existing
 * hooks / APIs — these components are strictly the UX shell.
 */

// R54 / R55 primitives.
export { AsapMapCanvas } from "./AsapMapCanvas";
export { AsapTopStatusPill } from "./AsapTopStatusPill";
export { AsapFloatingControls } from "./AsapFloatingControls";
export { AsapBottomSheet } from "./AsapBottomSheet";
export { useAsapMapProvider } from "./useAsapMapProvider";

// R68 — Cross-job navigation UX.
export {
  ActiveJobMapPanel,
} from "./ActiveJobMapPanel";
export {
  DestinationCard,
} from "./DestinationCard";
export {
  CargoNavigateButton,
  useCargoNavigation,
  buildNavigationUrl,
} from "./CargoNavigate";
