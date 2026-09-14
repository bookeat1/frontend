/**
 * Shared by two Detour entry points that can both receive a link whose
 * PARAMETERS come back serialized as JSON in the URL's own trailing path
 * segment instead of ordinary query params — confirmed against a live
 * `resolve-short` call for the Almaty Marathon short link, not guessed (see
 * `detour-native-intent-route.ts` for the full root-cause writeup):
 *
 * 1. `detour-native-intent-route.ts` (`app/+native-intent.tsx`) — tapping the
 *    link when the app is ALREADY INSTALLED.
 * 2. `detour-link-router.tsx` (`DetourLinkRouter`) — the DEFERRED link the
 *    SDK resolves once on a FRESH install (the QR-on-a-leaflet path, the
 *    campaign's main scenario). The SDK's own `getRestOfPath` already drops
 *    the Detour app-hash segment before either caller sees `pathname`, so
 *    here a link like `.../lQ9BPpUvJc/%7B%22promo%22:"<uuid>"%7D` arrives as
 *    `pathname = "/%7B%22promo%22:...%7D"` — a single segment that is itself
 *    the JSON blob, with no `promo` in `params` (whatever query params the
 *    SDK parsed separately, usually none for this shape).
 *
 * Both callers used to duplicate this parsing; this module is the one place
 * it lives now.
 */

const PROMO_ROUTE_PREFIX = "/promotion";

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

function tryParseJsonSegment(segment: string): Record<string, unknown> | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Malformed percent-encoding (e.g. a truncated UTF-8 byte sequence) —
    // not JSON, fall through to the caller's default routing.
    return null;
  }
  if (!decoded.trim().startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export interface ResolvedPromoPathSegment {
  /** `/promotion/<id>`, ready to use as a route's pathname. */
  pathname: string;
  /**
   * The JSON payload's own primitive fields (`promo` plus any extras, e.g.
   * `utm_content`), in the JSON's own key order, as strings ready to forward
   * as query/route params. Nested objects/arrays inside the JSON are
   * dropped — there is no `[id].tsx`-side use for them and forwarding an
   * object as a route param isn't meaningful.
   */
  params: Record<string, string>;
}

/**
 * If `pathname`'s LAST segment decodes to a JSON object with a non-empty
 * string `promo` field, returns the promo route + that JSON's own primitive
 * fields. Otherwise `null` — the pathname is an ordinary (non-promo) Detour
 * link and the caller should keep routing it as-is.
 *
 * Only the LAST segment is inspected (matches the SDK's own "whatever's left
 * after the app-hash is the route" model) — JSON anywhere else in the path
 * is left alone.
 */
export function resolvePromoPathSegment(pathname: string): ResolvedPromoPathSegment | null {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const jsonPayload = lastSegment ? tryParseJsonSegment(lastSegment) : null;
  const promoId = jsonPayload?.promo;
  if (typeof promoId !== "string" || promoId.length === 0) return null;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(jsonPayload ?? {})) {
    if (isPrimitive(value)) params[key] = String(value);
  }

  return { pathname: `${PROMO_ROUTE_PREFIX}/${encodeURIComponent(promoId)}`, params };
}
