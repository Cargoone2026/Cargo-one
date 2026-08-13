import React, { useState, useCallback } from "react";
import DriverLiveMapMapbox from "./DriverLiveMapMapbox";
import DriverLiveMapGoogle from "./DriverLiveMapGoogle";

/**
 * DriverLiveMap — engine dispatcher (Mapbox → Google fallback).
 *
 * Consumer contract unchanged:
 *   <DriverLiveMap lat lng offers? onOfferClick? className? showSweep? />
 *
 * Same engine-selection logic as RouteMap (see /app/memory/PRD.md R27).
 */

const HAS_TOKEN = Boolean(process.env.REACT_APP_MAPBOX_TOKEN);

export function DriverLiveMap(props) {
  const [useGoogle, setUseGoogle] = useState(!HAS_TOKEN);

  const onFatalError = useCallback((err) => {
    // eslint-disable-next-line no-console
    console.warn("[DriverLiveMap] Mapbox unavailable, falling back to Google:", err?.message || err);
    setUseGoogle(true);
  }, []);

  if (useGoogle) return <DriverLiveMapGoogle {...props} />;
  return <DriverLiveMapMapbox {...props} onFatalError={onFatalError} />;
}

export default DriverLiveMap;
