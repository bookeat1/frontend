/**
 * One place that decides what a photo slot shows, and one place that names the
 * caching rules every remote photo in the app is loaded with.
 *
 * WHY THIS FILE EXISTS AT ALL — three separate problems that all live in the
 * same decision:
 *
 * 1. CACHING. Photos come from Cloudflare R2, which does send sane validators
 *    (`Cache-Control: public, max-age=31536000, immutable` + ETag, checked with
 *    curl on 2026-07-27), so the bytes are cached on disk by default. What is
 *    NOT on by default is the memory cache: expo-image's default `cachePolicy`
 *    is `'disk'`, which means every time a venue card scrolls back into view
 *    the file is read off flash and decoded again. On a phone that is the
 *    difference between a card that is already there and a card that fades in
 *    for the third time. `'memory-disk'` fixes exactly that.
 *
 * 2. RECYCLED ROWS. `FlatList` reuses row views, so a row that used to show
 *    venue A can be handed venue B while A's bitmap is still mounted — the
 *    guest sees the wrong photo for a frame. `recyclingKey` (the URI) tells
 *    expo-image to drop the old bitmap instead of cross-fading into it.
 *
 * 3. FAILURE. An <Image> cannot read an HTTP status or a response body: all it
 *    can report is "this did not load". R2 answers a missing object with a bare
 *    `404 text/plain`, which an image view renders as nothing at all. So a
 *    failed photo has to be turned into the SAME neutral placeholder the app
 *    already shows for a venue that has no photo — a guest cannot tell those
 *    two apart anyway, and neither can we.
 *
 * The decision is a pure function so it can be tested; the pixels cannot be.
 *
 * 4. SIZE. The bucket holds upload originals: 55 venue photos weighing
 *    81.6 MB, the largest single cover 7.79 MB (listed on 2026-07-27). A card
 *    renders that cover 148pt tall. Asking for the original is spending
 *    megabytes of a guest's mobile data to fill a box the size of a business
 *    card. So a slot now asks for a resized copy of the photo and only falls
 *    back to the original if that copy is not there — see derivedPhotoUri.
 *
 * PREFETCHING WAS CONSIDERED AND DELIBERATELY NOT DONE — and the reason it was
 * rejected is the one that has now changed. It was rejected because prefetching
 * a screenful of 1.2 MB originals would spend tens of megabytes on photos the
 * guest may never scroll to. Once the backfill has run and a card is fetching
 * ~60 KB instead of ~1.2 MB, that objection no longer holds and prefetching
 * the next screenful should be revisited. It is deliberately NOT part of this
 * change: it is only worth doing when the derivatives actually exist in the
 * bucket, and it should be measured on its own rather than hidden inside a
 * change that already moves the numbers this much.
 */

/**
 * Memory + disk for every remote photo.
 *
 * Not `'disk'` (the library default — see above) and not `'memory'`, which
 * would re-download over the network after the app is killed, the one case
 * where the guest is most likely to be on a bad connection.
 */
export const PHOTO_CACHE_POLICY = "memory-disk" as const;

/** Cross-fade in milliseconds. Long enough not to flash, short enough that a
 * cached photo still feels instant. Matches the value the screens already used
 * before this became a shared constant. */
export const PHOTO_TRANSITION_MS = 150;

export type PhotoDisplay =
  | { kind: "image"; uri: string }
  /** `absent`: the venue/dish has no photo. `failed`: it had one and the load
   * failed. Both render the same thing — the distinction exists so a caller
   * can log or count them, not so it can draw two different boxes. */
  | { kind: "placeholder"; reason: "absent" | "failed" };

/**
 * The public root of the media bucket.
 *
 * A URL that does not start with this is not ours — a static map rendered by
 * our own API, a promo artwork still hosted on Supabase by the old web app, a
 * third-party placeholder — and must be used exactly as given. Deriving a
 * thumbnail address for a host that has never heard of our naming scheme would
 * turn a working photo into a guaranteed 404 plus a fallback round trip.
 */
export const PHOTO_BUCKET_BASE = "https://pub-41b6f06fc8e74b6e959cdd6def081e22.r2.dev/";

/**
 * How large the slot is on screen. Not pixels — the caller should not have to
 * know about device pixel ratios, only whether it is drawing a small tile or
 * something full-bleed.
 *
 *  - `tile`: thumbnails up to ~210pt wide — dish cards (180pt), promo banners
 *    (104pt), the popular-venue thumb (76pt).
 *  - `full`: anything spanning the screen — the venue card cover (full width
 *    × 148pt), the hero carousel, the gallery grid.
 *
 * `full` is the default on purpose. Getting it wrong towards `full` costs a
 * few KB; getting it wrong towards `tile` shows the guest a blurry photo, and
 * a reviewer cannot see that in a diff.
 */
export type PhotoSize = "tile" | "full";

/**
 * Pixel widths behind PhotoSize. They must match the generator in the backend
 * (`internal/media`, constants WidthSmall/WidthLarge) — the two are one
 * agreement written down twice, because the client constructs the address and
 * the server writes the object, and neither asks the other at runtime.
 *
 * Derived from what this app actually renders, times 3 (the device pixel ratio
 * of the phones in question): a 180pt dish card is 540 real pixels, so 640
 * covers every tile; the widest phone is ~430pt, so 1280 covers every
 * full-bleed slot.
 */
const WIDTH_FOR_SIZE: Record<PhotoSize, number> = { tile: 640, full: 1280 };

/**
 * The address of the resized copy of `uri`, or null when there is no such
 * thing to ask for.
 *
 * The rule is a pure string transform, and that is the whole design:
 *
 *     <base>/restaurants/<id>/1751414713631-va1ag209cl.jpg
 *   → <base>/derived/w640/restaurants/<id>/1751414713631-va1ag209cl.jpg.jpg
 *
 * WHY DERIVE INSTEAD OF READING A FIELD. The alternative is for the API to
 * return the thumbnail URLs alongside the original. That needs a column, a
 * migration, a backfill of rows as well as objects, and the OLD web app — which
 * still writes image_url today and knows nothing about any of this — taught to
 * fill it in, or every venue it touches silently loses its thumbnails. A pure
 * function needs none of that, costs no round trip, and a third size later is
 * a deploy instead of a data migration.
 *
 * The price is that this address can name an object that does not exist yet —
 * a photo uploaded after the last backfill run. That is why the fallback in
 * resolvePhotoDisplay is not optional: it is the other half of this decision.
 *
 * Returns null for a non-bucket URL and for anything already under `derived/`,
 * so a URL that has been through here once cannot be transformed again.
 */
export function derivedPhotoUri(uri: string, size: PhotoSize): string | null {
  if (!uri.startsWith(PHOTO_BUCKET_BASE)) return null;
  const key = uri.slice(PHOTO_BUCKET_BASE.length);
  if (!key || key.startsWith("derived/")) return null;
  // A query string is not part of the object key and must not end up inside a
  // bucket path.
  if (key.includes("?") || key.includes("#")) return null;
  return `${PHOTO_BUCKET_BASE}derived/w${WIDTH_FOR_SIZE[size]}/${key}.jpg`;
}

/**
 * The addresses to try for one photo, best first.
 *
 * Always ends with the original. That is the guarantee the whole scheme rests
 * on: a missing derivative costs one wasted request, never a hole in the card.
 */
export function photoCandidates(uri: string, size: PhotoSize): string[] {
  const derived = derivedPhotoUri(uri, size);
  return derived ? [derived, uri] : [uri];
}

/**
 * What a photo slot should render right now.
 *
 * `broken` lists the URIs that have already failed to load in THIS slot. It is
 * a list rather than a single value because there are now two addresses in
 * play: the resized derivative and the original behind it. With one remembered
 * failure the slot would fall back from the derivative to the original, and
 * then — on the original also failing — pick the derivative again, which is an
 * unbounded request loop over the guest's data. Remembering both is what makes
 * the chain terminate.
 *
 * Tracking failures by URI rather than by a counter is what makes a recycled
 * FlatList row behave: when the row is handed a different venue, its addresses
 * are not in the remembered list and get their fair chance to load.
 */
export function resolvePhotoDisplay(
  uri: string | null | undefined,
  broken: readonly string[],
  size: PhotoSize = "full",
): PhotoDisplay {
  const trimmed = uri?.trim();
  // A blank string is treated as no photo, not as a URL. It is what an empty
  // column looks like by the time it has been through JSON and a mapper, and
  // handing "" to an <Image> is a guaranteed silent failure.
  if (!trimmed) return { kind: "placeholder", reason: "absent" };

  const next = photoCandidates(trimmed, size).find((c) => !broken.includes(c));
  if (!next) return { kind: "placeholder", reason: "failed" };
  return { kind: "image", uri: next };
}
