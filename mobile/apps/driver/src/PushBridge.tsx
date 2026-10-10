import { useCallback, useEffect, useRef } from "react";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { DriverAPI } from "@cargoone/core";
import type { RootStackParamList } from "./App";
import {
  initPushForegroundHandler,
  registerForPushNotifications,
  unregisterCurrentToken,
  usePushNavigation,
} from "./pushNotifications";
import { resolveDriverRoute, type DriverPushData } from "./pushRoutes";

// Mounted only inside the authenticated tree: registers on login, unregisters on logout.
export function PushBridge({
  navigationRef,
}: {
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    initPushForegroundHandler();
    registerForPushNotifications(DriverAPI.registerPushToken).then((tok) => {
      if (!cancelled) tokenRef.current = tok;
    });
    return () => {
      cancelled = true;
      unregisterCurrentToken(DriverAPI.unregisterPushToken, tokenRef.current);
      tokenRef.current = null;
    };
  }, []);

  const navigate = useCallback((data: DriverPushData) => {
    if (!navigationRef.isReady()) {
      setTimeout(() => navigate(data), 300);
      return;
    }
    const r = resolveDriverRoute(data);
    (navigationRef as any).navigate(r.name, "params" in r ? r.params : undefined);
  }, [navigationRef]);

  usePushNavigation(navigate);
  return null;
}
