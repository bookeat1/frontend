import { AdminApiError, type MyRestaurant } from "@bookeat/api/admin";

/**
 * Is the venue remembered in localStorage still one this person may open?
 *
 * The panel keeps the chosen venue in localStorage so it survives a reload,
 * and for a long time nothing checked that the remembered id still means
 * anything HERE. A person who had opened the test panel and then opened the
 * production one kept a venue id that exists on test only: every screen asked
 * the production API for it, got 404, and showed «проверьте соединение».
 *
 * So: a remembered venue is a CLAIM, and it is only worth trusting once
 * GET /admin/my-restaurants confirms it. Kept as pure functions so both the
 * layout gate and its tests can use them without a browser.
 */

export type VenueAccess =
  /** The venue list has not arrived yet — we do not know either way. */
  | "checking"
  /** The remembered venue is in the caller's list: safe to open screens. */
  | "granted"
  /** The list arrived and the venue is not in it: drop the selection. */
  | "revoked";

export function venueAccess(
  venueId: string | null | undefined,
  venues: readonly MyRestaurant[] | undefined,
): VenueAccess {
  if (!venueId) return "granted"; // nothing remembered, nothing to verify
  if (!venues) return "checking";
  return venues.some((v) => v.id === venueId) ? "granted" : "revoked";
}

/**
 * A failure that means "this venue is not yours / does not exist here" rather
 * than "the network is bad". 404 is the venue missing from THIS database, 403
 * is a membership that was taken away — both are answered by picking another
 * venue, never by a retry button.
 *
 * Note what is NO LONGER in this bucket: a venue merely hidden from the catalog
 * (`is_active = false`). The cabinet reads venues through
 * `GET /admin/restaurants/:id` now, which serves hidden venues too — so a 404
 * really does mean "not here", not "deactivated".
 */
export function isVenueUnavailableError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 404 || error.status === 403);
}

/**
 * Every venue-level query key is scoped by the venue id (see conventions:
 * ["restaurant-pricing", id], ["restaurant-social-links", id], …), so a failed
 * query that carries the current id is a failure ABOUT that venue. Used to
 * re-verify the selection when a venue disappears mid-shift instead of leaving
 * the panel repeating a request that can only 404.
 */
export function isVenueScopedKey(queryKey: readonly unknown[], venueId: string): boolean {
  return queryKey.some((part) => part === venueId);
}
