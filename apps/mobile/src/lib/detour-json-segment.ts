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
 *
 * ---
 *
 * DETOUR DASHBOARD CONTRACT for the two "Marathon" QR channels (21.09.2026,
 * `specs/marathon-qr-attribution-20260921.md` §6 задача З10 — for Damir to
 * create the links himself, this repo has no Detour dashboard access):
 *
 *   1. Create both links inside the SAME Detour app the live marathon link
 *      already uses (domain `bookeat.godetour.link`, links starting with the
 *      short-code prefix `lQ9BPpUvJc` — e.g. the existing
 *      `https://bookeat.godetour.link/lQ9BPpUvJc00ughb`). A link from a
 *      DIFFERENT Detour app will not match `app.json`'s
 *      `android.intentFilters` `pathPrefix: "/lQ9BPpUvJc"`, so Android App
 *      Links will not intercept it and the tap falls through to a browser
 *      (criterion 6 of the spec). Both links now exist and are live:
 *        - t-shirt QR: https://bookeat.godetour.link/lQ9BPpUvJc05rn4w
 *        - box QR:     https://bookeat.godetour.link/lQ9BPpUvJc097qa8
 *      Both already carry the required `lQ9BPpUvJc` prefix, satisfying
 *      criterion 6.
 *   2. Give each link a custom parameter with key `source` — exactly that
 *      key, lowercase — and value `tshirt` for the t-shirt QR, `box` for the
 *      box QR. Both values must match `^[a-z0-9_-]{1,32}$` (they already do).
 *      This is the ONLY thing that matters: whatever "destination route" the
 *      dashboard form also asks for is irrelevant for this campaign — the
 *      app never opens a promo screen for a `source`-tagged link, it always
 *      lands on the ordinary home screen (`resolveSourcePathSegment` below /
 *      `mapDetourResolvedUrlToRoute` in `detour-native-intent-route.ts`), so
 *      any placeholder destination is fine.
 *   3. Detour hands the parameter back to the app in one of two shapes, and
 *      the client (this module + `campaign-attribution.ts`) reads BOTH:
 *        - the live marathon link's shape — the parameter serialized as JSON
 *          in the link's own trailing path segment, e.g.
 *          `https://bookeat.godetour.link/lQ9BPpUvJc<slug>/%7B%22source%22%3A%22tshirt%22%7D`
 *          (decodes to `{"source":"tshirt"}`) — handled by
 *          `resolveSourcePathSegment` below;
 *        - an ordinary query parameter, `?source=tshirt` — handled directly
 *          by `extractSource` in `campaign-attribution.ts` without going
 *          through this module at all.
 *      CONFIRMED (QA, live resolve of the two links above, 21.09.2026): both
 *      new links resolve to the JSON-TAIL shape, NOT `?source=`. A raw
 *      resolve of the t-shirt link's short URL answers a path ending in
 *      `%7B%22source%22:%22tshirt%22%7D` — i.e. `{"source":"tshirt"}` sitting
 *      in the path itself, exactly the shape `resolveSourcePathSegment`
 *      below parses. The `?source=` branch in `extractSource` stays as
 *      defensive handling for a link configured differently in the future,
 *      but is not what these two links produce.
 *
 * Regression: the OLD contract, `{"promo":"<uuid>"}` (still live on the
 * Almaty Marathon link created earlier), is untouched by any of the above —
 * `resolvePromoPathSegment` below is tried FIRST and wins if a link somehow
 * carries both `promo` and `source` (spec criterion 7).
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

export interface ResolvedSourcePathSegment {
  /**
   * Always the home route: a channel-tag QR (21.09.2026, «Марафон Алматы»
   * ревизия 2, `specs/marathon-qr-attribution-20260921.md`) never opens a
   * promo screen — the tag survives the campaign and is not tied to any
   * `promos` record (see `campaign-attribution.ts`'s module comment).
   */
  pathname: "/";
  /** Same shape as `ResolvedPromoPathSegment.params` — the JSON payload's own
   * primitive fields (`source` plus any extras), ready to forward. */
  params: Record<string, string>;
}

/**
 * Sibling of `resolvePromoPathSegment` for the channel-tag contract
 * (`{"source":"tshirt"}` / `{"source":"box"}`): if the pathname's LAST
 * segment decodes to a JSON object with a non-empty string `source` field,
 * returns the HOME route (never a promo screen) plus that JSON's own
 * primitive fields. Otherwise `null`.
 *
 * Callers must try `resolvePromoPathSegment` FIRST and only fall back to
 * this function when it returns `null` — a link is never expected to carry
 * both `promo` and `source`, but if it somehow did, the old `promo` contract
 * wins (regression safety, `specs/marathon-qr-attribution-20260921.md`
 * criterion 7).
 */
export function resolveSourcePathSegment(pathname: string): ResolvedSourcePathSegment | null {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const jsonPayload = lastSegment ? tryParseJsonSegment(lastSegment) : null;
  const source = jsonPayload?.source;
  if (typeof source !== "string" || source.length === 0) return null;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(jsonPayload ?? {})) {
    if (isPrimitive(value)) params[key] = String(value);
  }

  return { pathname: "/", params };
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
