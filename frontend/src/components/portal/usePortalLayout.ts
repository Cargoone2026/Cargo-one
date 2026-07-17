import { useWindowDimensions } from "react-native";
import { Platform } from "react-native";

// Portals treat >= 1024 on WEB as "desktop" and get a sidebar layout.
// Native (iOS/Android) always keeps the bottom-tab mobile look.
export function usePortalLayout() {
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === "web" && width >= 1024;
  return {
    isWebDesktop,
    width,
  };
}
