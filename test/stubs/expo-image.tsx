import React from "react";

/**
 * `expo-image` in the test runner.
 *
 * WHY A STUB AND NOT THE REAL PACKAGE: expo-image's web build still imports
 * `expo-modules-core`, which reaches for `globalThis.expo.EventEmitter` and
 * `__DEV__` at module load — both installed by the Expo runtime, neither
 * present in a plain jsdom process. Importing it takes down the whole test
 * file before a single assertion runs (verified: "Cannot read properties of
 * undefined (reading 'EventEmitter')").
 *
 * WHAT THIS STUB DELIBERATELY DOES NOT DO: caching. `cachePolicy`,
 * `recyclingKey`, `priority` and `transition` are native behaviour and cannot
 * be observed here — pretending otherwise would produce a test that passes
 * while the app re-downloads every photo. They are rendered onto the DOM node
 * as data attributes ONLY so a test can assert that the app asked for them,
 * which is the part that is actually ours to get wrong. Whether the cache then
 * works is a question for a phone.
 *
 * What IS real here is the failure path: the stub renders a DOM <img>, so a
 * test can fire a genuine `error` event on it and watch the app fall back.
 */
interface StubImageProps {
  source?: { uri?: string } | string | number | null;
  onError?: () => void;
  onLoad?: () => void;
  testID?: string;
  alt?: string;
  accessibilityLabel?: string;
  cachePolicy?: string | null;
  recyclingKey?: string | null;
  transition?: number | null;
  priority?: string | null;
  [key: string]: unknown;
}

export function Image({
  source,
  onError,
  onLoad,
  testID,
  alt,
  accessibilityLabel,
  cachePolicy,
  recyclingKey,
  transition,
  priority,
}: StubImageProps) {
  const uri = typeof source === "string" ? source : (source?.uri ?? "");
  return (
    <img
      data-testid={testID}
      src={uri}
      alt={alt ?? accessibilityLabel ?? ""}
      aria-label={accessibilityLabel}
      data-cache-policy={cachePolicy ?? undefined}
      data-recycling-key={recyclingKey ?? undefined}
      data-transition={transition ?? undefined}
      data-priority={priority ?? undefined}
      onError={() => onError?.()}
      onLoad={() => onLoad?.()}
    />
  );
}

/** Real expo-image exposes this as a static on the component. Nothing in the
 * app calls it yet (photo prefetching was considered and skipped); it is here
 * so that adding a call does not silently blow up the whole test suite. */
Image.prefetch = async () => true;

export type ImageContentFit = "cover" | "contain" | "fill" | "none" | "scale-down";
export type ImageStyle = Record<string, unknown>;
