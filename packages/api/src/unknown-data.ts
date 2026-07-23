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
 *   - promo banners for a restaurant
 *   - a "popular in menu" / highlighted flag on menu items
 *   - a tenge price *range* (only a price_category tier "₸"/"₸₸"/"₸₸₸" exists)
 *   - social links: DOES exist (social_links on the detail endpoint) — real
 *     data is used for that; only the map preview *image* is stubbed here.
 *   - distance from the user to the restaurant (no geolocation in the API)
 *
 * Also discovered while integrating (not in the owner's original list of 5,
 * flagged here for the same follow-up task): rating, reviewsCount, a
 * structured table/seating list, an explicit "is bookable" flag, and
 * suggested/recent search terms. See the comments on each stub below.
 */
import type { MenuHighlight, Photo, PromoBanner, RestaurantTable } from "./types";

function stubPhoto(seed: string, alt: string): Photo {
  // Width/height are not returned by the API for real images either (only
  // image_url + is_primary) and are not consumed by any current screen's
  // layout (fixed-size containers), so this placeholder pair is harmless.
  // Reuses the same bundled fixture photos as the mock so the fake sections
  // are visually obvious/consistent rather than broken image links.
  void seed;
  return {
    id: `stub-${seed}`,
    uri: "https://placehold.co/800x600?text=Stub",
    width: 800,
    height: 600,
    alt,
  };
}

/** STUB: no promo-banner concept exists in the API. */
export function stubPromoBanners(restaurantId: string): PromoBanner[] {
  return [
    { id: `${restaurantId}-stub-banner-1`, title: "[заглушка] Акция дня", photo: stubPhoto(`${restaurantId}-b1`, "Заглушка баннера") },
    { id: `${restaurantId}-stub-banner-2`, title: "[заглушка] Спецпредложение", photo: stubPhoto(`${restaurantId}-b2`, "Заглушка баннера") },
  ];
}

/** STUB: menu items have no "popular"/highlight flag in the API. */
export function stubMenuHighlights(restaurantId: string): MenuHighlight[] {
  return [
    {
      id: `${restaurantId}-stub-menu-1`,
      name: "[заглушка] Блюдо недоступно из API",
      description: "В API нет признака «популярное блюдо» — раздел временно фиктивный",
      price: "— ₸",
      photo: stubPhoto(`${restaurantId}-m1`, "Заглушка блюда"),
    },
  ];
}

/** STUB: no static-map image endpoint/field exists in the API. */
export function stubMapImage(restaurantId: string): Photo {
  return stubPhoto(`${restaurantId}-map`, "Заглушка карты — в API нет превью карты");
}

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
 * STUB: not in the owner's list of 5, discovered during integration —
 * rating/reviewsCount have no backing column/table in the API response.
 * Not currently rendered by any screen, so defaulting to 0 is low-risk, but
 * flagged the same way in case a screen starts reading it later.
 */
export const STUB_RATING = 0;
export const STUB_REVIEWS_COUNT = 0;

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
