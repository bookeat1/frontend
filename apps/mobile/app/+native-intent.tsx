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
 * one hop. Both `detourConfig.apiKey`/`appID` are set for real now (see
 * `src/lib/detour.ts`); this handler's own `sendUniversalLinkClick`/
 * `resolveShortLink` calls already catch their own errors and fall back to
 * `fallbackPath` (verified by reading the vendored source, not assumed —
 * unlike `DetourProvider`'s automatic-events path, which does NOT have this
 * safety net, see `detour.ts`/`detour-provider-gate.tsx`), so an
 * empty/misconfigured build still degrades to a normal deep link here too.
 */
export const redirectSystemPath = createDetourNativeIntentHandler({
  fallbackPath: "",
  config: detourConfig,
});
