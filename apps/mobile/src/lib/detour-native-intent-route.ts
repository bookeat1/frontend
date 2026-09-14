import type { DetourNativeIntentResolvedValue } from "@swmansion/react-native-detour/expo-router";
import { resolvePromoPathSegment } from "./detour-json-segment";

/**
 * Custom `mapToRoute` for `app/+native-intent.tsx`.
 *
 * BUG (found live on iOS, 2026-09-14): tapping the Almaty Marathon promo
 * link (`https://bookeat.godetour.link/lQ9BPpUvJc00ughb`) on an
 * already-installed app landed on Expo Router's "Unmatched Route" instead
 * of the promo screen. Root cause: this link's destination is configured in
 * the Detour dashboard so that `resolve-short`'s `link` field comes back
 * with the link's PARAMETERS (`{"promo":"<uuid>"}`) serialized as the URL's
 * own trailing path segment, e.g.
 * `.../lQ9BPpUvJc00ughb/%7B%22promo%22%3A%226a3736b9-...%22%7D` — confirmed
 * by a direct call to Detour's `resolve-short` API, not guessed.
 *
 * The SDK's own default `mapToRoute` (`defaultMapToRoute` in
 * `node_modules/@swmansion/react-native-detour/src/expo-router/nativeIntent.ts`,
 * not exported from the package so it can't be reused directly) only knows
 * how to drop the FIRST path segment (the Detour app-hash) and route to
 * whatever's left. For an ordinary `.../<app-hash>/promotion/<id>` link
 * that's correct; here what's left is the percent-encoded JSON itself,
 * which matches no real screen.
 *
 * Fix: if the LAST path segment decodes to a JSON object with a `promo`
 * field, route straight to the existing promo detail screen
 * (`app/promotion/[id].tsx`) — confirmed as the intended destination by
 * `specs/marathon-qr-promo-20260906.md` R3.1 item 4 ("destination —
 * existing screen `/promotion/6a3736b9-…`, route `app/promotion/[id].tsx`
 * есть"). `promo` (and any other JSON field) is forwarded as a query string,
 * not just used for the path segment — `[id].tsx` now also reads `promo`
 * from the query to write campaign attribution for this "app already
 * installed" path (R3.1 item 5), the same way `WebPromoAttribution` does for
 * mobile-web and `DetourLinkRouter` does for the deferred-install path.
 *
 * Any link whose last segment is NOT JSON falls through to the same
 * drop-first-segment behavior the SDK's own default uses, so ordinary
 * (non-marathon) Detour links keep working exactly as before this fix.
 *
 * The actual JSON-segment parsing lives in `detour-json-segment.ts` — the
 * DEFERRED-link path (`detour-link-router.tsx`, a fresh install via the QR
 * on the marathon leaflet, this campaign's MAIN scenario) hits the exact
 * same shape and needs the exact same fix; code review on this branch
 * caught that the original version of this fix only covered the
 * already-installed-app tap, not deferred install (2026-09-14).
 */

const isWebProtocol = (url: URL) => url.protocol === "http:" || url.protocol === "https:";

/**
 * Same fallback Expo Router already used for a custom-scheme deep link
 * (`bookeat://...`) before this file existed — copied from the SDK's own
 * (unexported) `getRouteFromDeepLink`
 * (`node_modules/@swmansion/react-native-detour/src/links/utils/urlHelpers.ts`)
 * rather than importing an internal path that isn't part of the package's
 * public `exports` map (only `.` and `./expo-router` are exported).
 */
const routeFromCustomScheme = (url: URL): string => {
  const route = `${url.host}${url.pathname}${url.search}`;
  return route.startsWith("/") ? route : `/${route}`;
};

/** Same "drop the first segment" rule as the SDK's `defaultMapToRoute`, for
 * links whose last segment is not JSON (the general Detour link case). */
const defaultRouteForWebUrl = (url: URL): string => {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return `${url.pathname || "/"}${url.search}`;
  }
  return `/${segments.slice(1).join("/")}${url.search}`;
};

const toQueryString = (params: Record<string, string>): string =>
  Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

export const mapDetourResolvedUrlToRoute = ({
  resolvedUrl,
}: DetourNativeIntentResolvedValue): string => {
  if (!isWebProtocol(resolvedUrl)) {
    return routeFromCustomScheme(resolvedUrl);
  }

  const resolved = resolvePromoPathSegment(resolvedUrl.pathname);
  if (resolved) {
    // `promo` stays in the query (not just in the path) — the "app already
    // installed" attribution mirror (`app/promotion/[id].tsx`) reads it from
    // there via `useLocalSearchParams`, the same way `WebPromoAttribution`
    // reads `?promo=` on mobile-web.
    //
    // The resolved URL can carry its OWN query string too (e.g. a
    // `?utm_source=` Detour redirect appends outside the JSON blob) — the
    // default (non-promo) branch below already forwards `resolvedUrl.search`
    // as-is; do the same here instead of silently dropping it.
    const resolvedQuery = resolvedUrl.search.startsWith("?")
      ? resolvedUrl.search.slice(1)
      : resolvedUrl.search;
    const query = [toQueryString(resolved.params), resolvedQuery].filter(Boolean).join("&");
    return `${resolved.pathname}${query ? `?${query}` : ""}`;
  }

  return defaultRouteForWebUrl(resolvedUrl);
};
