import type { Config } from "@swmansion/react-native-detour";

/**
 * Shared config for Detour (deferred deep linking, Software Mansion,
 * https://detour.swmansion.com) — the single object both `app/_layout.tsx`
 * (`DetourProvider`) and `app/+native-intent.tsx`
 * (`createDetourNativeIntentHandler`) mount from, so the two never drift.
 *
 * Both values are PUBLIC by design (same reasoning as
 * `EXPO_PUBLIC_AMPLITUDE_API_KEY` in `analytics.ts`): Detour's docs call
 * `apiKey` the "publishable" client key, meant to ship inside the bundle.
 * The SECRET key (server-side REST API for creating/listing links) must
 * never appear here or anywhere under `apps/mobile` — see `~/.bookeat/detour.env`.
 *
 * Both values are set for real now (App ID from the Detour dashboard,
 * 2026-09-09; `.env.example`, `eas.json`). `isDetourConfigured` below is what
 * actually keeps a misconfigured build (e.g. local dev with no `.env`) safe —
 * NOT a "no-op without appID" built into the SDK itself. Read the vendored
 * source before trusting a comment here again: `DetourProviderNative`
 * (`node_modules/@swmansion/react-native-detour/src/DetourContext.tsx`) fires
 * an automatic retention event on EVERY cold start via
 * `useAppOpenRetention(shouldTrackAutomaticEvents)`, unconditionally — it
 * does not check `apiKey`/`appID` before POSTing (would just go out with a
 * blank `Authorization`/`X-App-ID`). Only `useDetour`'s own cold-start link
 * effect skips its network call when either is empty. So the one place that
 * actually has to gate on `isDetourConfigured` is OUR mount of
 * `<DetourProvider>` in `app/_layout.tsx`: skip mounting it at all when
 * either value is empty, and `DetourProviderNative` (and its automatic
 * event) never runs. `shouldTrackAutomaticEvents` stays at its default
 * (`true`) once the provider *is* mounted — that default is what we want in
 * every properly configured build.
 */
export const detourConfig: Config = {
  apiKey: process.env.EXPO_PUBLIC_DETOUR_API_KEY ?? "",
  appID: process.env.EXPO_PUBLIC_DETOUR_APP_ID ?? "",
  shouldUseClipboard: true,
  // `app/+native-intent.tsx` already resolves runtime Universal/App links and
  // the initial (cold-start) URL before the first screen renders, so the
  // provider itself only needs to pick up DEFERRED links (the ones recovered
  // via clipboard/fingerprint after an App Store detour) — this is Detour's
  // documented setting for Expo Router apps that use the native-intent
  // handler, and avoids the same link being processed twice.
  linkProcessingMode: "deferred-only",
};

/** See the comment above: gates whether `<DetourProvider>` mounts at all. */
export const isDetourConfigured = Boolean(detourConfig.apiKey && detourConfig.appID);
