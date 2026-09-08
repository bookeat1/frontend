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
 * TODO(detour-app-id): `EXPO_PUBLIC_DETOUR_APP_ID` is not set yet — product
 * owner is still locating it in the Detour dashboard. Until it is set in
 * `.env`/EAS build env, `appID` resolves to `""` and Detour's backend calls
 * (deferred-link fetch, short-link resolve, click tracking) will fail
 * gracefully — `DetourProvider`/`createDetourNativeIntentHandler` catch
 * their own errors and fall back to normal Expo Router navigation, so the
 * app does not break, it just can't resolve Detour links yet. No code
 * change needed here once the value arrives, only the env var.
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
