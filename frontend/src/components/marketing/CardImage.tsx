import React, { useState } from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

import { DEFAULT_CARD_IMAGE } from "./images";

type Props = {
  uri: string;
  fallback?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain";
  testID?: string;
};

/**
 * Image wrapper that automatically swaps to a safe default if the primary
 * category image URL fails to load — prevents grey placeholder tiles on the
 * "What We Move" and Services grids.
 */
export function CardImage({
  uri,
  fallback = DEFAULT_CARD_IMAGE,
  style,
  resizeMode = "cover",
  testID,
}: Props) {
  const [errored, setErrored] = useState(false);
  const source = { uri: errored ? fallback : uri };
  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        if (!errored) setErrored(true);
      }}
      testID={testID}
    />
  );
}
