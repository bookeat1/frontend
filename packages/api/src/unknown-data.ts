/**
 * STUB DATA — fields the real backend does not provide (yet).
 *
 * Everything exported from this file is fake. It exists only so the HTTP
 * repository can fill screens that were designed against the mock and expect
 * these fields to be present. None of it should ever be presented to a user
 * as if it came from the restaurant/menu — it is a placeholder until a
 * follow-up backend task adds the real fields.
 *
 * This is the ONE place HttpRestaurantRepository reaches for invented data.
 * If/when the backend grows these fields, delete the corresponding function
 * here and read the mapping in http-mapping.ts to wire in the real value —
 * everything that needs deleting is in this file, nowhere else.
 *
 * Confirmed absent from `backend-core` as of this writing (checked the DTOs
 * in internal/transport/rest/restaurants and internal/transport/rest/menu,
 * and internal/domain/restaurant.go + menu.go):
 *   - a "popular in menu" / highlighted flag on menu items: still absent, but
 *     the strip no longer invents dishes — it shows the venue's own first
 *     available dishes with a photo (see mapMenuHighlights in http-mapping.ts)
 *   - a tenge price *range* (only a price_category tier "₸"/"₸₸"/"₸₸₸" exists)
 *   - social links: DOES exist (social_links on the detail endpoint) — real
 *     data is used for that.
 *   - distance from the user to the restaurant (no geolocation in the API)
 *
 * Fixed since the first integration pass, no longer stubbed here:
 *   - the map preview — GET /restaurants/:id/map is real (a server-rendered
 *     PNG, see static-map.ts); the placehold.co stub image is gone
 *   - promo banners — GET /restaurants/:id/promos is real (image-less, so the
 *     banner is caption-only)
 *   - rating / reviewsCount — GET /restaurants/:id/reviews/summary is real
 *     (venue screen only; the listing endpoint still carries no rating)
 *
 * Also discovered while integrating (not in the owner's original list of 5,
 * flagged here for the same follow-up task): a structured table/seating list,
 * an explicit "is bookable" flag, and suggested/recent search terms. See the
 * comments on each stub below.
 */
import type { RestaurantTable } from "./types";

/**
 * STUB: the API has no geolocation-based distance calculation (and the
 * mobile app does not currently read the device's location either). A
 * deterministic pseudo-value is derived from the id so the UI doesn't jitter
 * between refetches, but it is NOT a real distance.
 */
export function stubDistanceMeters(restaurantId: string): number {
  let hash = 0;
  for (let i = 0; i < restaurantId.length; i++) {
    hash = (hash * 31 + restaurantId.charCodeAt(i)) >>> 0;
  }
  return 300 + (hash % 4700); // 300m..5000m, fake
}

/**
 * STUB: not in the owner's list of 5 — there is no seating/table endpoint or
 * field. Not currently rendered anywhere; kept empty rather than invented.
 */
export function stubTables(): RestaurantTable[] {
  return [];
}

/**
 * STUB: not in the owner's list of 5 — the API has no per-restaurant
 * "bookable online" flag. Every restaurant this endpoint returns is already
 * active (deactivated ones 404), so treating "active" as "bookable" is an
 * assumption, not a read fact — flagged here rather than asserted silently.
 */
export const ASSUMED_IS_BOOKABLE = true;

/**
 * STUB: not in the owner's list of 5 — there is no recent/popular search
 * terms endpoint in the API. Reusing static placeholder suggestions; these
 * are NOT derived from real user search history.
 */
export function stubRecentSearches(): string[] {
  return [];
}
export function stubPopularSearches(): string[] {
  return ["Грузинская кухня", "Паназиатская кухня", "Веранда"];
}
