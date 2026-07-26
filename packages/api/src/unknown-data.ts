/**
 * STUB DATA — fields the real backend does not provide (yet).
 *
 * Everything exported from this file is an assumption or a placeholder. It is
 * the ONE place HttpRestaurantRepository is allowed to reach for something the
 * API did not send. The rule for this file: nothing in it may reach a screen
 * looking like a fact about the world. A missing value is rendered as missing;
 * an assumption is either invisible or labelled.
 *
 * Confirmed absent from `backend-core` as of this writing (checked the DTOs
 * in internal/transport/rest/restaurants and internal/transport/rest/menu,
 * and internal/domain/restaurant.go + menu.go):
 *   - a "popular in menu" / highlighted flag on menu items: still absent. The
 *     strip does not invent dishes — it shows the venue's own first available
 *     dishes in the venue's own order (mapMenuHighlights in http-mapping.ts).
 *   - a tenge price *range* (only a price_category tier "₸"/"₸₸"/"₸₸₸" exists)
 *   - social links: DOES exist (social_links on the detail endpoint) — real
 *     data is used for that.
 *
 * Removed from this file (2026-07-26), because the app was showing them as
 * real data:
 *   - stubDistanceMeters() — a hash of the restaurant id rendered as "3.4 км"
 *     next to the address on the venue screen and on every search card. That
 *     is a claim about the physical world that nobody measured. A real
 *     distance needs the guest's location plus a real calculation (and there
 *     is no geo query in the API at all); until both exist, the app says
 *     nothing about distance. `distanceMeters` is gone from the types too, so
 *     it cannot quietly come back.
 *   - stubPopularSearches() / stubRecentSearches() — three hardcoded phrases
 *     ("Грузинская кухня", "Паназиатская кухня", "Веранда") presented under
 *     the heading «Популярные запросы». All three returned zero results
 *     against the live catalog (verified by curl 2026-07-26). The search
 *     screen now shows the real catalog when the query is empty, and there is
 *     no search-terms endpoint to replace them with.
 *
 * Fixed earlier, no longer stubbed here:
 *   - the map preview — GET /restaurants/:id/map is real (a server-rendered
 *     PNG, see static-map.ts); the placehold.co stub image is gone
 *   - promo banners — GET /restaurants/:id/promos is real (image-less, so the
 *     banner is caption-only)
 *   - rating / reviewsCount — GET /restaurants/:id/reviews/summary is real
 *     (venue screen only; the listing endpoint still carries no rating)
 */
import type { RestaurantTable } from "./types";

/**
 * STUB: there is no seating/table endpoint or field. Empty rather than
 * invented, and nothing renders it today.
 */
export function stubTables(): RestaurantTable[] {
  return [];
}

/**
 * ASSUMPTION, not a read fact: the API has no per-restaurant "bookable
 * online" flag. Every restaurant the catalog returns is active (deactivated
 * ones 404), so the venue screen offers the booking button to all of them.
 *
 * The catalog contains at least one venue where that assumption is wrong:
 * «Adept» has no tables in the system, so every slot it does return comes
 * back `available: false, reason: "capacity"` (verified 2026-07-26). The
 * booking screen therefore has to tell the guest the truth from the
 * availability answer itself — see SlotsSection in
 * app/restaurant/[id]/book/index.tsx. A real fix is a backend flag (or a
 * `bookable`/`has_tables` field on the restaurant payload) so the venue
 * screen can say it before the guest starts picking dates.
 */
export const ASSUMED_IS_BOOKABLE = true;
