import React, { useState } from "react";
import { DEFAULT_CARD_IMAGE } from "@/components/marketing/images";

/**
 * <img> wrapper that falls back to a safe default if the primary URL 404s.
 * Preserves the behavior of the Expo <CardImage /> component.
 */
export function CardImage({
  uri,
  fallback = DEFAULT_CARD_IMAGE,
  alt = "",
  className = "",
  testId,
}) {
  const [errored, setErrored] = useState(false);
  return (
    <img
      src={errored ? fallback : uri}
      alt={alt}
      loading="lazy"
      className={className}
      data-testid={testId}
      onError={() => {
        if (!errored) setErrored(true);
      }}
    />
  );
}
