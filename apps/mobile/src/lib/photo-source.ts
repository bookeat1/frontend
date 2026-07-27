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
 * PREFETCHING WAS CONSIDERED AND DELIBERATELY NOT DONE. `Image.prefetch` would
 * warm the cache for the venues just below the fold, and on a normal catalog
 * that would be worth it. On THIS catalog it is not: the 19 cover photos of
 * the test environment weigh 22.7 MB together — 1.2 MB on average, the largest
 * 7.8 MB (measured with curl on 2026-07-27) — because they are uploaded
 * originals with no resizing anywhere between the bucket and the phone. A card
 * shows them 148pt tall. Prefetching a list would mean spending tens of
 * megabytes of the guest's data on photos they may never scroll to, on exactly
 * the connection where that hurts most, and holding the decoded bitmaps in a
 * memory cache sized for thumbnails.
 *
 * The real fix is upstream, not here: serve a resized derivative (Cloudflare
 * Image Resizing over the same R2 bucket, or a thumbnail written at upload
 * time). Once a card can ask for a ~40 KB image instead of a 1.2 MB one,
 * prefetching the next screenful becomes cheap and should be revisited.
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
 * What a photo slot should render right now.
 *
 * `brokenUri` is the URI that has already failed to load in this slot (null
 * until one does). Comparing against the CURRENT uri rather than keeping a
 * boolean is what makes a recycled row behave: when the row is handed a
 * different venue, the new URI does not match the remembered broken one and
 * gets its fair chance to load. It is also what stops a retry loop — the same
 * URI is never re-attempted after it failed, because remounting an <Image> on
 * error and failing again is an unbounded request loop over the guest's data.
 */
export function resolvePhotoDisplay(
  uri: string | null | undefined,
  brokenUri: string | null,
): PhotoDisplay {
  const trimmed = uri?.trim();
  // A blank string is treated as no photo, not as a URL. It is what an empty
  // column looks like by the time it has been through JSON and a mapper, and
  // handing "" to an <Image> is a guaranteed silent failure.
  if (!trimmed) return { kind: "placeholder", reason: "absent" };
  if (trimmed === brokenUri) return { kind: "placeholder", reason: "failed" };
  return { kind: "image", uri: trimmed };
}
