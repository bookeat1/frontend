/**
 * Top-level route segments this app actually has under `app/` (Expo
 * Router file-based routing) — mirrors the directory/file names there.
 * Used ONLY as a last-resort validity check for a Detour-resolved
 * pathname that carries no recognizable promo payload (see
 * `resolvePromoPathSegment` in `detour-json-segment.ts` for that case,
 * which is handled separately and is NOT covered by this list).
 *
 * BUG this guards against (2026-09-21): for a deferred/first-install
 * short link with no destination configured on Detour's dashboard (e.g.
 * `https://bookeat.godetour.link/lQ9BPpUvJc`), the SDK can occasionally
 * hand `DetourLinkRouter` (`detour-link-router.tsx`) a `link.pathname`
 * that is literally the link's own shortcode (e.g. `/lQ9BPpUvJc`)
 * instead of a real destination — it matches no screen.
 * `router.replace`-ing straight to it (previous code) surfaced Expo
 * Router's "Unmatched Route" screen on first app open instead of the
 * ordinary home screen.
 *
 * `app/+native-intent.tsx` already has a safety net for the sibling
 * "tap while already installed" case via Detour's own `fallbackPath: ""`
 * — but that fires only when the SDK's OWN resolution call throws/fails
 * (network error, bad response), a DIFFERENT failure mode from
 * "resolution succeeded, but the result isn't one of our routes", which
 * is the shape this bug actually takes. `resolvePromoPathSegment` already
 * covers the promo-JSON-segment shape of that gap; this allowlist is the
 * equivalent net for the plain (non-promo) case.
 *
 * Keep in sync with `app/`'s top-level segments when routes are added or
 * removed — that's an accepted maintenance cost of an allowlist, not an
 * oversight. A route missing here just falls back to the home screen
 * instead of navigating (same degrade Detour's own `fallbackPath` uses),
 * so drift is safe, not silently broken.
 */
const KNOWN_ROOT_SEGMENTS = new Set<string>([
  "articles",
  "auth",
  "booking",
  "bookings",
  "brand",
  "city",
  "event",
  "events",
  "favorites",
  "foodie-profile",
  "gastroguide",
  "guide",
  "notifications",
  "onboarding",
  "profile",
  "promotion",
  "promotions",
  "restaurant",
  "routes",
  "search",
  "settings",
]);

/**
 * `true` for the home route (`"/"`/`""`) and any pathname whose FIRST
 * segment is a real top-level app route. `false` for anything else,
 * including a raw Detour shortcode — the caller should fall back to the
 * home route rather than navigate to it.
 */
export function isKnownAppRoutePathname(pathname: string): boolean {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment) return true; // "/" or "" — home route
  return KNOWN_ROOT_SEGMENTS.has(firstSegment);
}
