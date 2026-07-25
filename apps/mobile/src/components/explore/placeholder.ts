/**
 * PLACEHOLDER DATA FOR THE EXPLORE SCREEN — nothing here comes from the API.
 *
 * Every block below exists because backend-core has NO endpoint the guest app
 * can call for it today. The components that render this data are real and
 * final; only the source is fake, and it is fake in exactly one place (this
 * file) so switching a section to a real query is a one-line change in
 * `use-explore-data.ts` — never edit a component to hard-code content.
 *
 * Missing endpoints, one per section (checked against `packages/api/src/
 * repository.ts` — the guest-facing contract — and the backend conventions in
 * team-memory as of 2026-07-25):
 *
 *   heroBanners      — GET /promo-banners (platform-wide merchandising banners
 *                      for the home screen). The venue-scoped
 *                      GET /restaurants/:id/promos DOES exist but is a
 *                      different thing (one venue, no image field at all).
 *                      The backend branch `feat/promo-feed` (migration 0050)
 *                      is building a platform feed — when it ships, this is
 *                      the first block to replace.
 *   chefsPicks       — GET /menu-items/featured (cross-venue "chef's picks").
 *                      Menu items exist per venue (GET /restaurants/:id/menu)
 *                      but carry no featured/popular flag, and there is no
 *                      cross-venue dish endpoint.
 *   gastroguide      — GET /gastroguide (editorial picks). No such entity in
 *                      the backend at all — not even an admin-side one.
 *   events           — GET /events (platform-wide). Events EXIST server-side
 *                      (admin CRUD + per-venue listings, PR #27), but the
 *                      guest catalog has no cross-venue events route and
 *                      `RestaurantRepository` has no method for it.
 *   favourites       — WIRED UP. GET /favorites + PUT/DELETE
 *                      /favorites/:restaurantId are real and the venue cards'
 *                      heart now uses them (see useFavorites +
 *                      FavoriteButton). The dish and event cards keep an INERT
 *                      heart, because the entity under them is still a
 *                      placeholder and there is nothing to favorite.
 *
 * Photos are placehold.co URLs on purpose, matching the convention already
 * used by `packages/api/src/unknown-data.ts`: a stub must LOOK like a stub, so
 * nobody demos this screen believing the content is real.
 */

export interface HeroBanner {
  id: string;
  /** Alt text — the reference banners carry no caption, just the photo. */
  alt: string;
  imageUrl: string;
}

export interface DishCardData {
  id: string;
  name: string;
  description: string;
  /** Pre-formatted display price, same convention as `MenuHighlight.price`. */
  price: string;
  imageUrl: string;
  /** Venue the dish belongs to, so the card can open its restaurant screen
   * once a real endpoint returns one. Null while placeholder. */
  restaurantId: string | null;
}

export interface EventCardData {
  id: string;
  title: string;
  /** Pre-formatted, e.g. "16 мая · 13:00". */
  whenLabel: string;
  tags: string[];
  imageUrl: string;
  restaurantId: string | null;
}

const stubPhoto = (label: string) =>
  `https://placehold.co/600x400?text=${encodeURIComponent(label)}`;

/** MISSING ENDPOINT: GET /promo-banners */
export const PLACEHOLDER_HERO_BANNERS: HeroBanner[] = [
  { id: "hero-1", alt: "Заглушка баннера 1", imageUrl: stubPhoto("Banner 1") },
  { id: "hero-2", alt: "Заглушка баннера 2", imageUrl: stubPhoto("Banner 2") },
  { id: "hero-3", alt: "Заглушка баннера 3", imageUrl: stubPhoto("Banner 3") },
  { id: "hero-4", alt: "Заглушка баннера 4", imageUrl: stubPhoto("Banner 4") },
];

/** MISSING ENDPOINT: GET /menu-items/featured */
export const PLACEHOLDER_CHEFS_PICKS: DishCardData[] = [
  {
    id: "pick-1",
    name: "Карбонара",
    description: "Спагетти, сливочный соус, морепродукты, сырой желток",
    price: "4 590 ₸",
    imageUrl: stubPhoto("Dish 1"),
    restaurantId: null,
  },
  {
    id: "pick-2",
    name: "Павлова с ягодами",
    description: "Меренга, крем-чиз, сезонные ягоды",
    price: "3 290 ₸",
    imageUrl: stubPhoto("Dish 2"),
    restaurantId: null,
  },
  {
    id: "pick-3",
    name: "Стейк рибай",
    description: "Мраморная говядина, спаржа, соус демиглас",
    price: "12 900 ₸",
    imageUrl: stubPhoto("Dish 3"),
    restaurantId: null,
  },
];

/** MISSING ENDPOINT: GET /gastroguide */
export const PLACEHOLDER_GASTROGUIDE: DishCardData[] = [
  {
    id: "guide-1",
    name: "Бешбармак по-домашнему",
    description: "Тесто ручной раскатки, конина, лук-соус",
    price: "5 400 ₸",
    imageUrl: stubPhoto("Guide 1"),
    restaurantId: null,
  },
  {
    id: "guide-2",
    name: "Том ям с креветками",
    description: "Кокосовое молоко, лемонграсс, тигровые креветки",
    price: "4 900 ₸",
    imageUrl: stubPhoto("Guide 2"),
    restaurantId: null,
  },
  {
    id: "guide-3",
    name: "Хачапури по-аджарски",
    description: "Сулугуни, сливочное масло, желток",
    price: "3 700 ₸",
    imageUrl: stubPhoto("Guide 3"),
    restaurantId: null,
  },
];

/** MISSING ENDPOINT: GET /events (cross-venue guest listing) */
export const PLACEHOLDER_EVENTS: EventCardData[] = [
  {
    id: "event-1",
    title: "BBQ Brunch",
    whenLabel: "16 мая · 13:00",
    tags: ["Бранч", "Спецсобытие"],
    imageUrl: stubPhoto("Event 1"),
    restaurantId: null,
  },
  {
    id: "event-2",
    title: "Cocktail Wednesday",
    whenLabel: "Каждую среду · 19:00",
    tags: ["Коктейли", "Живая музыка"],
    imageUrl: stubPhoto("Event 2"),
    restaurantId: null,
  },
  {
    id: "event-3",
    title: "Ужин с шефом",
    whenLabel: "24 мая · 19:30",
    tags: ["Сет-меню", "Спецсобытие"],
    imageUrl: stubPhoto("Event 3"),
    restaurantId: null,
  },
];
