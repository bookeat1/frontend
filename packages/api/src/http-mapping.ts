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
  GuideCategory,
  GuideCollection,
  GuideCollectionDetail,
  GuideRoute,
  GuideRouteDetail,
  GuideRoutePoint,
  GuideCollectionVenue,
  GuideHighlight,
  MenuHighlight,
  MenuSection,
  AppNotification,
  NotificationFeed,
  NotificationType,
  PaymentPurpose,
  HomePromo,
  PaymentStatus,
  Photo,
  Preorder,
  PriceLevel,
  PriceRange,
  PromoBanner,
  Restaurant,
  RestaurantStory,
  RestaurantSummary,
  ScheduleDay,
  SlotUnavailableReason,
  DayOfWeek,
  VenueSchedule,
  FavoriteCounts,
  FavoriteEvent,
  FavoriteItem,
  FavoriteItems,
  FavoritePromo,
} from "./types";
import type { VenueCuisine } from "./admin/cuisines";
import { stubTables } from "./unknown-data";

/**
 * Запись справочника кухонь в ответе сервера — `cuisineResponse` из
 * internal/transport/rest/cuisines/dto.go. Форма ОДНА и та же в трёх местах:
 * `GET /cuisines`, `GET /restaurants/:id/cuisines` и массив `cuisines` внутри
 * заведения, — поэтому тип берётся из общего модуля справочника, а не
 * описывается здесь второй раз (кабинет заведения читает тот же).
 *
 * `image_url` необязателен и на бою 2026-08-25 НЕ ПРИХОДИТ ни у одной из 14
 * кухонь, хотя сами картинки в R2 уже лежат. Значит «картинки нет» — это
 * нормальное, а не исключительное состояние, и клиент обязан его пережить.
 */
export type ApiCuisine = VenueCuisine;

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
  /** Старая свободная строка. Сервер собирает её из набора кухонь через
   * запятую и продолжает отдавать ради уже установленных сборок. */
  cuisine_type: string;
  /** Набор кухонь из справочника, в порядке заведения (первая — главная).
   * Отсутствует у заведения, которому набор ещё не проставили. */
  cuisines?: ApiCuisine[] | null;
  address: string;
  opening_hours: string;
  city: string;
  price_category: string;
  /** Числовой диапазон среднего чека в тенге. ОПУЩЕН целиком, когда не задан
   * (проверено на живом бэкенде). min/max могут прийти мусором — маппер их
   * проверяет, см. mapPriceRange. */
  price_range?: { min?: number; max?: number } | null;
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
  /** ОТСУТСТВУЕТ ЦЕЛИКОМ у заведения без записанных часов — см. ApiSchedule. */
  schedule?: ApiSchedule;
  /** Может ли сервер выдать слот по этому заведению вообще. */
  accepts_online_bookings?: boolean;
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
 * A gallery field (`images`) as the UI wants it: a list of non-empty URLs in
 * the order the editor set. The contract always sends an array, but an old
 * build sends nothing and a bad row can carry a blank string — both must fold
 * to "no gallery" (the screen then shows the cover alone), never to a rail with
 * an empty frame in it.
 */
function imageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((url) => text(typeof url === "string" ? url : "")).filter((url) => url !== "");
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
 * `schedule` — структурный график, который сервер СЧИТАЕТ САМ, включая
 * `open_now` в таймзоне заведения (internal/transport/rest/restaurants:
 * scheduleResponse). Ключ `omitempty`: у заведения без записанных часов его в
 * ответе НЕТ ВООБЩЕ (в живом каталоге такое одно — «THE ME’ET»,
 * 85817ed1-3775-42f9-a453-c4f08462899b, проверено curl'ом 2026-07-26).
 *
 * `day_of_week`: 0 — воскресенье.
 */
export interface ApiScheduleDay {
  day_of_week: number;
  is_open: boolean;
  /** "12:00"; у нерабочего дня приходит пустой строкой, не null. */
  opens_at: string;
  closes_at: string;
  closes_next_day: boolean;
}

export interface ApiSchedule {
  timezone: string;
  open_now: boolean;
  days: ApiScheduleDay[];
}

/**
 * "12:00" / "12:00:00" -> "12:00". Всё остальное — null (неизвестно).
 *
 * ВЕДУЩИЙ НОЛЬ ОБЯЗАТЕЛЕН, и это не косметика. Час без него («9:00», «2:00»)
 * ломает две вещи сразу: колонку графика, где часы должны стоять друг под
 * другом, и лексикографическое сравнение "ЧЧ:ММ" (в `openUntilTodayLabel`
 * "9:00" < "10:00" оказывается ложью). Формат правится ЗДЕСЬ, на входе, а не
 * в словаре — иначе тот же час без нуля вылезет на любом следующем экране.
 *
 * «24:00» — законная запись полуночи конца суток (ISO 8601); сервер, который
 * так пишет закрытие, имеет в виду 00:00, а не «времени нет». Раньше такой
 * день превращался в «Открыто, время не указано».
 */
function clockTime(raw: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(text(raw));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  if (hours === 24) return minutes === 0 ? "00:00" : null;
  if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function mapScheduleDay(api: ApiScheduleDay): ScheduleDay | null {
  const day = api?.day_of_week;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) return null;
  const isOpen = api.is_open === true;
  return {
    dayOfWeek: day as DayOfWeek,
    isOpen,
    // У выходного дня время приходит пустым — это не "00:00".
    opensAt: isOpen ? clockTime(api.opens_at) : null,
    closesAt: isOpen ? clockTime(api.closes_at) : null,
    closesNextDay: isOpen && api.closes_next_day === true,
  };
}

/**
 * Отсутствующий/битый `schedule` -> null, то есть «часы работы неизвестны».
 * Ни при каких условиях не «закрыто»: закрытость может утверждать только
 * сервер, и только через `is_open: false` конкретного дня либо `open_now`.
 *
 * Дубликаты по `day_of_week` схлопываются в первый пришедший, а не в
 * последний: две противоречащие записи на один день — повод ничего не
 * выдумывать поверх, а показать первую и не мигать порядком.
 */
export function mapSchedule(api: ApiSchedule | null | undefined): VenueSchedule | null {
  if (!api || typeof api !== "object") return null;
  const days: ScheduleDay[] = [];
  const seen = new Set<number>();
  for (const raw of Array.isArray(api.days) ? api.days : []) {
    const day = mapScheduleDay(raw);
    if (!day || seen.has(day.dayOfWeek)) continue;
    seen.add(day.dayOfWeek);
    days.push(day);
  }
  return {
    timezone: text(api.timezone),
    // Никакого `?? false`: «сервер не сказал» и «закрыто» — разные вещи.
    openNow: typeof api.open_now === "boolean" ? api.open_now : null,
    days: days.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  };
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

/**
 * The venue's cover, or nothing.
 *
 * Undefined, not a placehold.co tile. Until 2026-07-27 a venue with no image
 * was handed `https://placehold.co/800x600?text=No+Image`, which made a grey
 * rectangle in the guest's app depend on a third-party domain: on a bad
 * connection or behind a blocked host it rendered as nothing at all, and the
 * app could not tell "this venue has no photo" from "the photo failed". The
 * same rule already applied to dishes (see mapMenuHighlights); it now applies
 * to venues too, and the placeholder is drawn locally.
 */
function pickCoverPhoto(api: ApiRestaurant): Photo | undefined {
  const primary = api.images?.find((i) => i.is_primary) ?? api.images?.[0];
  const url = primary?.image_url ?? api.primary_image;
  if (!url || !url.trim()) return undefined;
  return imageToPhoto(url, `${api.id}-cover`, text(api.name), undefined);
}

/** Real images carry no food/interior tag (unlike the mock fixtures), so
 * `category` is left undefined — the Photos screen's "Еда"/"Интерьер" tabs
 * will show nothing for real restaurants until the API adds that. The "Все"
 * tab is unaffected since it doesn't filter by category. */
function imageToPhoto(url: string, id: string, alt: string, category: Photo["category"]): Photo {
  return {
    id,
    uri: url,
    width: 800,
    height: 600,
    alt,
    category,
  };
}

/**
 * СТАРЫЙ способ опознать кухню — по свободному тексту `cuisine_type`.
 *
 * Остаётся ровно для заведений, которым набор кухонь из справочника ещё не
 * проставили (на бою 2026-08-25 такое одно из 22 — «Agora wine and deli» с
 * текстом «Винный бар»). Регистр складывается, потому что в колонке живут и
 * «Европейская», и «европейская», и разной кухни из них не получается.
 * Сервер эту форму по-прежнему понимает — `?cuisine=европейская` отвечает тем
 * же, чем `?cuisine=european`.
 */
export function cuisineIdFor(cuisineType: string): string {
  return cuisineType.trim().toLocaleLowerCase("ru-RU");
}

/** Запись справочника внутри ответа о заведении → кухня для экрана. Значение
 * фильтра — `code`; UUID мобильному приложению не нужен (см. Cuisine). */
export function mapCuisine(api: ApiCuisine): Cuisine {
  const code = text(api.code).trim().toLowerCase();
  const name = text(api.name).trim();
  const imageUrl = text(api.image_url).trim();
  return {
    // Кода без имени и имени без кода в справочнике не бывает, но если запись
    // пришла кривой — берём то, что есть, вместо пустого чипа без значения.
    id: code || cuisineIdFor(name),
    name: name || code,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

/**
 * Кухни заведения. Порядок значим: первая — главная.
 *
 * Источников два, и они сосуществуют. Есть массив `cuisines` из справочника —
 * читаем его целиком (заведение может иметь до пяти кухонь). Нет — падаем на
 * старую строку `cuisine_type`, которую сервер продолжает собирать из набора
 * для старых сборок. Нет и её — кухонь у заведения нет, и это законное
 * состояние: карточка просто не рисует чип, а не рисует пустой.
 */
function cuisineForRestaurant(api: ApiRestaurant): Cuisine[] {
  const fromDictionary = (api.cuisines ?? [])
    .map(mapCuisine)
    .filter((cuisine) => cuisine.id !== "" && cuisine.name !== "");
  if (fromDictionary.length > 0) return fromDictionary;

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
  /** Guest-profile columns (migration 0021). Nullable until filled in. */
  city?: string | null;
  /** "YYYY-MM-DD" — a date, formatted server-side with dateOnlyLayout. */
  birth_date?: string | null;
  /** Ссылка на фотографию профиля; отсутствует у аккаунтов без аватара. */
  avatar_url?: string | null;
  /** RFC3339, когда аккаунт создан. Из него считается «N недель в BookEat». */
  created_at?: string | null;
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
    city: text(api.city) || null,
    avatarUrl: text(api.avatar_url) || null,
    createdAt: text(api.created_at) || null,
    birthDate: text(api.birth_date) || null,
  };
}

/**
 * One item of `GET /notifications`. `booking_id` / `restaurant_id` are carried
 * on the wire but not mapped into AppNotification — no row deep-links yet (see
 * AppNotification). Every field is read defensively: a missing key degrades one
 * row, it does not throw and blank the whole inbox.
 */
export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  booking_id?: string | null;
  restaurant_id?: string | null;
  read: boolean;
  created_at: string;
}

/** The whole `GET /notifications` payload (the envelope's `data`): the page's
 * items plus the whole-inbox unread total and an opaque next-page cursor. */
export interface ApiNotificationFeed {
  items?: ApiNotification[];
  unread_count?: number;
  next_cursor?: string | null;
}

const NOTIFICATION_TYPES: NotificationType[] = ["booking", "reminder", "promo"];

/** An unrecognised type maps to "reminder": a bell is the generic notification
 * glyph, so an item of a kind this build has not shipped yet still renders
 * honestly (under «Все» and «Брони») instead of being dropped. */
function mapNotificationType(raw: string | null | undefined): NotificationType {
  const value = text(raw).trim();
  return NOTIFICATION_TYPES.find((type) => type === value) ?? "reminder";
}

export function mapNotification(api: ApiNotification): AppNotification {
  return {
    id: text(api.id),
    type: mapNotificationType(api.type),
    title: text(api.title),
    body: text(api.body),
    createdAt: text(api.created_at),
    read: api.read === true,
    // Пустая строка на проводе — это «брони нет», а не бронь с пустым id.
    bookingId: text(api.booking_id) || null,
  };
}

/**
 * Maps a `GET /notifications` page. `unread_count` that is absent or non-numeric
 * becomes 0 (no badge) rather than NaN, and an absent `next_cursor` is `null`
 * ("this was the last page"), so a partial payload never turns into a bad
 * badge or a broken pagination token.
 */
export function mapNotificationFeed(api: ApiNotificationFeed): NotificationFeed {
  return {
    items: (api.items ?? []).map(mapNotification),
    unreadCount: typeof api.unread_count === "number" ? api.unread_count : 0,
    nextCursor: text(api.next_cursor) || null,
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

/** storyResponse — one promo "story" card of a venue. `caption` is omitted by
 * the server when the venue left it blank, so it is optional AND nullable. */
export interface ApiStory {
  id: string;
  image_url: string;
  caption?: string | null;
  sort_order: number;
}

/**
 * Sorted by `sort_order` ascending here so no screen has to re-sort the rail.
 * A story whose `image_url` is missing is dropped rather than rendered as an
 * empty red-bordered tile — the card is nothing but the image plus a caption.
 */
export function mapRestaurantStories(items: ApiStory[] | null | undefined): RestaurantStory[] {
  return [...(items ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({
      id: text(item.id),
      imageUrl: text(item.image_url),
      caption: text(item.caption) || null,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 0,
    }))
    .filter((story) => story.imageUrl !== "");
}

/** Everything the venue screen needs that lives behind its own endpoint.
 * Each is optional: a failed side-request degrades one section, it must not
 * fail the venue screen (see HttpRestaurantRepository.getRestaurant). */
export interface RestaurantExtras {
  reviews?: ApiReviewSummary;
  menu?: ApiMenuItem[];
  promos?: ApiPromo[];
}

/**
 * `price_range`, or nothing at all. The field is optional server-side and its
 * bounds are only trusted when BOTH are finite numbers — a half-filled or
 * NaN-carrying range is dropped rather than rendered as «4 000–NaN ₸». The
 * caller then falls back to the symbolic `priceLevel` tier.
 */
function mapPriceRange(raw: ApiRestaurant["price_range"]): PriceRange | undefined {
  if (!raw) return undefined;
  const { min, max } = raw;
  if (typeof min !== "number" || typeof max !== "number") return undefined;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  // Bounds are money, never negative. The backend CHECK already enforces this,
  // but guarding here too keeps a bad row from rendering «-500–9 000 ₸».
  if (min < 0 || max < 0) return undefined;
  return { min, max };
}

export function mapRestaurantSummary(api: ApiRestaurant): RestaurantSummary {
  return {
    id: api.id,
    name: text(api.name),
    cuisines: cuisineForRestaurant(api),
    priceLevel: mapPriceLevel(api.price_category),
    priceRange: mapPriceRange(api.price_range),
    // The listing endpoint carries no rating; fetching a per-venue summary
    // for every card would be an N+1 on the search screen. Real ratings are
    // read on the venue screen only — see getRestaurant.
    rating: 0,
    reviewsCount: 0,
    address: text(api.address),
    // Descriptions come from the old CMS as HTML — same field, same cleanup as
    // the detail read (see mapRestaurantDetail).
    description: plainText(api.description),
    // Расстояния тут нет и не появится само: у API нет геопоиска, а у
    // приложения — доступа к геопозиции гостя. Раньше здесь стоял хеш от id,
    // который рисовался как «3.4 км» рядом с адресом.
    coverPhoto: pickCoverPhoto(api),
    // Реальный график с сервера — и в листинге, и в поиске, и в избранном
    // (проверено curl'ом: все три ручки отдают одно и то же поле).
    schedule: mapSchedule(api.schedule),
    acceptsOnlineBookings: api.accepts_online_bookings === true,
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
  const photos: Photo[] = (api.images ?? [])
    // A gallery row with no URL is dropped rather than turned into a tile that
    // can never load: the Photos screen counts what it shows.
    .filter((img) => Boolean(img.image_url?.trim()))
    .map((img) => imageToPhoto(img.image_url, img.id, text(api.name), undefined));
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
    priceRange: mapPriceRange(api.price_range),
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
    // The venue's own words, untouched. Rendered ONLY as a fallback when the
    // structured schedule is absent — see the field's doc comment.
    openingHoursText: text(api.opening_hours),
    schedule: mapSchedule(api.schedule),
    // STUB: no seating/table data in the API — see unknown-data.ts.
    tables: stubTables(),
    description: plainText(api.description),
    acceptsOnlineBookings: api.accepts_online_bookings === true,
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
  /** Free-text labels for the chip row. Contract: always an array (`[]` when
   * none, never null); typed optional here purely to stay defensive against an
   * old build that predates the field. */
  tags?: string[] | null;
  /** Gallery WITHOUT the cover, in the editor's order. Contract: always an
   * array; optional here for the same reason `tags` is — a server that
   * predates the field must degrade to "no gallery", not to a crash. */
  images?: string[] | null;
  /** Series id of a recurring event. Verified live on prod 2026-08-19: the
   * public listing carries it. Absent on a one-off event. */
  recurrence_id?: string | null;
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
    images: imageList(api.images),
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
    // Always an array in the contract; an absent/null field (old build) folds to
    // [], and blank/non-string entries are dropped so the chip row never shows
    // an empty grey pill.
    tags: Array.isArray(api.tags)
      ? api.tags.map((tag) => text(tag)).filter((tag) => tag.length > 0)
      : [],
    // Нужно сердечку: у повторяющегося события в избранном лежит СЕРИЯ, а не
    // конкретная дата, поэтому «сохранено ли» сравнивается по recurrence_id.
    recurrenceId: text(api.recurrence_id).trim() || null,
  };
}

/* ------------------------------------------------------------------------ *
 * Home feed (cross-venue promotions)
 *
 * `GET /feed?city=…` → `{ data: { items: [...] } }`, a MIXED list whose items
 * are discriminated by `kind` ("promo", "event", possibly more). Only `promo`
 * items feed the Home «Акции» strip; every other kind is dropped here so a new
 * feed kind added server-side can never blank or misrender the section.
 *
 * On a promo item `restaurant_name`, `cover_image_url` and `discount_percent`
 * may all be ABSENT — each is optional here and folds to an empty/`null` value.
 * ------------------------------------------------------------------------ */

/** One raw item of the unified feed. Only the fields the promo card needs are
 * modelled; `kind` is the discriminator every item carries. */
export interface ApiFeedItem {
  kind: string;
  id?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  title?: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
  cover_image_url?: string | null;
  /** Gallery WITHOUT the cover. Always an array in the contract; optional here
   * so a server that predates the field degrades to "no gallery". */
  images?: string[] | null;
  discount_percent?: number | null;
}

/**
 * Keeps only `kind === "promo"` items and maps them to the domain `HomePromo`.
 * An item without an id is dropped (it cannot be a stable list key), the same
 * defensive stance the stories mapper takes for a missing image.
 */
export function mapHomePromos(items: ApiFeedItem[] | null | undefined): HomePromo[] {
  return (items ?? [])
    .filter((item) => item?.kind === "promo")
    .map((item) => ({
      id: text(item.id),
      restaurantId: text(item.restaurant_id),
      restaurantName: text(item.restaurant_name).trim(),
      title: text(item.title),
      description: plainText(item.description),
      startsAt: text(item.starts_at),
      endsAt: text(item.ends_at),
      coverImageUrl: text(item.cover_image_url).trim() || null,
      images: imageList(item.images),
      discountPercent: typeof item.discount_percent === "number" ? item.discount_percent : null,
    }))
    .filter((promo) => promo.id !== "");
}

/**
 * GASTROGUIDE collection DTOs — the guest-facing «Статьи» feature. Shapes read
 * from the live contract (test.backend), not guessed:
 *   list:   GET /gastroguide/collections → Page<collectionListItem>
 *   detail: GET /gastroguide/collections/:slug → collectionDetail (+ venues)
 *
 * There is NO author field on either shape — the byline is a UI constant. A
 * venue block carries only `address` (no social links / instagram), so the
 * detail mapper never invents one.
 */
/** Гостевой ответ `GET /gastroguide/categories` — четыре поля, ни картинки,
 * ни подзаголовка (см. `GuideCategory`). */
export interface ApiGuideCategory {
  id?: string;
  slug?: string;
  title?: string;
  position?: number;
}

/**
 * Рубрики гастрогида. Рубрика без слага или без названия выбрасывается: слаг —
 * связь с `category_slugs` подборки и ключ списка, а плитка без подписи не
 * говорит гостю ничего. Порядок задаёт редакция (`position`); сортируем сами,
 * чтобы порядок не зависел от того, в каком виде страница пришла из кэша.
 */
export function mapGuideCategories(
  items: ApiGuideCategory[] | null | undefined,
): GuideCategory[] {
  return (items ?? [])
    .map((api) => ({
      slug: text(api.slug),
      title: text(api.title),
      position: typeof api.position === "number" ? api.position : 0,
    }))
    .filter((c) => c.slug !== "" && c.title !== "")
    .sort((a, b) => a.position - b.position);
}

export interface ApiGuideCollection {
  slug?: string;
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  venue_count?: number;
  category_slugs?: string[] | null;
}

export interface ApiGuideVenue {
  restaurant_id?: string;
  position?: number;
  note?: string | null;
  name?: string;
  address?: string | null;
  cuisine_type?: string | null;
  city?: string | null;
  price_category?: string | null;
  primary_image_url?: string | null;
  instagram?: string | null;
  highlight?: ApiGuideHighlight | null;
}

/** The event/promo a collection block is illustrated with. */
export interface ApiGuideHighlight {
  kind?: string;
  id?: string;
  title?: string;
  description?: string | null;
  starts_at?: string | null;
  cover_image_url?: string | null;
  images?: string[] | null;
}

export interface ApiGuideCollectionDetail extends ApiGuideCollection {
  venues?: ApiGuideVenue[] | null;
}

/**
 * The card fields shared by the list and detail shapes. Every field is treated
 * as possibly absent even where the Go struct always emits it — one missing key
 * must degrade a card, never blank the whole «Статьи» list. `description` runs
 * through `plainText` because the editorial blurb can carry the same legacy CMS
 * HTML the venue descriptions do.
 */
function mapGuideCollectionCard(api: ApiGuideCollection): GuideCollection {
  return {
    slug: text(api.slug),
    title: text(api.title),
    subtitle: plainText(api.subtitle),
    description: plainText(api.description),
    coverImageUrl: text(api.cover_image_url) || null,
    venueCount: typeof api.venue_count === "number" ? api.venue_count : 0,
    categorySlugs: (api.category_slugs ?? []).map(text).filter((s) => s !== ""),
  };
}

/**
 * The «Статьи» list. A collection without a slug is dropped: the slug is both
 * the route param and the list key, so a blank one is unusable — the same
 * defensive stance the promo mapper takes for a missing id.
 */
export function mapGuideCollections(
  items: ApiGuideCollection[] | null | undefined,
): GuideCollection[] {
  return (items ?? []).map(mapGuideCollectionCard).filter((c) => c.slug !== "");
}

/* --- гастропрогулки --- */

export interface ApiGuideRoute {
  slug?: string;
  title?: string;
  description?: string | null;
  cover_image_url?: string | null;
  duration_label?: string | null;
  point_count?: number;
}

export interface ApiGuideRoutePoint {
  id?: string;
  position?: number;
  kind?: string;
  title?: string;
  description?: string | null;
  photo_url?: string | null;
  address?: string | null;
  venue?: ApiGuideRouteVenue | null;
}

export interface ApiGuideRouteVenue {
  id?: string;
  name?: string;
  address?: string | null;
  cuisine_type?: string | null;
  city?: string | null;
  price_category?: string | null;
  primary_image_url?: string | null;
}

export interface ApiGuideRouteDetail extends ApiGuideRoute {
  points?: ApiGuideRoutePoint[] | null;
}

function mapGuideRouteCard(api: ApiGuideRoute): GuideRoute {
  return {
    slug: text(api.slug),
    title: text(api.title),
    description: plainText(api.description),
    coverImageUrl: text(api.cover_image_url) || null,
    durationLabel: text(api.duration_label),
    pointCount: typeof api.point_count === "number" ? api.point_count : 0,
  };
}

/** Список маршрутов. Маршрут без слага выкидываем: слаг — и ключ списка, и
 * параметр перехода, открывать по пустому нечего. Та же защита, что у
 * подборок. */
export function mapGuideRoutes(items: ApiGuideRoute[] | null | undefined): GuideRoute[] {
  return (items ?? []).map(mapGuideRouteCard).filter((r) => r.slug !== "");
}

/**
 * Остановка маршрута.
 *
 * НЕИЗВЕСТНЫЙ `kind` считаем местом, а не выкидываем точку: выкинуть значит
 * молча сократить маршрут, а «место» — безопасная трактовка, при которой точка
 * просто не претендует на карточку заведения.
 *
 * Заведение подставляем ТОЛЬКО когда у него есть id: без него открыть экран
 * заведения нельзя, и карточка-обманка хуже её отсутствия.
 */
function mapGuideRoutePoint(api: ApiGuideRoutePoint, index: number): GuideRoutePoint {
  const venueId = text(api.venue?.id);
  return {
    id: text(api.id),
    position: typeof api.position === "number" ? api.position : index + 1,
    kind: api.kind === "restaurant" ? "restaurant" : "place",
    title: text(api.title),
    description: plainText(api.description),
    photoUrl: text(api.photo_url) || null,
    address: text(api.address),
    venue:
      api.venue && venueId
        ? {
            id: venueId,
            name: text(api.venue.name),
            address: text(api.venue.address),
            cuisineType: text(api.venue.cuisine_type),
            city: text(api.venue.city),
            priceCategory: text(api.venue.price_category),
            imageUrl: text(api.venue.primary_image_url) || null,
          }
        : null,
  };
}

export function mapGuideRouteDetail(api: ApiGuideRouteDetail): GuideRouteDetail {
  const points = (api.points ?? []).map(mapGuideRoutePoint);
  return {
    ...mapGuideRouteCard(api),
    points: [...points].sort((a, b) => a.position - b.position),
  };
}

/** One venue block of a collection detail. Ordered by `position` ascending so
 * no screen has to re-sort; a venue without a restaurant id is dropped (it
 * cannot open a restaurant screen or be a stable key). */
function mapGuideVenue(api: ApiGuideVenue): GuideCollectionVenue {
  return {
    restaurantId: text(api.restaurant_id),
    name: text(api.name),
    note: plainText(api.note),
    address: text(api.address),
    cuisineType: text(api.cuisine_type),
    city: text(api.city),
    priceCategory: text(api.price_category),
    imageUrl: text(api.primary_image_url) || null,
    instagram: text(api.instagram),
    highlight: mapGuideHighlight(api.highlight),
  };
}

/**
 * The block's event/promo, or `null` when the block is a plain venue card.
 * An UNKNOWN kind is dropped rather than rendered: `kind` is what the tap
 * routes on, and a card that opens the wrong screen is worse than a card that
 * stays a venue block. A highlight without an id is dropped for the same
 * reason — there would be nothing to open.
 */
function mapGuideHighlight(api: ApiGuideHighlight | null | undefined): GuideHighlight | null {
  if (!api) return null;
  const kind = text(api.kind);
  const id = text(api.id);
  if ((kind !== "event" && kind !== "promo") || id === "") return null;
  return {
    kind,
    id,
    title: text(api.title),
    description: plainText(api.description),
    startsAt: text(api.starts_at),
    coverImageUrl: text(api.cover_image_url) || null,
    images: imageList(api.images),
  };
}

export function mapGuideCollectionDetail(api: ApiGuideCollectionDetail): GuideCollectionDetail {
  const venues = [...(api.venues ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(mapGuideVenue)
    .filter((v) => v.restaurantId !== "");
  return {
    ...mapGuideCollectionCard(api),
    venues,
  };
}

/* ------------------------------------------------------------------------ *
 * Favorites — one list of venues, events and promos
 *
 * `GET /favorites/items[?type=restaurant|event|promo]` →
 *   { items: [ { kind, favorited_at, restaurant|event|promo } ], counts }
 *
 * `counts` is computed for ALL kinds even when `type=` narrows `items`, which
 * is what lets the tab row render from any single response.
 *
 * Two server behaviours the mapper must NOT hide:
 *   - a recurring event is saved as the SERIES and resolves to the nearest
 *     upcoming occurrence, so `id` here may differ from the id that was saved
 *     (`recurrence_id` is the stable one — see favoriteEventKey in ./types);
 *   - unpublished / expired items are simply absent from the list, so a short
 *     list is a real answer, never a mapping failure.
 * ------------------------------------------------------------------------ */

export interface ApiFavoriteEvent {
  id?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  city?: string;
  title?: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
  venue?: string;
  cover_image_url?: string | null;
  tags?: string[] | null;
  ticketed?: boolean;
  ticket_price_minor?: number | null;
  is_recurring?: boolean;
  recurrence_id?: string | null;
}

export interface ApiFavoritePromo {
  id?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  city?: string;
  title?: string;
  description?: string;
  terms?: string;
  starts_at?: string;
  ends_at?: string;
  cover_image_url?: string | null;
  discount_percent?: number | null;
}

export interface ApiFavoriteItem {
  kind?: string;
  favorited_at?: string;
  restaurant?: ApiRestaurant;
  event?: ApiFavoriteEvent;
  promo?: ApiFavoritePromo;
}

export interface ApiFavoriteCounts {
  all?: number;
  restaurants?: number;
  events?: number;
  promos?: number;
}

export interface ApiFavoriteItems {
  items?: ApiFavoriteItem[] | null;
  counts?: ApiFavoriteCounts | null;
}

function count(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function mapFavoriteEvent(api: ApiFavoriteEvent): FavoriteEvent {
  const recurrenceId = text(api.recurrence_id).trim() || null;
  return {
    id: text(api.id),
    restaurantId: text(api.restaurant_id),
    restaurantName: text(api.restaurant_name).trim(),
    city: text(api.city).trim(),
    title: text(api.title),
    description: plainText(api.description),
    startsAt: text(api.starts_at),
    endsAt: text(api.ends_at),
    venue: text(api.venue).trim(),
    coverImageUrl: text(api.cover_image_url).trim() || null,
    tags: Array.isArray(api.tags)
      ? api.tags.map((tag) => text(tag)).filter((tag) => tag.length > 0)
      : [],
    ticketed: api.ticketed === true,
    ticketPriceMinor:
      typeof api.ticket_price_minor === "number" ? api.ticket_price_minor : null,
    // Признак серии выводится из recurrence_id, если сервер не прислал флаг:
    // одно поле не должно противоречить другому.
    isRecurring: api.is_recurring === true || recurrenceId !== null,
    recurrenceId,
  };
}

export function mapFavoritePromo(api: ApiFavoritePromo): FavoritePromo {
  return {
    id: text(api.id),
    restaurantId: text(api.restaurant_id),
    restaurantName: text(api.restaurant_name).trim(),
    city: text(api.city).trim(),
    title: text(api.title),
    description: plainText(api.description),
    terms: plainText(api.terms),
    startsAt: text(api.starts_at),
    endsAt: text(api.ends_at),
    coverImageUrl: text(api.cover_image_url).trim() || null,
    discountPercent: typeof api.discount_percent === "number" ? api.discount_percent : null,
  };
}

/**
 * A row whose `kind` is unknown, or whose entity object is missing or has no
 * id, is DROPPED: there would be nothing to render and nothing to un-favorite.
 * A future fourth kind therefore shortens the list instead of crashing it.
 */
function mapFavoriteItem(api: ApiFavoriteItem): FavoriteItem | null {
  const favoritedAt = text(api.favorited_at);
  switch (text(api.kind)) {
    case "restaurant": {
      if (!api.restaurant || text(api.restaurant.id) === "") return null;
      return { kind: "restaurant", favoritedAt, restaurant: mapRestaurantSummary(api.restaurant) };
    }
    case "event": {
      if (!api.event) return null;
      const event = mapFavoriteEvent(api.event);
      return event.id === "" ? null : { kind: "event", favoritedAt, event };
    }
    case "promo": {
      if (!api.promo) return null;
      const promo = mapFavoritePromo(api.promo);
      return promo.id === "" ? null : { kind: "promo", favoritedAt, promo };
    }
    default:
      return null;
  }
}

export function mapFavoriteItems(api: ApiFavoriteItems | null | undefined): FavoriteItems {
  const items = (api?.items ?? [])
    .map(mapFavoriteItem)
    .filter((item): item is FavoriteItem => item !== null);
  const counts: FavoriteCounts = {
    all: count(api?.counts?.all),
    restaurants: count(api?.counts?.restaurants),
    events: count(api?.counts?.events),
    promos: count(api?.counts?.promos),
  };
  return { items, counts };
}
