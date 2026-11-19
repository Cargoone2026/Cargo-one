import { Alert, Linking, Platform } from "react-native";

export type NavTarget = { lat?: number | null; lng?: number | null; address?: string | null };

const validCoord = (t: NavTarget) =>
  Number.isFinite(t.lat) && Number.isFinite(t.lng) && !(t.lat === 0 && t.lng === 0);

export function hasNavTarget(t: NavTarget): boolean {
  return validCoord(t) || !!(t.address && t.address.trim());
}

async function openFirst(urls: string[]) {
  for (const url of urls) {
    try {
      if (url.startsWith("https://") || (await Linking.canOpenURL(url))) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // try next
    }
  }
}

export function openNavigation(t: NavTarget, label: string) {
  const dest = validCoord(t) ? `${t.lat},${t.lng}` : encodeURIComponent((t.address || "").trim());
  const web = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  if (Platform.OS === "android") {
    openFirst([`google.navigation:q=${dest}`, `geo:0,0?q=${dest}(${encodeURIComponent(label)})`, web]);
    return;
  }
  Alert.alert("Navigate", undefined, [
    { text: "Apple Maps", onPress: () => openFirst([`maps://?daddr=${dest}`, web]) },
    { text: "Google Maps", onPress: () => openFirst([`comgooglemaps://?daddr=${dest}&directionsmode=driving`, web]) },
    { text: "Cancel", style: "cancel" },
  ]);
}
