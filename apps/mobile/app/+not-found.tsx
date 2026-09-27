import { Redirect } from "expo-router";

/**
 * Global fallback for any pathname Expo Router cannot match to a screen.
 *
 * Without this file, an unmatched route (a stale/rewritten deep link, a bare
 * Detour shortcode with no destination configured, a bookmark to a route
 * that got renamed, ...) shows Expo Router's default "Unmatched Route"
 * screen — a dead end for a guest, especially one who just scanned a QR code
 * off a marathon leaflet/box and has never opened the app before.
 *
 * This is a defensive net independent of any specific attribution fix
 * (`web-promo-attribution.tsx`, `detour-known-routes.ts`, ...): those already
 * resolve the routes THEY know about before the router itself would ever see
 * an unmatched pathname; this file only catches whatever is left over,
 * native and web alike, by sending the guest to the home screen instead of a
 * dead end.
 */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
