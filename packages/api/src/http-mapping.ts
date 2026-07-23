/**
 * Backend DTO shapes and the mapping into the frontend's own types (see
 * ./types.ts). This is the single seam between "what backend-core sends over
 * the wire" and "what the UI reads" — screens never see the DTOs below.
 *
 * Shapes copied from backend-core (read, not guessed):
 *   internal/transport/rest/restaurants/response.go (restaurantResponse,
 *     imageResponse, featureResponse, socialResponse, categoryResponse)
 *   internal/transport/rest/response/response.go (Envelope, Page[T])
 */
import type { Cuisine, Photo, PriceLevel, Restaurant, RestaurantSummary, Weekday } from "./types";
import {
  ASSUMED_IS_BOOKABLE,
  STUB_RATING,
  STUB_REVIEWS_COUNT,
  stubDistanceMeters,
  stubMapImage,
  stubMenuHighlights,
  stubPromoBanners,
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
export interface ApiCategory {
  id: string;
  name: string;
  name_i18n?: Record<string, string>;
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

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

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
function parseOpeningHours(raw: string): { opensAt: string | null; closesAt: string | null } {
  const matches = raw.match(/\d{1,2}:\d{2}/g);
  if (!matches || matches.length < 2) {
    return { opensAt: null, closesAt: null };
  }
  return { opensAt: matches[0], closesAt: matches[matches.length - 1] };
}

function buildWorkingHours(raw: string) {
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
function computeIsOpenNow(raw: string): boolean {
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
function mapPriceLevel(priceCategory: string): PriceLevel {
  const tierCount = (priceCategory.match(/₸/g)?.length ?? priceCategory.trim().length) || 1;
  const clamped = Math.min(4, Math.max(1, tierCount));
  return (["$", "$$", "$$$", "$$$$"] as const)[clamped - 1];
}

function pickCoverPhoto(api: ApiRestaurant): Photo {
  const primary = api.images?.find((i) => i.is_primary) ?? api.images?.[0];
  const url = primary?.image_url ?? api.primary_image;
  return imageToPhoto(url, `${api.id}-cover`, api.name, undefined);
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

export interface CategoryLookup {
  byId: Map<string, Cuisine>;
}

function cuisineForRestaurant(api: ApiRestaurant, categories: CategoryLookup): Cuisine[] {
  if (api.category_id) {
    const cat = categories.byId.get(api.category_id);
    if (cat) return [cat];
  }
  // Fall back to the free-text cuisine_type when there's no matching category
  // (or no category assigned at all) so the chip isn't blank.
  if (api.cuisine_type) {
    return [{ id: `cuisine-type:${api.cuisine_type}`, name: api.cuisine_type }];
  }
  return [];
}

export function mapCategoryToCuisine(api: ApiCategory): Cuisine {
  return { id: api.id, name: api.name };
}

export function mapRestaurantSummary(api: ApiRestaurant, categories: CategoryLookup): RestaurantSummary {
  return {
    id: api.id,
    name: api.name,
    cuisines: cuisineForRestaurant(api, categories),
    priceLevel: mapPriceLevel(api.price_category),
    rating: STUB_RATING,
    reviewsCount: STUB_REVIEWS_COUNT,
    address: api.address,
    // STUB: no geolocation/distance in the API — see unknown-data.ts.
    distanceMeters: stubDistanceMeters(api.id),
    coverPhoto: pickCoverPhoto(api),
    isOpenNow: computeIsOpenNow(api.opening_hours),
  };
}

export function mapRestaurantDetail(api: ApiRestaurant, categories: CategoryLookup): Restaurant {
  const photos: Photo[] = (api.images ?? []).map((img) =>
    imageToPhoto(img.image_url, img.id, api.name, undefined),
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
    name: api.name,
    cuisines: cuisineForRestaurant(api, categories),
    priceLevel: mapPriceLevel(api.price_category),
    rating: STUB_RATING,
    reviewsCount: STUB_REVIEWS_COUNT,
    address: api.address,
    city: api.city,
    // STUB: no geolocation/distance in the API — see unknown-data.ts.
    distanceMeters: stubDistanceMeters(api.id),
    phone: api.phone || undefined,
    // Real data where the API has it; social_links IS present on the detail
    // endpoint (contrary to the owner's brief lumping it with the map image —
    // only the map preview image itself has no backing field).
    social,
    coverPhoto: pickCoverPhoto(api),
    photos: photos.length > 0 ? photos : [pickCoverPhoto(api)],
    // STUB: no static-map preview endpoint/field — see unknown-data.ts.
    mapImage: stubMapImage(api.id),
    // STUB: no promo-banner concept in the API — see unknown-data.ts.
    promoBanners: stubPromoBanners(api.id),
    // STUB: no "popular in menu" flag on menu items — see unknown-data.ts.
    menuHighlights: stubMenuHighlights(api.id),
    // Derived, best-effort — see parseOpeningHours/buildWorkingHours comments.
    workingHours: buildWorkingHours(api.opening_hours),
    // STUB: no seating/table data in the API — see unknown-data.ts.
    tables: stubTables(),
    description: api.description,
    isOpenNow: computeIsOpenNow(api.opening_hours),
    // ASSUMPTION: no per-restaurant bookable flag in the API; every
    // restaurant this endpoint returns is already active. See unknown-data.ts.
    isBookable: ASSUMED_IS_BOOKABLE,
  };
}
