/**
 * Backend DTO shapes and the mapping into the frontend's own types (see
 * ./types.ts). This is the single seam between "what backend-core sends over
 * the wire" and "what the UI reads" — screens never see the DTOs below.
 *
 * Shapes copied from backend-core (read, not guessed):
 *   internal/transport/rest/restaurants/response.go (restaurantResponse,
 *     imageResponse, featureResponse, socialResponse, categoryResponse)
 *   internal/transport/rest/menu/response.go (menuItemResponse)
 *   internal/transport/rest/promos/handler.go (promoResponse)
 *   internal/transport/rest/reviews/handler.go (summaryResponse)
 *   internal/transport/rest/response/response.go (Envelope, Page[T])
 *
 * Every field read below is treated as possibly absent even when the Go
 * struct always emits it: one missing key in a payload must degrade a section
 * of a screen, never throw inside a mapper and blank the whole screen.
 */
import type {
  Cuisine,
  MenuHighlight,
  Photo,
  PriceLevel,
  PromoBanner,
  Restaurant,
  RestaurantSummary,
  Weekday,
} from "./types";
import {
  ASSUMED_IS_BOOKABLE,
  stubDistanceMeters,
  stubMapImage,
  stubTables,
} from "./unknown-data";

export interface ApiImage {
  id: string;
  image_url: string;
  is_primary: boolean;
}
export interface ApiFeature {
  id: string;
  name: string;
  name_i18n?: Record<string, string>;
}
export interface ApiSocialLink {
  id: string;
  type: string; // "website" | "whatsapp" | "instagram" | ... (free string server-side)
  url: string;
}

/** restaurantResponse — shared by list items and the detail/aggregate read.
 * List items never populate images/features/tags/social_links (only
 * `primary_image`); only GET /restaurants/:id populates them. */
export interface ApiRestaurant {
  id: string;
  category_id: string | null;
  name: string;
  name_i18n?: Record<string, string>;
  description: string;
  cuisine_type: string;
  address: string;
  opening_hours: string;
  city: string;
  price_category: string;
  email: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  is_new: boolean | null;
  is_popular: boolean | null;
  is_premium: boolean | null;
  display_order: number | null;
  primary_image?: string;
  images?: ApiImage[];
  features?: ApiFeature[];
  social_links?: ApiSocialLink[];
}

/** menuItemResponse — GET /restaurants/:id/menu returns a bare array of these
 * (no Page envelope, unlike the catalog). `price` is a decimal STRING
 * ("5500.00"), image_url/category/portion_size are nullable. */
export interface ApiMenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: string;
  image_url: string | null;
  is_available: boolean;
  category: string | null;
  display_order: number | null;
}

/** promoResponse — GET /restaurants/:id/promos, wrapped in a Page. Note there
 * is NO image field on a promo anywhere in the backend. */
export interface ApiPromo {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

/** summaryResponse — GET /restaurants/:id/reviews/summary. */
export interface ApiReviewSummary {
  restaurant_id: string;
  average: number;
  count: number;
}

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** How many dishes the "Популярное в меню" strip shows. The menu endpoint has
 * no limit parameter and a real venue returns ~300 items, so the cut happens
 * client-side. */
export const MENU_HIGHLIGHT_LIMIT = 8;

/** Reads a possibly-absent string field without throwing on null/undefined. */
function text(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * `opening_hours` on the backend is a single free-text field (e.g.
 * "10:00-23:00"), not a per-weekday schedule — the domain model
 * (internal/domain/restaurant.go) has no day-of-week structure at all. We
 * best-effort parse the first "HH:MM" and last "HH:MM" found in the string
 * and apply that single range to every day of the week. This is a real,
 * derived value (not fabricated numbers) but it is an approximation: a
 * restaurant with different weekend hours will show the wrong hours on that
 * day. Flagged here rather than silently assumed correct.
 */
function parseOpeningHours(raw: string | null | undefined): {
  opensAt: string | null;
  closesAt: string | null;
} {
  const matches = text(raw).match(/\d{1,2}:\d{2}/g);
  if (!matches || matches.length < 2) {
    return { opensAt: null, closesAt: null };
  }
  return { opensAt: matches[0], closesAt: matches[matches.length - 1] };
}

function buildWorkingHours(raw: string | null | undefined) {
  const { opensAt, closesAt } = parseOpeningHours(raw);
  return WEEKDAYS.map((weekday) => ({ weekday, opensAt, closesAt }));
}

/**
 * There's no `is_open_now` field from the API. We derive it from the same
 * best-effort parsed hours + the device's current time, wrapping past
 * midnight (e.g. "18:00"-"02:00"). If the hours string didn't parse, this
 * falls back to `true` (open) rather than guessing closed, and that fallback
 * is intentional: it's better to show a bookable restaurant than to hide one
 * behind a wrong "closed" guess.
 */
function computeIsOpenNow(raw: string | null | undefined): boolean {
  const { opensAt, closesAt } = parseOpeningHours(raw);
  if (!opensAt || !closesAt) return true;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const open = toMinutes(opensAt);
  const close = toMinutes(closesAt);
  if (close === open) return true; // "24 hours"-ish, unparseable edge case
  if (close > open) return nowMinutes >= open && nowMinutes < close;
  // Wraps past midnight, e.g. 18:00 -> 02:00.
  return nowMinutes >= open || nowMinutes < close;
}

/**
 * `price_category` arrives as a level string ("₸" / "₸₸" / "₸₸₸"), per the
 * owner's brief — shown as-is, no invented tenge range. The UI's chip
 * component only ever renders whatever string PriceLevel holds; we re-express
 * the tier count using the same "$" vocabulary the mock already used (a
 * design placeholder, not a currency), rather than widening the PriceLevel
 * type across the whole app for this integration. The *number* of tiers is
 * the real value read from the API; only the glyph is translated.
 */
const PRICE_LEVELS = ["$", "$$", "$$$", "$$$$"] as const;

function mapPriceLevel(priceCategory: string | null | undefined): PriceLevel {
  const raw = text(priceCategory);
  const tierCount = (raw.match(/₸/g)?.length ?? raw.trim().length) || 1;
  const clamped = Math.min(4, Math.max(1, tierCount));
  return PRICE_LEVELS[clamped - 1];
}

/** Inverse of mapPriceLevel, for pushing the price filter back to the API:
 * the server compares `price_category` for equality against the tenge tier
 * string it stores ("₸" / "₸₸" / "₸₸₸"). */
export function priceLevelToPriceCategory(level: PriceLevel): string {
  return "₸".repeat(level.length);
}

function pickCoverPhoto(api: ApiRestaurant): Photo {
  const primary = api.images?.find((i) => i.is_primary) ?? api.images?.[0];
  const url = primary?.image_url ?? api.primary_image;
  return imageToPhoto(url, `${api.id}-cover`, text(api.name), undefined);
}

/** Real images carry no food/interior tag (unlike the mock fixtures), so
 * `category` is left undefined — the Photos screen's "Еда"/"Интерьер" tabs
 * will show nothing for real restaurants until the API adds that. The "Все"
 * tab is unaffected since it doesn't filter by category. */
function imageToPhoto(url: string | undefined, id: string, alt: string, category: Photo["category"]): Photo {
  return {
    id,
    uri: url ?? "https://placehold.co/800x600?text=No+Image",
    width: 800,
    height: 600,
    alt,
    category,
  };
}

/**
 * The cuisine dimension the catalog actually filters on is the free-text
 * `cuisine_type` column, NOT `restaurant_categories`: on the live catalog
 * every restaurant has `category_id: null` and GET /restaurant-categories
 * returns an empty list, while GET /restaurants/search?cuisine=… matches
 * `r.cuisine_type = ANY(...)` (postgres/restaurant/repository.go). So a
 * Cuisine's id is the case-folded cuisine_type — case-folded because the data
 * really does contain both "Европейская" and "европейская" and they must
 * collapse into one chip. The exact spellings behind a chip are kept by the
 * repository (see cuisineCatalog in http-repository.ts) because the server's
 * comparison is case-sensitive.
 */
export function cuisineIdFor(cuisineType: string): string {
  return cuisineType.trim().toLocaleLowerCase("ru-RU");
}

function cuisineForRestaurant(api: ApiRestaurant): Cuisine[] {
  const name = text(api.cuisine_type).trim();
  if (!name) return [];
  return [{ id: cuisineIdFor(name), name }];
}

/** Price string from the menu API is a decimal ("5500.00"); the design shows
 * a grouped tenge amount. Formatted by hand rather than with Intl so the
 * output is identical on every Hermes build (RN's Intl support varies with
 * the engine's ICU). A price we can't parse is passed through as-is. */
function formatMenuPrice(raw: string | null | undefined): string {
  const value = Number(text(raw));
  if (!Number.isFinite(value)) return text(raw);
  const whole = Math.round(value).toString();
  // Non-breaking space between groups so the price never wraps mid-number.
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

/**
 * The API has no "popular dish" flag (see unknown-data.ts for what that
 * costs us), so the highlights strip shows the venue's own first available
 * dishes THAT HAVE A PHOTO — the card is photo-first and a placeholder tile
 * would look broken. Ordering follows display_order, i.e. the venue's own
 * menu order, so this is real data in a real order, just not "popular".
 */
export function mapMenuHighlights(items: ApiMenuItem[] | null | undefined, limit: number): MenuHighlight[] {
  return (items ?? [])
    .filter((item) => item.is_available && text(item.image_url).length > 0)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: text(item.name),
      description: text(item.description),
      price: formatMenuPrice(item.price),
      photo: imageToPhoto(text(item.image_url), item.id, text(item.name), "food"),
    }));
}

/** Promos carry no image server-side, so the banner is caption-only. */
export function mapPromoBanners(promos: ApiPromo[] | null | undefined): PromoBanner[] {
  return (promos ?? []).map((promo) => ({ id: promo.id, title: text(promo.title) }));
}

/** Everything the venue screen needs that lives behind its own endpoint.
 * Each is optional: a failed side-request degrades one section, it must not
 * fail the venue screen (see HttpRestaurantRepository.getRestaurant). */
export interface RestaurantExtras {
  reviews?: ApiReviewSummary;
  menu?: ApiMenuItem[];
  promos?: ApiPromo[];
}

export function mapRestaurantSummary(api: ApiRestaurant): RestaurantSummary {
  return {
    id: api.id,
    name: text(api.name),
    cuisines: cuisineForRestaurant(api),
    priceLevel: mapPriceLevel(api.price_category),
    // The listing endpoint carries no rating; fetching a per-venue summary
    // for every card would be an N+1 on the search screen. Real ratings are
    // read on the venue screen only — see getRestaurant.
    rating: 0,
    reviewsCount: 0,
    address: text(api.address),
    // STUB: no geolocation/distance in the API — see unknown-data.ts.
    distanceMeters: stubDistanceMeters(api.id),
    coverPhoto: pickCoverPhoto(api),
    isOpenNow: computeIsOpenNow(api.opening_hours),
  };
}

export function mapRestaurantDetail(api: ApiRestaurant, extras: RestaurantExtras = {}): Restaurant {
  const photos: Photo[] = (api.images ?? []).map((img) =>
    imageToPhoto(img.image_url, img.id, text(api.name), undefined),
  );
  const social = api.social_links?.length
    ? {
        website: api.social_links.find((s) => s.type === "website")?.url,
        whatsapp: api.social_links.find((s) => s.type === "whatsapp")?.url,
        instagram: api.social_links.find((s) => s.type === "instagram")?.url,
      }
    : undefined;

  return {
    id: api.id,
    name: text(api.name),
    cuisines: cuisineForRestaurant(api),
    priceLevel: mapPriceLevel(api.price_category),
    // Real, from GET /restaurants/:id/reviews/summary. 0/0 when the summary
    // request failed or the venue has no published reviews yet — the screen
    // hides the rating entirely at reviewsCount === 0 rather than showing a
    // "0.0" that reads like a bad venue.
    rating: extras.reviews?.average ?? 0,
    reviewsCount: extras.reviews?.count ?? 0,
    address: text(api.address),
    city: text(api.city),
    // STUB: no geolocation/distance in the API — see unknown-data.ts.
    distanceMeters: stubDistanceMeters(api.id),
    phone: text(api.phone) || undefined,
    // Real data where the API has it; social_links IS present on the detail
    // endpoint (contrary to the owner's brief lumping it with the map image —
    // only the map preview image itself has no backing field).
    social,
    coverPhoto: pickCoverPhoto(api),
    // Left empty when the venue has no images: the gallery screen shows its
    // own empty state, which is honest, unlike a grid of one placeholder.
    photos,
    // STUB: no static-map preview endpoint/field — see unknown-data.ts.
    mapImage: stubMapImage(api.id),
    // Real, from GET /restaurants/:id/promos (published promos only).
    promoBanners: mapPromoBanners(extras.promos),
    // Real dishes from GET /restaurants/:id/menu — see mapMenuHighlights for
    // why "popular" is really "first available with a photo".
    menuHighlights: mapMenuHighlights(extras.menu, MENU_HIGHLIGHT_LIMIT),
    // Derived, best-effort — see parseOpeningHours/buildWorkingHours comments.
    workingHours: buildWorkingHours(api.opening_hours),
    // STUB: no seating/table data in the API — see unknown-data.ts.
    tables: stubTables(),
    description: text(api.description),
    isOpenNow: computeIsOpenNow(api.opening_hours),
    // ASSUMPTION: no per-restaurant bookable flag in the API; every
    // restaurant this endpoint returns is already active. See unknown-data.ts.
    isBookable: ASSUMED_IS_BOOKABLE,
  };
}
