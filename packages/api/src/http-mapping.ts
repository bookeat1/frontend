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
  AuthSession,
  AuthUser,
  Booking,
  BookingPayment,
  BookingStatus,
  Cuisine,
  DayAvailability,
  EventSummary,
  MenuHighlight,
  MenuSection,
  PaymentPurpose,
  PaymentStatus,
  Photo,
  Preorder,
  PriceLevel,
  PromoBanner,
  Restaurant,
  RestaurantSummary,
  SlotUnavailableReason,
  Weekday,
} from "./types";
import { ASSUMED_IS_BOOKABLE, stubTables } from "./unknown-data";

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

/**
 * Reads a possibly-absent string field without throwing on null/undefined,
 * and trims it.
 *
 * The trim is not cosmetic: the live catalog really does contain
 * `" Chaihana Palau  "` and `"Koktobe Terrace  "` (verified 2026-07-26). Until
 * now one screen trimmed the name by hand and another did not, so the same
 * venue sat a few pixels apart on two screens and sorted differently. The
 * cleanup belongs here, in the single seam between the wire and the UI — not
 * in each screen, and not in the database from a phone.
 */
function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Venue descriptions come from the old CMS and are HTML, not plain text: live
 * data contains `<p><span style="color: rgb(84,84,84);">…&nbsp;…`. React Native
 * has no HTML renderer, so a <Text> would show the tags and entities to the
 * guest verbatim. Strip the markup here, in the mapping layer, so no screen has
 * to know the field was ever HTML.
 */
function plainText(value: string | null | undefined): string {
  const raw = text(value);
  if (!raw.includes("<") && !raw.includes("&")) return raw;
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&laquo;": "«",
    "&raquo;": "»",
    "&mdash;": "—",
    "&ndash;": "–",
  };
  return raw
    // Block-level tags become a line break, everything else just disappears —
    // otherwise paragraphs would run together into one wall of text.
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => entities[m.toLowerCase()] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
 * `price_category` arrives as a level string ("₸" / "₸₸" / "₸₸₸") and is kept
 * in exactly that alphabet — no invented tenge range, and no dollars. The
 * previous mapping re-expressed the tier count as "$"/"$$"/"$$$", which put a
 * currency that does not exist in this product on every card and every price
 * filter chip while the backend and the admin panel spoke tenge.
 */
const PRICE_LEVELS = ["₸", "₸₸", "₸₸₸", "₸₸₸₸"] as const;

function mapPriceLevel(priceCategory: string | null | undefined): PriceLevel {
  const raw = text(priceCategory);
  const tierCount = (raw.match(/₸/g)?.length ?? raw.trim().length) || 1;
  const clamped = Math.min(4, Math.max(1, tierCount));
  return PRICE_LEVELS[clamped - 1];
}

/** Inverse of mapPriceLevel, for pushing the price filter back to the API.
 * Now an identity: the UI holds the same tenge tier string the server compares
 * `price_category` against. Kept as a named function so the call site still
 * says which direction it is going, and so a future divergence has one place
 * to live. */
export function priceLevelToPriceCategory(level: PriceLevel): string {
  return level;
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
  const source = text(raw).trim();
  // Number("") is 0, which would price a dish the backend never priced at "0 ₸".
  // An absent price is unknown, not free.
  if (source === "") return "";
  const value = Number(source);
  if (!Number.isFinite(value)) return source;
  const whole = Math.round(value).toString();
  // Non-breaking space between groups so the price never wraps mid-number.
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

/**
 * The API has no "popular dish" flag (see unknown-data.ts for what that
 * costs us), so the strip shows the venue's own first available dishes in the
 * venue's own `display_order` — real data in a real order, just not "popular".
 *
 * A photo is NOT a condition for showing a dish. It used to be, and on this
 * catalog that emptied the strip for every single venue: not one dish in the
 * database has an `image_url` (checked 2026-07-26 — Abay 200 dishes, Chaihana
 * 69, Koktobe 84, zero photos between them). Name, description and price are
 * real; the photo is simply missing, and the card draws a deliberate
 * photo-less tile for it.
 */
export function mapMenuHighlights(items: ApiMenuItem[] | null | undefined, limit: number): MenuHighlight[] {
  return (items ?? [])
    .filter((item) => item.is_available)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .slice(0, limit)
    .map((item) => {
      const imageUrl = text(item.image_url);
      return {
        id: item.id,
        name: text(item.name),
        description: plainText(item.description),
        price: formatMenuPrice(item.price),
        // Undefined, not a placehold.co tile: "we have no photo" is a fact the
        // card can render honestly, a stub image is a picture of nothing.
        photo: imageUrl
          ? imageToPhoto(imageUrl, item.id, text(item.name), "food")
          : undefined,
      };
    });
}

/** Promos carry no image server-side, so the banner is caption-only. */
export function mapPromoBanners(promos: ApiPromo[] | null | undefined): PromoBanner[] {
  return (promos ?? []).map((promo) => ({ id: promo.id, title: text(promo.title) }));
}

/* ------------------------------------------------------------------------ *
 * Reservation flow DTOs
 *
 * Shapes read from backend-core, not guessed:
 *   internal/transport/rest/bookings/response.go
 *     (slotResponse, availabilityResponse, bookingResponse,
 *      bookingDetailsResponse)
 *   internal/transport/rest/preorder/dto.go (preorderResponse, itemResponse)
 *   internal/transport/rest/auth/response.go (tokenPairResponse)
 *   internal/transport/rest/users/… (the /users/me payload)
 * ------------------------------------------------------------------------ */

export interface ApiSlot {
  starts_at: string;
  ends_at: string;
  available: boolean;
  free_tables: number;
  /** Omitted (`omitempty`) when the slot IS available. */
  reason?: string;
}

export interface ApiAvailability {
  restaurant_id: string;
  date: string;
  timezone: string;
  guests: number;
  duration_minutes: number;
  slots: ApiSlot[];
}

export interface ApiBooking {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  guests: number;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  /** Only on the detail/create payload (bookingDetailsResponse), not on the
   * plain list rows. */
  free_cancel_deadline?: string | null;
}

/** paymentResponse — internal/transport/rest/payments/response.go. Only the
 * fields the guest UI is allowed to reason about are declared. */
export interface ApiPayment {
  id: string;
  booking_id: string;
  purpose: string;
  status: string;
  amount_minor: number;
  currency: string;
}

const PAYMENT_STATUSES: PaymentStatus[] = [
  "created",
  "authorized",
  "capturing",
  "captured",
  "voiding",
  "voided",
  "partially_refunded",
  "refunded",
  "failed",
  "expired",
];

const PAYMENT_PURPOSES: PaymentPurpose[] = ["deposit", "preorder", "ticket"];

/** An unrecognised status maps to "created" — the state that grants the guest
 * no claim about money either way. Guessing "voided"/"refunded" would tell
 * them their deposit is safe when we don't know it. */
export function mapPayment(api: ApiPayment): BookingPayment {
  const status = text(api.status).trim();
  const purpose = text(api.purpose).trim();
  return {
    id: text(api.id),
    bookingId: text(api.booking_id),
    purpose: PAYMENT_PURPOSES.find((p) => p === purpose) ?? "deposit",
    status: PAYMENT_STATUSES.find((s) => s === status) ?? "created",
    amountMinor: typeof api.amount_minor === "number" ? api.amount_minor : 0,
    currency: text(api.currency) || "KZT",
  };
}

export interface ApiPreorderItem {
  id: string;
  menu_item_id: string | null;
  name: string;
  price_minor: number;
  quantity: number;
  total_minor: number;
  status: string;
  comment: string | null;
}

export interface ApiPreorder {
  booking_id: string;
  items: ApiPreorderItem[];
  total_minor: number;
  currency: string;
}

export interface ApiTokenPair {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
}

const SLOT_REASONS: SlotUnavailableReason[] = [
  "too_soon",
  "beyond_horizon",
  "occupied",
  "capacity",
];

/** An unavailable slot ALWAYS gets a reason the UI can put a sentence to: a
 * value the backend grows later collapses to "unknown" rather than leaving
 * the guest with a greyed-out button and no explanation. */
function mapSlotReason(available: boolean, raw: string | null | undefined): SlotUnavailableReason | null {
  if (available) return null;
  const value = text(raw).trim();
  return SLOT_REASONS.find((r) => r === value) ?? "unknown";
}

export function mapAvailability(api: ApiAvailability): DayAvailability {
  return {
    restaurantId: text(api.restaurant_id),
    date: text(api.date),
    timezone: text(api.timezone) || "Asia/Almaty",
    guests: typeof api.guests === "number" ? api.guests : 0,
    durationMinutes: typeof api.duration_minutes === "number" ? api.duration_minutes : 0,
    slots: (api.slots ?? []).map((slot) => ({
      startsAt: text(slot.starts_at),
      endsAt: text(slot.ends_at),
      available: slot.available === true,
      freeTables: typeof slot.free_tables === "number" ? slot.free_tables : 0,
      reason: mapSlotReason(slot.available === true, slot.reason),
    })),
  };
}

const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "waitlist",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
];

/** An unrecognised status is reported as "pending" — the neutral "we have it,
 * the venue hasn't answered yet" state. Guessing "confirmed" would tell the
 * guest a table is held when we do not know that. */
function mapBookingStatus(raw: string | null | undefined): BookingStatus {
  const value = text(raw).trim();
  return BOOKING_STATUSES.find((s) => s === value) ?? "pending";
}

export function mapBooking(api: ApiBooking): Booking {
  return {
    id: text(api.id),
    restaurantId: text(api.restaurant_id),
    name: text(api.name),
    phone: text(api.phone),
    guests: typeof api.guests === "number" ? api.guests : 0,
    startsAt: text(api.starts_at),
    endsAt: text(api.ends_at),
    status: mapBookingStatus(api.status),
    notes: text(api.notes) || null,
    freeCancelDeadline: text(api.free_cancel_deadline) || null,
  };
}

export function mapPreorder(api: ApiPreorder): Preorder {
  return {
    bookingId: text(api.booking_id),
    items: (api.items ?? []).map((item) => ({
      id: text(item.id),
      menuItemId: text(item.menu_item_id) || null,
      name: text(item.name),
      priceMinor: typeof item.price_minor === "number" ? item.price_minor : 0,
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      totalMinor: typeof item.total_minor === "number" ? item.total_minor : 0,
      comment: text(item.comment) || null,
    })),
    totalMinor: typeof api.total_minor === "number" ? api.total_minor : 0,
    currency: text(api.currency) || "KZT",
  };
}

export function mapSession(api: ApiTokenPair): AuthSession {
  return {
    accessToken: text(api.access_token),
    refreshToken: text(api.refresh_token),
    expiresAt: text(api.expires_at),
  };
}

export function mapUser(api: ApiUser): AuthUser {
  return {
    id: text(api.id),
    email: text(api.email),
    fullName: text(api.full_name),
    phone: text(api.phone) || null,
  };
}

/**
 * `price` is a decimal STRING ("5500.00", sometimes ""). Parsed to minor units
 * (tiyin) with rounding, because a float multiplied by 100 in JS gives
 * 351000.00000000006 for "3510.00". An unparseable/absent price stays null —
 * unknown, not free (see MenuDish.priceMinor).
 */
export function parsePriceMinor(raw: string | null | undefined): number | null {
  const source = text(raw).trim();
  if (source === "") return null;
  const value = Number(source);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * The full menu grouped by the venue's own `category`, in the venue's own
 * `display_order`. Unavailable dishes (stop list) are kept and marked rather
 * than hidden: a guest who saw the dish on the venue screen and cannot find it
 * here would think the app is broken.
 *
 * Categories keep first-seen order, not alphabetical — a real menu is ordered
 * deliberately (закуски before десерты) and re-sorting it reads as a bug.
 * Dishes with no category land in one trailing group with an empty title,
 * which the screen labels itself (i18n lives in the app, not here).
 */
export function mapMenuSections(items: ApiMenuItem[] | null | undefined): MenuSection[] {
  const byCategory = new Map<string, MenuSection>();
  const sorted = [...(items ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  for (const item of sorted) {
    const title = text(item.category).trim();
    let section = byCategory.get(title);
    if (!section) {
      section = { title, dishes: [] };
      byCategory.set(title, section);
    }
    section.dishes.push({
      id: text(item.id),
      name: text(item.name),
      description: plainText(item.description),
      priceMinor: parsePriceMinor(item.price),
      imageUrl: text(item.image_url) || null,
      isAvailable: item.is_available !== false,
    });
  }
  const sections = [...byCategory.values()];
  // Uncategorised dishes go last so the named sections stay on top.
  return [...sections.filter((s) => s.title !== ""), ...sections.filter((s) => s.title === "")];
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
    // Расстояния тут нет и не появится само: у API нет геопоиска, а у
    // приложения — доступа к геопозиции гостя. Раньше здесь стоял хеш от id,
    // который рисовался как «3.4 км» рядом с адресом.
    coverPhoto: pickCoverPhoto(api),
    isOpenNow: computeIsOpenNow(api.opening_hours),
  };
}

/**
 * Coordinates, or nothing at all. `0,0` is treated as absent on purpose: it is
 * what an unfilled numeric column looks like, and it would open the maps app
 * in the Gulf of Guinea.
 */
function coordinates(api: ApiRestaurant): { latitude?: number; longitude?: number } {
  const lat = api.latitude;
  const lng = api.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  if (lat === 0 && lng === 0) return {};
  return { latitude: lat, longitude: lng };
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
    // Real, from `latitude`/`longitude` on the detail endpoint (verified on
    // the live catalog). Only used to open the device's maps app — there is
    // still no distance calculation, which is the separate stub below.
    ...coordinates(api),
    phone: text(api.phone) || undefined,
    // Real data where the API has it; social_links IS present on the detail
    // endpoint (contrary to the owner's brief lumping it with the map image —
    // only the map preview image itself has no backing field).
    social,
    coverPhoto: pickCoverPhoto(api),
    // Left empty when the venue has no images: the gallery screen shows its
    // own empty state, which is honest, unlike a grid of one placeholder.
    photos,
    // Real, from GET /restaurants/:id/promos (published promos only).
    promoBanners: mapPromoBanners(extras.promos),
    // Real dishes from GET /restaurants/:id/menu — see mapMenuHighlights for
    // why "popular" is really "first available with a photo".
    menuHighlights: mapMenuHighlights(extras.menu, MENU_HIGHLIGHT_LIMIT),
    // The venue's own words, untouched — see the field's doc comment.
    openingHoursText: text(api.opening_hours),
    // Derived, best-effort — see parseOpeningHours/buildWorkingHours comments.
    workingHours: buildWorkingHours(api.opening_hours),
    // STUB: no seating/table data in the API — see unknown-data.ts.
    tables: stubTables(),
    description: plainText(api.description),
    isOpenNow: computeIsOpenNow(api.opening_hours),
    // ASSUMPTION: no per-restaurant bookable flag in the API; every
    // restaurant this endpoint returns is already active. See unknown-data.ts.
    isBookable: ASSUMED_IS_BOOKABLE,
  };
}

/* ------------------------------------------------------------------------ *
 * Events (public cross-venue listing)
 *
 * Shape read from backend-core, not guessed:
 *   internal/transport/rest/events/handler.go
 *     (eventResponse, eventListItemResponse, eventRestaurantResponse,
 *      publicListItemResponse)
 * `venue`, `cover_image_url`, `ticket_price_minor` and `capacity` are
 * `omitempty` on the Go side, so every one of them can be simply ABSENT from
 * the JSON — not null, absent.
 * ------------------------------------------------------------------------ */

/** eventResponse — the guest-facing shape (title/description already resolved
 * into the requested language server-side; the raw *_i18n maps are stripped
 * for public callers). */
export interface ApiEvent {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue?: string;
  cover_image_url?: string | null;
  status: string;
  ticketed: boolean;
  ticket_price_minor?: number | null;
  capacity?: number | null;
  tickets_refundable: boolean;
  ticket_refund_cutoff_minutes: number;
  created_at: string;
  updated_at: string;
}

/** eventListItemResponse — an event plus the venue that hosts it. */
export interface ApiEventListItem extends ApiEvent {
  restaurant?: {
    id?: string;
    name?: string;
    city?: string;
  };
}

/**
 * `status` is deliberately dropped: the public listing only emits published
 * events, so carrying it into the UI would invite a screen to branch on a
 * constant. The `restaurant` object is defensive — a listing row without it
 * degrades to an unclickable card, never to a thrown mapper that blanks the
 * whole section.
 */
export function mapEventSummary(api: ApiEventListItem): EventSummary {
  return {
    id: text(api.id),
    restaurantId: text(api.restaurant_id),
    title: text(api.title),
    description: plainText(api.description),
    startsAt: text(api.starts_at),
    endsAt: text(api.ends_at),
    venue: text(api.venue).trim(),
    coverImageUrl: text(api.cover_image_url).trim() || null,
    ticketed: api.ticketed === true,
    ticketPriceMinor: typeof api.ticket_price_minor === "number" ? api.ticket_price_minor : null,
    capacity: typeof api.capacity === "number" ? api.capacity : null,
    ticketsRefundable: api.tickets_refundable === true,
    ticketRefundCutoffMinutes:
      typeof api.ticket_refund_cutoff_minutes === "number" ? api.ticket_refund_cutoff_minutes : 0,
    restaurant: {
      id: text(api.restaurant?.id) || text(api.restaurant_id),
      name: text(api.restaurant?.name),
      city: text(api.restaurant?.city),
    },
  };
}
