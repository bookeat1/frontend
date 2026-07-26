export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface WorkingHoursEntry {
  weekday: Weekday;
  /** null = closed that day */
  opensAt: string | null; // "10:00"
  closesAt: string | null; // "23:00"
}

/**
 * Ценовая ступень заведения — ровно та строка, которую хранит и сравнивает
 * бэкенд (`price_category`: "₸"/"₸₸"/"₸₸₸"). Раньше здесь были доллары: в
 * тенговом продукте это валюта, которой в нём нет, поэтому знак приведён к
 * тенге во всех местах сразу — и в чипах, и в фильтре, и в запросе к API.
 */
export type PriceLevel = "₸" | "₸₸" | "₸₸₸" | "₸₸₸₸";

export interface Photo {
  id: string;
  /** Local require() asset or remote uri, resolved by the caller. */
  uri: string;
  width: number;
  height: number;
  alt: string;
  /** Gallery tab this photo belongs to — matches "Все / Еда / Интерьер"
   * (Figma node 340:2354). Optional so callers that don't need filtering
   * (e.g. the cover photo) can omit it. */
  category?: "food" | "interior";
}

export interface Cuisine {
  id: string;
  name: string;
}

export interface RestaurantTable {
  id: string;
  seats: number;
  location: "hall" | "terrace" | "bar" | "vip";
  isAvailableNow: boolean;
}

/** A promo banner card in the horizontal strip under the Обзор/Фото tabs. */
export interface PromoBanner {
  id: string;
  title: string;
  /** Optional: the backend's promo entity (GET /restaurants/:id/promos) has no
   * image field at all, so a real promo renders as a caption over the brand
   * placeholder background. Present only for the mock fixtures. */
  photo?: Photo;
}

/** A dish shown in the "Популярное в меню" section. */
export interface MenuHighlight {
  id: string;
  name: string;
  description: string;
  /** Pre-formatted display price, e.g. "8 990 ₸" — matches the design, which
   * doesn't localize/format a raw number in the UI layer. */
  price: string;
  /** Необязательно: в живом каталоге ни у одного блюда нет фотографии
   * (проверено curl'ом 2026-07-26 — 0 фото на 353 блюда четырёх заведений с
   * меню). Блюдо без фото — нормальная строка меню, а не причина скрыть его,
   * поэтому карточка рисует осознанную плашку без картинки. */
  photo?: Photo;
}

export interface RestaurantSocialLinks {
  website?: string;
  whatsapp?: string;
  instagram?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisines: Cuisine[];
  priceLevel: PriceLevel;
  rating: number; // 0..5
  reviewsCount: number;
  address: string;
  /** Short landmark note shown under the address, e.g. "Напротив Меги". */
  addressNote?: string;
  city: string;
  /** WGS84 coordinates, real values from `latitude`/`longitude` on the
   * detail endpoint. Undefined when the venue has none — the caller must hide
   * the "open in maps" affordance rather than send a broken geo: URL. */
  latitude?: number;
  longitude?: number;
  phone?: string;
  social?: RestaurantSocialLinks;
  coverPhoto: Photo;
  photos: Photo[];
  promoBanners: PromoBanner[];
  menuHighlights: MenuHighlight[];
  /** Часы работы так, как их написало само заведение (`opening_hours`), без
   * нашей интерпретации: в живых данных встречается "Чт, Пт, Сб 19:00-24:00",
   * и разложить это по дням недели наш парсер не умеет. Экран показывает эту
   * строку, когда она сложнее одного диапазона, — иначе получалось
   * «Ежедневно с 19:00 до 24:00» у заведения, работающего три дня в неделю. */
  openingHoursText: string;
  workingHours: WorkingHoursEntry[];
  tables: RestaurantTable[];
  description: string;
  isOpenNow: boolean;
  isBookable: boolean;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  cuisines: Cuisine[];
  priceLevel: PriceLevel;
  rating: number;
  reviewsCount: number;
  address: string;
  coverPhoto: Photo;
  isOpenNow: boolean;
}

export interface SearchFilters {
  cuisineIds: string[];
  minRating?: number;
  openNowOnly: boolean;
  /** City name exactly as the catalog spells it ("Алматы"/"Астана") — the
   * backend's city filter is an equality match on that enum value, there is
   * no city id. Undefined = every city. */
  city?: string;
  /** Single price tier, pushed server-side. Undefined = every tier. */
  priceLevel?: PriceLevel;
}

export interface SearchQuery {
  text: string;
  filters: SearchFilters;
}

export interface SearchResult {
  query: SearchQuery;
  items: RestaurantSummary[];
  total: number;
}

export const EMPTY_FILTERS: SearchFilters = {
  cuisineIds: [],
  openNowOnly: false,
};

/* ------------------------------------------------------------------------ *
 * Reservation flow
 * ------------------------------------------------------------------------ */

/**
 * Why a slot cannot be booked. These are the exact values backend-core emits
 * (internal/usecase/bookings/availability.go: ReasonTooSoon/ReasonHorizon/
 * ReasonOccupied/ReasonCapacity) plus `"unknown"` for anything it grows later
 * — the UI must keep rendering a sensible sentence for a reason it has never
 * seen instead of showing a bare greyed-out slot.
 */
export type SlotUnavailableReason =
  | "too_soon"
  | "beyond_horizon"
  | "occupied"
  | "capacity"
  | "unknown";

export interface AvailabilitySlot {
  /** RFC3339 with the venue's UTC offset, e.g. "2026-07-28T19:00:00+05:00". */
  startsAt: string;
  endsAt: string;
  available: boolean;
  /**
   * Tables free for the whole slot. Do NOT use this to decide bookability:
   * a venue with no table rows at all reports 0 for every slot while a
   * table-less booking mode is being built server-side. `available` is the
   * only field that decides; this is a hint for the "N столиков свободно"
   * caption and is hidden when it is 0.
   */
  freeTables: number;
  /** Empty string when `available` — normalized to a known union otherwise. */
  reason: SlotUnavailableReason | null;
}

export interface DayAvailability {
  restaurantId: string;
  /** "YYYY-MM-DD" in the venue's own timezone. */
  date: string;
  /** IANA zone the slots are expressed in, e.g. "Asia/Almaty". */
  timezone: string;
  guests: number;
  durationMinutes: number;
  slots: AvailabilitySlot[];
}

/** One dish on the full menu screen (the pre-order step). Distinct from
 * MenuHighlight, which is the photo-first card on the venue screen. */
export interface MenuDish {
  id: string;
  name: string;
  description: string;
  /**
   * Minor units (tiyin) parsed from the backend's decimal string, or null
   * when the venue left the dish unpriced. Null is NOT zero: an unpriced dish
   * shows "цена уточняется" and cannot be added to the pre-order, because a
   * total built on a guessed price would be a lie.
   */
  priceMinor: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface MenuSection {
  /** Category name as the venue spells it; "" is folded into `otherLabel` by
   * the screen, never rendered as an empty heading. */
  title: string;
  dishes: MenuDish[];
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "waitlist"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";

/**
 * The statuses from which `POST /bookings/:id/cancel` is legal, transcribed
 * from `bookingTransitions` in backend-core/internal/domain/booking.go
 * (every entry whose target set contains `cancelled`). `completed`,
 * `cancelled` and `no_show` are terminal — asking to cancel one answers
 * 422 "invalid status transition".
 *
 * There is deliberately NO time component: since the free-cancel-window
 * consolidation, a guest may cancel at any moment and the deadline only
 * decides whether the deposit comes back (usecase/bookings/status.go,
 * authorizeTransition).
 */
export const CANCELLABLE_BOOKING_STATUSES = [
  "pending",
  "waitlist",
  "confirmed",
  "arrived",
] as const;

export function isCancellableBookingStatus(status: BookingStatus): boolean {
  return (CANCELLABLE_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);
}

export interface Booking {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  guests: number;
  /** RFC3339 UTC as stored by the backend. */
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  notes: string | null;
  /** Absolute moment free cancellation ends; null when it no longer applies. */
  freeCancelDeadline: string | null;
}

/**
 * One page of the guest's own bookings (`GET /bookings`).
 *
 * The list payload is the PLAIN booking, not the details one: it carries no
 * `free_cancel_deadline`, no items and no tables (verified against the live
 * test API on 2026-07-25), so every entry here has
 * `freeCancelDeadline: null` and the detail screen has to re-read the booking
 * by id. It also carries no restaurant name — only `restaurant_id`.
 *
 * Server order is `starts_at DESC` (internal/infrastructure/postgres/booking/
 * repository.go), i.e. the furthest future booking first and the oldest last.
 * The client does NOT re-sort: re-sorting one page of an offset-paginated list
 * produces an order that is wrong across page boundaries.
 */
export interface BookingPage {
  items: Booking[];
  total: number;
  page: number;
  /** Total number of pages the server reports; 0 when there is nothing. */
  pages: number;
  perPage: number;
}

/**
 * Cancellation metadata the guest may attach. Both fields are optional on the
 * backend (`cancelRequest` in internal/transport/rest/bookings/request.go
 * binds an optional body), so an empty `{}` is a valid cancel.
 */
export interface CancelBookingInput {
  reasonCode?: string;
  reason?: string;
}

/** Payment lifecycle as the backend spells it (domain.PaymentStatus). */
export type PaymentStatus =
  | "created"
  | "authorized"
  | "capturing"
  | "captured"
  | "voiding"
  | "voided"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "expired";

/** What the money is for (domain.PaymentPurpose). */
export type PaymentPurpose = "deposit" | "preorder" | "ticket";

/**
 * The booking's live payment, from `GET /bookings/:id/payment`. The endpoint
 * answers 404 when there is none, which the repository turns into `null` —
 * "this booking costs nothing to cancel" is a normal state, not an error.
 */
export interface BookingPayment {
  id: string;
  bookingId: string;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  /** Minor units (tiyn). Never a float, never formatted server-side. */
  amountMinor: number;
  currency: string;
}

export interface CreateBookingInput {
  restaurantId: string;
  /** RFC3339, taken verbatim from the chosen AvailabilitySlot.startsAt. */
  startsAt: string;
  guests: number;
  name: string;
  phone: string;
  notes?: string;
}

export interface PreorderLine {
  id: string;
  menuItemId: string | null;
  name: string;
  priceMinor: number;
  quantity: number;
  totalMinor: number;
  comment: string | null;
}

export interface Preorder {
  bookingId: string;
  items: PreorderLine[];
  /** Server-computed. The cart's own estimate is never shown once this exists. */
  totalMinor: number;
  currency: string;
}

/** What the guest picked before the booking exists. The backend prices the
 * lines itself from its own menu, so no price travels from the client. */
export interface PreorderLineInput {
  menuItemId: string;
  quantity: number;
  comment?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** RFC3339 expiry of the access token. */
  expiresAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
}

/**
 * One upcoming event of the public cross-venue listing (`GET /events`).
 *
 * The guest-facing listing only ever returns PUBLISHED, not-yet-finished
 * events of active venues — the filter is server-side and cannot be widened
 * from the client (internal/transport/rest/events/handler.go: listUpcoming),
 * so there is no `status` field here: it would be the constant "published".
 *
 * IMPORTANT — there are NO tags or categories on an event, anywhere in the
 * backend: no column in `events`, no join table, nothing in domain.Event. The
 * Explore design shows chips ("Brunch", "Special Event"); they are not
 * derivable from any field, so the card does not render them (see EventCard).
 */
export interface EventSummary {
  id: string;
  restaurantId: string;
  title: string;
  description: string;
  /** RFC3339. The card's date line is formatted from this one. */
  startsAt: string;
  endsAt: string;
  /** Room / area inside the venue. Omitted by the server when empty. */
  venue: string;
  /** Null when the venue uploaded no cover — the card must handle it, the
   * backend does not substitute anything. */
  coverImageUrl: string | null;
  ticketed: boolean;
  /** Integer MINOR units (tiyin). Null when the event sells no tickets or the
   * price is not set. */
  ticketPriceMinor: number | null;
  capacity: number | null;
  /** Refund rules the guest must be able to read before buying a ticket.
   * Always present server-side: "not refundable" is a rule too. */
  ticketsRefundable: boolean;
  ticketRefundCutoffMinutes: number;
  /** The hosting venue, so a card can open the restaurant screen without a
   * second request. */
  restaurant: EventRestaurant;
}

/** The minimal venue identity carried on an event of the public listing. */
export interface EventRestaurant {
  id: string;
  name: string;
  city: string;
}

/** Query surface of `GET /events` — every parameter is optional server-side. */
export interface EventQuery {
  /** City of the HOST restaurant, matched by equality on the city enum. */
  city?: string;
  /** UUID. A malformed value is a 422, not an empty list. */
  restaurantId?: string;
  /** RFC3339, inclusive, compared against the event's START. */
  from?: string;
  to?: string;
  page?: number;
  /** Server default 20, hard cap 100. */
  perPage?: number;
}

/** One page of the public events listing, sorted by start time ascending
 * (ties broken by id — a stable order across pages). */
export interface EventPage {
  items: EventSummary[];
  total: number;
  page: number;
  /** 0 when there is nothing at all, same convention as BookingPage. */
  pages: number;
  perPage: number;
}
