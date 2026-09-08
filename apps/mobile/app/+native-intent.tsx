import { createDetourNativeIntentHandler } from "@swmansion/react-native-detour/expo-router";
import { detourConfig } from "../src/lib/detour";

/**
 * Expo Router's native-intent hook: runs BEFORE any route matches, for both
 * a runtime deep link and the app's cold-start URL. Lets
 * `createDetourNativeIntentHandler` intercept a Detour host (default
 * `*.godetour.link`, matches Detour's own default so left unset) and resolve
 * its short link into a real app route before the router ever renders a
 * route for the raw Detour URL — see
 * https://detour.swmansion.com/docs/sdk/react-native/sdk-usage and Detour's
 * own Expo Router example (`examples/expo-router-native-intent`).
 *
 * `fallbackPath: ""` (Detour's documented default) sends an unresolvable or
 * still-loading Detour link to the app's home route instead of flashing
 * Expo Router's "not found" screen for the raw `/abcd1234` path.
 *
 * `config` is passed (RESOLVE mode, not just intercept mode): the SDK calls
 * Detour's REST API to turn a short link into the real destination route in
 * one hop. `detourConfig.appID` is still a TODO — see `src/lib/detour.ts` —
 * until it's set this call fails fast and falls back to `fallbackPath`, same
 * as any other unmatched deep link today; no code change needed here once
 * the value arrives, only the env var.
 */
export const redirectSystemPath = createDetourNativeIntentHandler({
  fallbackPath: "",
  config: detourConfig,
});
