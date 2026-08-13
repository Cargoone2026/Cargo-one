import React, { useState, useCallback } from "react";
import RouteMapMapbox from "./RouteMapMapbox";
import RouteMapGoogle from "./RouteMapGoogle";

/**
 * RouteMap — engine dispatcher (Mapbox → Google fallback).
 *
 * Contract for every consumer is unchanged:
 *   <RouteMap pickup dropoff driver? trail? height? testID? summary? />
 *
 * Engine selection:
 *   1. If REACT_APP_MAPBOX_TOKEN is present AND Mapbox init succeeds, we use
 *      the Mapbox implementation (see RouteMapMapbox).
 *   2. If Mapbox reports a fatal error (missing token, URL restriction,
 *      style load 401, network offline) we transparently fall back to the
 *      existing Google implementation (RouteMapGoogle).
 *   3. If REACT_APP_MAPBOX_TOKEN is absent from the start, Mapbox is skipped
 *      and we render Google directly.
 *
 * The fallback ensures the R26 pricing sign-off remains protected — a broken
 * map never blocks a booking flow. Fallback removal happens after production
 * manual QA (see /app/memory/PRD.md R27 section).
 */

const HAS_TOKEN = Boolean(process.env.REACT_APP_MAPBOX_TOKEN);

export function RouteMap(props) {
  const [useGoogle, setUseGoogle] = useState(!HAS_TOKEN);

  const onFatalError = useCallback((err) => {
    // Log so operators see the reason in the browser console — but do not
    // toast the customer (map degradation is silent).
    // eslint-disable-next-line no-console
    console.warn("[RouteMap] Mapbox unavailable, falling back to Google:", err?.message || err);
    setUseGoogle(true);
  }, []);

  if (useGoogle) return <RouteMapGoogle {...props} />;
  return <RouteMapMapbox {...props} onFatalError={onFatalError} />;
}

export default RouteMap;
