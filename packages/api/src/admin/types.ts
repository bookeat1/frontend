/**
 * Admin-panel API types. These mirror the backend DTOs 1:1 (see
 * backend-core/internal/transport/rest/{auth,admin}/{request,response}.go).
 * Kept in a dedicated subpath (`@bookeat/api/admin`) so the web admin app can
 * consume a framework-light surface without dragging in the mobile mock data
 * (which imports .jpg assets) or the React-Native peer types.
 */
import type { SocialLink, SocialLinkInput } from "./social-links";
import type { VenueCuisine } from "./cuisines";
import type { VenueFeature } from "./venue-features";

/** Auth token pair returned by /auth/login, /auth/refresh. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  /** RFC3339 timestamp of access-token expiry. */
  expires_at: string;
}

/** The signed-in user (GET /users/me). `role` is the global role, NOT the
 * per-restaurant staff role — the panel resolves restaurant membership by
 * loading the restaurant profile (see AdminApiClient.getProfile). */
export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: string;
  avatar_url: string | null;
  preferred_language: string;
}

/** Standard paginated list envelope (response.Page[T]). */
export interface ApiPage<T> {
  items: T[];
  total: number;
  pages: number;
  page: number;
  per_page: number;
}

/** Booking lifecycle states (domain.BookingStatus). */
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "waitlist"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";

/** Where a booking originated (domain.BookingSource). */
export type BookingSource = "app" | "admin" | "phone" | "widget";

/** One booking row as shown in the venue calendar (admin.bookingResponse). */
export interface AdminBooking {
  id: string;
  restaurant_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  email: string;
  guests: number;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: BookingSource;
  notes: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
  /** Блюда, заказанные гостем заранее. Всегда массив: у брони без предзаказа
   * он пуст, и клиенту не нужно разбирать два разных «ничего». */
  preorder: AdminBookingPreorderItem[];
}

/** Одна строка предзаказа так, как её видит заведение: что готовить, сколько
 * порций и почём. Цена зафиксирована в момент заказа, не пересчитывается по
 * текущему меню. */
export interface AdminBookingPreorderItem {
  name: string;
  quantity: number;
  price_minor: number;
  total_minor: number;
  comment?: string;
}

/** One menu item (admin.menuItemResponse). Price is a decimal string. */
export interface AdminMenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: string;
  image_url: string | null;
  is_available: boolean;
  category: string | null;
  subcategory: string | null;
  portion_size: string | null;
  display_order: number | null;
  tags: string[];
}

/** A menu category (admin.menuCategoryResponse). */
export interface AdminMenuCategory {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
}

// ---- Restaurant pricing (average check) ------------------------------------

/**
 * The venue's numeric average-check range, in WHOLE tenge (major units, not
 * tiyn): `{ min: 4000, max: 9000 }` = «4 000–9 000 ₸». The backend emits it in
 * `restaurantResponse.price_range` (restaurants/response.go: priceRangeResponse)
 * and OMITS the key when the venue has no range set, so the field is optional
 * and `null` and "absent" mean the same thing: no range yet.
 */
export interface RestaurantPriceRange {
  min: number;
  max: number;
}

/**
 * The pricing slice of the public `GET /restaurants/:id` response
 * (restaurantResponse), the only source that carries BOTH the categorical tier
 * and the numeric range — the admin profile endpoint returns `price_category`
 * alone. Used to prefill the «Средний чек» card; the same shape is returned by
 * `patchRestaurant` (the PATCH answers the full updated restaurant, and this
 * types only the fields the panel reads back). Other fields of the response are
 * deliberately not modelled here.
 */
export interface RestaurantPricing {
  price_category: string;
  price_range?: RestaurantPriceRange | null;
}

/**
 * PATCH body for `PATCH /restaurants/:id` (restaurants/request.go:
 * saveRestaurantRequest), pricing fields only. Every key is an optional Go
 * pointer: OMIT a key to leave that column alone. `price_min`/`price_max` are
 * WHOLE tenge and the backend validates the MERGED row (both-null-or-both-set,
 * 0 <= min <= max), so send them together or not at all. `is_active` and the
 * marketing flags are intentionally absent: the backend strips them for
 * non-admin (venue-manager) callers, so this UI never offers them.
 */
export interface RestaurantPricePatch {
  price_category?: string | null;
  price_min?: number | null;
  price_max?: number | null;
}

// ---- Telegram notification settings ----------------------------------------

/**
 * The venue's Telegram alert configuration
 * (admin.telegramSettingsResponse, GET/PUT
 * /admin/restaurants/:id/notification-settings/telegram). This is the chat that
 * receives the venue's booking/cancel alerts. `connected` is `telegram_chat_id
 * != ""`; a PUT answers `{connected:true, enabled:true}`, a DELETE clears it.
 */
export interface TelegramSettings {
  connected: boolean;
  telegram_chat_id: string;
  enabled: boolean;
}

/**
 * WhatsApp-адрес тех же уведомлений. Форма повторяет TelegramSettings, потому
 * что это один и тот же канал доставки с другим транспортом.
 *
 * `whatsapp_phone` возвращается СЕРВЕРНЫЙ, приведённый к международному виду:
 * этим же номером опознаётся входящее нажатие кнопки, и панель обязана
 * показывать ровно то, что записано, а не то, что набрали.
 */
export interface WhatsAppSettings {
  connected: boolean;
  whatsapp_phone: string;
  enabled: boolean;
}

/**
 * Строка персонала заведения (transport `managerResponse`,
 * GET /restaurants/:id/managers).
 *
 * `whatsapp_phone` — ЛИЧНЫЙ номер сотрудника, на который ему приходят брони;
 * это НЕ номер заведения из `WhatsAppSettings` (тот же канал, но другой
 * адресат). Номер приходит приведённым к международному виду или `null`,
 * когда его нет.
 *
 * Имени и телефона самого пользователя тут нет: бэкенд отдаёт только
 * `user_id`, и ручки «показать пользователя по id» для персонала в API сейчас
 * не существует.
 */
export interface RestaurantManager {
  id: string;
  restaurant_id: string;
  user_id: string;
  /** "owner" | "manager" | "hostess". */
  role: string;
  whatsapp_opt_in: boolean;
  whatsapp_phone: string | null;
}

/**
 * Тело PATCH /restaurants/:id/managers/:managerID для WhatsApp-полей.
 *
 * ОБА поля необязательны, и отсутствие поля означает «не менять». Пустая
 * строка в `whatsapp_phone` — это «стереть номер». `whatsapp_opt_in: true`
 * без номера (ни сохранённого, ни в этом же теле) сервер отвергает 422.
 */
export interface SetManagerWhatsAppInput {
  whatsapp_opt_in?: boolean;
  whatsapp_phone?: string;
}

/** The venue's own profile (admin.restaurantProfileResponse). Editorial flags
 * (is_active/is_premium) are read-only display fields. */
export interface RestaurantProfile {
  id: string;
  name: string;
  description: string;
  address: string;
  opening_hours: string;
  phone: string;
  email: string;
  city: string;
  price_category: string;
  is_active: boolean;
  is_premium: boolean | null;
}

/** Filters for GET /admin/restaurants/:id/bookings. */
export interface BookingListParams {
  /** Single calendar day, "YYYY-MM-DD". Ignored if from/to are set. */
  date?: string;
  from?: string;
  to?: string;
  /** One or more statuses (sent comma-joined). */
  statuses?: BookingStatus[];
  page?: number;
  per_page?: number;
}

/** Optional body on confirm/reject/no-show transitions. */
export interface BookingReasonInput {
  reason?: string;
}

/** Optional body on a venue cancellation. */
export interface BookingCancelInput {
  reason_code?: string;
  reason?: string;
}

// ---- My restaurants (post-login picker) ------------------------------------

/** One entry of GET /admin/my-restaurants (myrestaurants.restaurantResponse):
 * a restaurant the signed-in staff member manages, plus their role there. */
export interface MyRestaurant {
  id: string;
  name: string;
  /** "owner" | "manager" | "hostess", or "admin" for a superadmin. */
  role: string;
}

/** Envelope of GET /admin/my-restaurants (data is `{restaurants: [...]}`). */
export interface MyRestaurantsResponse {
  restaurants: MyRestaurant[];
}

// ---- Venue catalog (superadmin) ---------------------------------------------

/** One venue as the catalog endpoints return it (transport restaurantResponse).
 * Only the fields the panel reads are modelled; the payload carries more. */
export interface CatalogVenue {
  id: string;
  name: string;
  description: string;
  cuisine_type: string;
  address: string;
  city: string;
  price_category: string;
  price_range?: { min: number; max: number } | null;
  email: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  is_new?: boolean | null;
  is_popular?: boolean | null;
  is_premium?: boolean | null;
  display_order?: number | null;
  primary_image?: string | null;
  images?: { image_url: string; is_primary: boolean }[];
  /** Ссылки на соцсети. Приходят ТОЛЬКО в детальном ответе
   * (aggregateToResponse: GET /restaurants/:id и ответ на PATCH); в листинге
   * каталога (GET /admin/restaurants → listItemToResponse) их нет вообще, и
   * `undefined` тут значит «не знаем», а не «их нет». */
  social_links?: SocialLink[];
  /** Набор кухонь заведения из справочника, В ПОРЯДКЕ заведения (первая —
   * главная). Ключ ОПУЩЕН, когда набора нет (`omitempty`), поэтому `undefined`
   * значит «кухни не заданы» — а на сборке бэкенда без справочника его нет ни
   * у кого. `cuisine_type` остаётся строкой и собирается сервером из этого же
   * набора. */
  cuisines?: VenueCuisine[];
  /** Набор удобств заведения из справочника. Ключ ОПУЩЕН, когда набора нет
   * (`omitempty`), поэтому `undefined` значит «удобства не заданы». Приходит и
   * в листинге каталога, и в детальном ответе (`listItemToResponse` и
   * `aggregateToResponse` зовут один и тот же `featuresToResponse`), поэтому
   * фильтр каталога в панели считается по уже загруженной странице.
   *
   * ЗАПИСЫВАЕТСЯ ТОЛЬКО отдельной ручкой `PUT /restaurants/:id/features`:
   * свободнотекстовый ключ `features` в теле PATCH заведения сервер отвергает
   * с 422 — поэтому его нет в CatalogVenueInput. */
  features?: VenueFeature[];
}

/** Body of POST /restaurants and PATCH /restaurants/:id. Every field is
 * optional on the PATCH: an omitted key leaves that column alone (the backend
 * binds pointers), and `images` omitted PRESERVES the current gallery — sending
 * `[]` clears it. */
export interface CatalogVenueInput {
  name?: string;
  description?: string;
  cuisine_type?: string;
  address?: string;
  city?: string;
  price_category?: string;
  price_min?: number;
  price_max?: number;
  email?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  is_active?: boolean;
  is_new?: boolean;
  is_popular?: boolean;
  is_premium?: boolean;
  display_order?: number;
  images?: { image_url: string; is_primary: boolean }[];
  /** Ссылки на соцсети. Ключ ЗАМЕЩАЕТ весь набор заведения
   * (usecase/restaurants: ReplaceSocialLinks), поэтому отправлять его можно
   * только зная текущий набор: пропуск ключа сохраняет ссылки, `[]` — стирает
   * все. */
  social_links?: SocialLinkInput[];
}

// ---- Events ----------------------------------------------------------------

/** Event publication state (domain.EventStatus). draft -> published -> hidden. */
export type EventStatus = "draft" | "published" | "hidden";

/** One event as returned by the admin endpoints (events.eventResponse, admin
 * shape — carries the raw i18n maps). Money is integer minor units, never a
 * float. `*_i18n`, cover_image_url, ticket_price_minor and capacity are omitted
 * by the backend when empty. */
export interface AdminEvent {
  id: string;
  /** Заведение-хозяин. ОТСУТСТВУЕТ у события платформы (events.eventResponse,
   * `restaurant_id,omitempty`): у него заведения нет вовсе. Читая это поле,
   * различайте «нет ключа» и «пустая строка» — второго backend не присылает. */
  restaurant_id?: string;
  title: string;
  title_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  starts_at: string;
  ends_at: string;
  venue?: string;
  cover_image_url?: string | null;
  status: EventStatus;
  ticketed: boolean;
  ticket_price_minor?: number | null;
  capacity?: number | null;
  tags?: string[];
  /** Переопределение города показа. Отсутствует — событие живёт в городе своего
   * заведения, а у события платформы это значит «во всех городах». */
  city?: string | null;
  /** Кнопка на карточке. Отсутствует — кнопки нет. */
  action?: AdminEventAction;
  /** Галерея БЕЗ обложки, в порядке редактора (migration 0070). Контракт всегда
   * присылает массив; поле опционально здесь на случай старой сборки сервера. */
  images?: string[];
  created_at: string;
  updated_at: string;
}

/** Create/update payload for an event (events.eventRequest). starts_at/ends_at
 * must be RFC3339. ticket_price_minor is integer minor units. */
export interface EventInput {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  cover_image_url: string | null;
  status: EventStatus;
  ticketed: boolean;
  ticket_price_minor: number | null;
  capacity: number | null;
  tags?: string[];
  /** Полная замена галереи: пустой список её очищает, как и всё остальное в
   * этой структуре. */
  images?: string[];
  /** Город показа. Полная замена, как и всё здесь: `null` снимает
   * переопределение. Неизвестный или скрытый город сервер отвергает 422. */
  city?: string | null;
  /** Кнопка карточки. `null` или отсутствие — КНОПКИ НЕТ; на обновлении это
   * значит «убрать кнопку», потому что запись целиком заменяет запись. */
  action?: EventActionInput | null;
}

/** Куда ведёт кнопка события. Поле ВЫВОДНОЕ: сервер считает его из наличия
 * `url` и никогда не хранит отдельно, поэтому в запрос его слать нельзя —
 * иначе payload смог бы сказать target=event с внешней ссылкой. */
export type EventActionTarget = "event" | "external";

/** Кнопка события в ответе сервера (events.eventActionResponse). */
export interface AdminEventAction {
  label: string;
  target: EventActionTarget;
  /** Внешний адрес. Отсутствует, когда кнопка ведёт на страницу самого
   * события. */
  url?: string;
}

/** Кнопка события в запросе (events.eventActionRequest). `target` здесь НЕТ
 * намеренно — он выводится из `url`. */
export interface EventActionInput {
  label: string;
  /** `null` или отсутствие → кнопка открывает страницу самого события.
   * Строка → внешняя ссылка; сервер проверяет её строго (только http/https,
   * с хостом, без учётных данных, до 2048 символов). */
  url?: string | null;
}

// ---- Promos ----------------------------------------------------------------

/** Promo publication state (domain.PromoStatus). draft -> published -> hidden. */
export type PromoStatus = "draft" | "published" | "hidden";

/** One promo as returned by the admin endpoints (promos.promoResponse). */
export interface AdminPromo {
  id: string;
  /** Заведение. ОТСУТСТВУЕТ у акции платформы (promos.promoResponse,
   * `restaurant_id,omitempty`). */
  restaurant_id?: string;
  title: string;
  title_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  starts_at: string;
  ends_at: string;
  terms?: string;
  cover_image_url?: string | null;
  discount_percent?: number | null;
  status: PromoStatus;
  /** Галерея БЕЗ обложки, в порядке редактора (migration 0070). */
  images?: string[];
  /** Переопределение города. Отсутствует — акция живёт в городе своего
   * заведения, а у акции платформы это значит «во всех городах». */
  city?: string | null;
  created_at: string;
  updated_at: string;
}

/** Create/update payload for a promo (promos.promoRequest). */
export interface PromoInput {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  terms: string;
  cover_image_url?: string | null;
  discount_percent?: number | null;
  status: PromoStatus;
  /** Полная замена галереи: пустой список её очищает. */
  images?: string[];
  /** Город показа. Полная замена: `null` снимает переопределение. */
  city?: string | null;
}

// ---- Stories (restaurant rail) ---------------------------------------------

/** One story on a restaurant's rail (stories.storyResponse). The list endpoint
 * returns ALL of them, active and inactive, ordered by `sort_order`. */
export interface Story {
  id: string;
  /** Адрес САМОЙ КАРТИНКИ сторис. */
  image_url: string;
  caption: string | null;
  /**
   * ВНЕШНЯЯ ссылка, куда уходит гость по тапу на сторис. Это НЕ `image_url`:
   * `image_url` — где лежит картинка, `action_url` — куда ведёт тап. `null` =
   * сторис никуда не ведёт; сервер отдаёт поле только когда ссылка задана.
   */
  action_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Create/update payload for a story.
 *
 * `image_url` is required on create (an http(s) URL); the rest are optional and
 * the server fills defaults (`sort_order` = end, `is_active` = true). Update
 * sends a PARTIAL of this shape — only the fields the operator changed — so the
 * client's updateStory takes `Partial<StoryInput>`.
 */
export interface StoryInput {
  image_url: string;
  caption?: string | null;
  /**
   * Внешняя ссылка перехода (http/https), НЕ адрес картинки. Пустая строка или
   * `null` снимает ссылку; сервер проверяет схему и отвечает 422 на всё, что не
   * является открываемой http(s)-ссылкой.
   */
  action_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

// ---- Home-feed placement (merchandising) -----------------------------------

/** Which entity a feed placement points at (domain.FeedItemKind). The path
 * segment `:kind` in the feed item routes. */
export type FeedItemKind = "promo" | "event";

/** The platform's moderation decision for one item (domain.FeedStatus). This is
 * the axis the venue submit/withdraw flow moves along, and what the panel's
 * badge/button branch on:
 *   not_submitted → (submit) → pending_review → (superadmin approve) → approved
 *   pending_review|approved → (withdraw) → not_submitted
 *   pending_review → (superadmin reject) → rejected → (submit) → pending_review
 */
export type FeedStatus = "not_submitted" | "pending_review" | "approved" | "rejected";

/** The richer lifecycle the venue sees (domain.FeedLifecycle): FeedStatus folded
 * together with the item's active window — `approved` splits into `approved`
 * (waiting for its start date) vs `live` (on Home right now) vs `expired`.
 * Carried for completeness; badges/buttons key off `feed_status`. */
export type FeedLifecycle =
  | "not_submitted"
  | "submitted"
  | "rejected"
  | "approved"
  | "live"
  | "expired";

/** One promo/event's feed & moderation state (feed.stateResponse). Returned by
 * listVenueFeed / getFeedItem / submitFeedItem / withdrawFeedItem.
 * `rejection_reason` is present only on a rejection; the `*_at`/`reviewed_by`
 * fields are omitted until the corresponding step happened. */
export interface FeedItemState {
  kind: FeedItemKind;
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  title: string;
  starts_at: string;
  ends_at: string;
  /** The item's own publication status (promo/event status), not moderation. */
  item_status: string;
  feed_status: FeedStatus;
  lifecycle: FeedLifecycle;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  placement_weight: number;
}

/** Upper bound of the paid-placement lever (domain.MaxFeedPlacementWeight).
 * The weight is clamped to 0..this both on the client (input) and re-validated
 * on the server. */
export const MAX_FEED_PLACEMENT_WEIGHT = 100;

/** The superadmin's moderation decision for one queued item (feed.reviewRequest).
 * `approve=false` REQUIRES a non-empty `rejection_reason` (the venue must be told
 * what to fix); the server rejects a reasonless rejection with 422. On approve,
 * `rejection_reason` is ignored. `placement_weight` is optional and prices the
 * placement in the same call — omitted leaves the current weight untouched;
 * present it must be 0..MAX_FEED_PLACEMENT_WEIGHT. */
export interface FeedReviewInput {
  approve: boolean;
  rejection_reason?: string;
  placement_weight?: number;
}

// ---- Schedule --------------------------------------------------------------

/** One weekday's working hours (admin.workingHoursResponse). day_of_week is
 * 0..6; the backend does not fix the week-start, so the UI labels 0 as Sunday
 * (JS Date convention) — confirm against seeded data. Times are "HH:MM" or
 * "HH:MM:SS" strings, null when closed. */
export interface WorkingHours {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

/** A special-day override (admin.scheduleOverrideResponse). A holiday can be
 * marked as a PAID booking day: booking_payment_required + deposit_amount_minor
 * (integer minor units — the UI shows/enters whole ₸). */
export interface ScheduleOverride {
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
  booking_payment_required: boolean;
  deposit_amount_minor: number | null;
}

/** GET /admin/restaurants/:id/schedule (admin.scheduleResponse). */
export interface Schedule {
  working_hours: WorkingHours[];
  overrides: ScheduleOverride[];
}

/** Upsert payload for a single override (admin.scheduleOverrideRequest). */
export interface ScheduleOverrideInput {
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
  booking_payment_required: boolean;
  deposit_amount_minor: number | null;
}

// ---- Guests ----------------------------------------------------------------

/** One aggregated guest row (admin.guestResponse). Read-only. */
export interface AdminGuest {
  user_id: string | null;
  name: string;
  phone: string;
  phone_normalized: string;
  email: string;
  bookings_count: number;
  visits_count: number;
  first_booking_at: string;
  last_booking_at: string;
}

/** Filters for the admin event/promo listings. */
export interface AdminListParams {
  statuses?: string[];
  page?: number;
  per_page?: number;
}

// ---- Web push subscriptions ------------------------------------------------

/** The browser PushSubscription reduced to the backend's expected shape
 * (pushsubscriptions.registerRequest). `p256dh` and `auth` are base64url
 * (URL-safe, no padding) — the encoding webpush-go decodes with
 * base64.RawURLEncoding, which is also what the browser produces. */
export interface PushSubscriptionInput {
  restaurant_id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ---- Booking policy / capacity mode ----------------------------------------

/**
 * How a venue accounts for occupancy (domain.CapacityMode, migration 0054).
 *
 * `tables` — a booking is seated at a concrete table and the GiST exclusion
 * constraint on booking_tables is the authority.
 * `seats` — the venue declares a total number of seats and bookings are
 * counted against per-slot capacity buckets; no tables are involved.
 */
export type CapacityMode = "tables" | "seats";

/** The policy actually in force = global defaults with the venue's overrides
 * applied (bookings.effectiveBookingPolicy). Read-only. */
export interface EffectiveBookingPolicy {
  timezone: string;
  booking_duration_minutes: number;
  booking_buffer_minutes: number;
  booking_lead_minutes: number;
  booking_horizon_days: number;
  cancel_deadline_minutes: number;
  confirm_sla_minutes: number;
  max_guests_per_booking: number;
  auto_confirm: boolean;
  capacity_mode: CapacityMode;
  capacity_seats: number;
}

/** What the venue has explicitly overridden; `null` = "inherit the default"
 * (bookings.bookingPolicyOverrideBlock). */
export interface BookingPolicyOverrides {
  timezone: string | null;
  booking_duration_minutes: number | null;
  booking_buffer_minutes: number | null;
  booking_lead_minutes: number | null;
  booking_horizon_days: number | null;
  cancel_deadline_minutes: number | null;
  confirm_sla_minutes: number | null;
  max_guests_per_booking: number | null;
  auto_confirm: boolean | null;
  booking_capacity_mode: CapacityMode | null;
  booking_capacity_seats: number | null;
}

/** GET /admin/restaurants/:id/booking-policy (bookings.bookingPolicyResponse). */
export interface BookingPolicy {
  restaurant_id: string;
  effective: EffectiveBookingPolicy;
  overrides: BookingPolicyOverrides;
}

/**
 * PATCH body. Every field is optional and an OMITTED key means "leave that
 * column alone" — the server models them as Go pointers (bookings/request.go:
 * bookingPolicyRequest), and a body with no field at all is a 422. Send only
 * what the staff member actually changed.
 */
export interface BookingPolicyPatch {
  booking_capacity_mode?: CapacityMode;
  booking_capacity_seats?: number;
}

// ---- Platform dashboard (superadmin) ---------------------------------------
//
// These four shapes back the platform-wide dashboard, NOT the venue panel. The
// backend gates them on the global admin role (dashboard.RegisterRoutes) and
// they carry no restaurant scope: they answer "how is BookEat doing", not "how
// is this venue doing".

/** GET /admin/dashboard/overview. Counters, no period. */
export interface PlatformOverview {
  total_restaurants: number;
  active_restaurants: number;
  total_users: number;
  total_bookings: number;
  bookings_last_7_days: number;
  bookings_last_30_days: number;
}

/** One row of the status breakdown. The backend returns an ARRAY of
 * {status, count} objects, not a status->count map — writing it as a map
 * rendered every card as "[object Object]" with an array index for a title. */
export interface PlatformBookingStatus {
  status: string;
  count: number;
}

/** GET /admin/dashboard/bookings. Counts by booking status over a period. */
export interface PlatformBookings {
  from: string;
  to: string;
  total: number;
  by_status: PlatformBookingStatus[];
}

/** One side of the money report. Amounts are integer MINOR units (tiyn), never
 * floats — format at the edge, never do arithmetic on a formatted string. */
export interface PlatformMoney {
  amount_minor: number;
  count: number;
}

/** GET /admin/dashboard/payments. Captured is gross volume through the
 * acquirer, not platform revenue. */
export interface PlatformPayments {
  from: string;
  to: string;
  currency: string;
  captured: PlatformMoney;
  refunded: PlatformMoney;
}

/** One row of GET /admin/dashboard/top-restaurants. */
export interface TopRestaurant {
  restaurant_id: string;
  name: string;
  bookings_count: number;
  gmv_minor: number;
}

/** ---- Платформенный список гостей -------------------------------------
 *
 * Гость здесь — ЧЕЛОВЕК, а не аккаунт: половина броней сделана без
 * регистрации, и такой человек всё равно гость. Отсюда две особенности строки:
 * `user_id` может быть null (бронировал без аккаунта), а счётчики броней могут
 * быть нулями (зарегистрировался и не дошёл) — и это факт, а не «нет данных».
 */
export interface PlatformGuest {
  /** Нормализованный номер, он же идентичность строки. */
  phone: string;
  name: string;
  email?: string;
  city?: string;
  language?: string;
  /** null у гостя без регистрации. */
  user_id: string | null;
  /** null у гостя без регистрации. */
  registered_at: string | null;

  bookings_count: number;
  visits_count: number;
  cancelled_count: number;
  no_show_count: number;
  /** В скольких РАЗНЫХ заведениях бронировал. */
  venues_count: number;

  first_booking_at: string | null;
  last_booking_at: string | null;
}

/** Готовые срезы списка. Названы по вопросу, на который отвечают. */
export type PlatformGuestSegment =
  | "all"
  | "registered"
  | "booked"
  | "visited"
  | "never_visited"
  | "no_bookings"
  | "cancelled";

export type PlatformGuestSort = "last_booking" | "bookings" | "registered";

/** Фильтры списка. Пустые поля не отправляются — сервер поймёт это как
 * «фильтра нет»; отправленное пустое значение он бы принял за фильтр. */
export interface PlatformGuestQuery {
  search?: string;
  segment?: PlatformGuestSegment;
  city?: string;
  language?: string;
  registered_from?: string;
  registered_to?: string;
  booked_from?: string;
  booked_to?: string;
  min_bookings?: number;
  sort?: PlatformGuestSort;
  page?: number;
  per_page?: number;
}

/** Period filter shared by the three period-scoped dashboard calls. Omitted
 * values let the backend apply its own defaults (a look-back window ending
 * now) — the client does not invent dates. */
export interface PlatformPeriod {
  from?: string;
  to?: string;
}

// ---- Venue dashboard (one restaurant's own numbers) -------------------------
//
// Separate from the platform dashboard above: these are venue-scoped, gated by
// RequireRestaurantManager, and answer "how is MY venue doing" rather than "how
// is BookEat doing".

/** One status bucket of the venue's bookings. */
export interface VenueStatusCount {
  status: string;
  count: number;
}

/** One row of the cancellation breakdown. An EMPTY reason is not missing data:
 * it is the count of cancellations nobody gave a reason for, which is usually
 * the largest row and the one worth acting on. */
export interface VenueCancelReason {
  reason: string;
  count: number;
}

/** GET /restaurants/:id/dashboard/summary. */
export interface VenueDashboardSummary {
  from: string;
  to: string;
  total: number;
  by_status: VenueStatusCount[];
  /** Cancelled + no-show as a percentage of total, one decimal. 0 when the
   * period had no bookings — never a division by zero. */
  cancelled_share: number;
  avg_party_size: number;
  cancel_reasons: VenueCancelReason[];
  preorder_bookings: number;
  /** Integer minor units (tiyn), like every other amount in this API. */
  preorder_total_minor: number;
}

/** One cell of the load chart. weekday follows time.Weekday (0 = Sunday), the
 * same convention the schedule screen uses. Hour is the venue's LOCAL hour. */
export interface VenueLoadSlot {
  weekday: number;
  hour: number;
  bookings: number;
  guests: number;
}

/**
 * One row of GET /restaurants/:id/dashboard/today
 * (venuedashboard.todayRows / domain.VenueTodayBooking).
 *
 * Deliberately NOT an AdminBooking: the read model returns only the eight
 * fields the operational screen renders, so a row here has no email, source,
 * notes or cancellation fields. Do not widen it to AdminBooking "for
 * convenience" — the server does not send the rest.
 */
export interface VenueTodayBooking {
  id: string;
  /** RFC3339 instant when the guest is expected. */
  starts_at: string;
  name: string;
  /** The raw phone the guest typed — dial it, do not re-format it into
   * something the venue cannot compare with what the guest reads back. */
  phone: string;
  guests: number;
  status: BookingStatus;
  /** RFC3339 instant the request arrived — the clock waiting_minutes runs on. */
  created_at: string;
  /**
   * Whole minutes between created_at and the moment the SERVER rendered the
   * view, so every device agrees. Never negative. Meaningful for `awaiting`
   * rows; on an answered booking it is merely the age of the record.
   */
  waiting_minutes: number;
  /** Блюда, заказанные заранее. Пустой массив у брони без предзаказа. */
  preorder: AdminBookingPreorderItem[];
}

/**
 * GET /restaurants/:id/dashboard/today — the operational top of the venue
 * panel. Takes no period: "today" is the venue's own local calendar day,
 * resolved server-side against the venue timezone.
 */
export interface VenueToday {
  /** Requests still unanswered (status `pending`), OLDEST FIRST — and not only
   * today's: a request for Saturday needs an answer now. */
  awaiting: VenueTodayBooking[];
  /** How many unanswered requests exist BEFORE `awaiting_limit` truncated the
   * list — the number the badge shows. */
  awaiting_total: number;
  /** Every live booking of the venue's local day, in time order. Cancelled
   * ones are left out; no-shows and completed ones stay. */
  today: VenueTodayBooking[];
  today_total: number;
  /** Heads expected across the WHOLE local day, not just the rows above: a
   * truncated list must not shrink the headcount with it. */
  guests: number;
}

/** Optional limits on the today view. Absent means the server default
 * (20 awaiting / 50 today); a non-positive value is a 422, not a default. */
export interface VenueTodayParams {
  awaiting_limit?: number;
  today_limit?: number;
}

// ---- Gastroguide (superadmin editor) ---------------------------------------

/**
 * A guide collection's publication state (domain.GuideCollectionStatus).
 *
 * Note it is NOT the promo/event triple: there is no "hidden", and "archived"
 * is not the same thing — an archived collection was live once and keeps its
 * venue links so it can be brought back, which is why the editor's badge and
 * the promos badge cannot be the same component.
 */
export type GuideCollectionStatus = "draft" | "published" | "archived";

/** A localized field's translation map ({"kk": "...", "en": "..."}). The base
 * ru value lives in the plain column beside it; a missing key falls back to it,
 * so an empty string here is never sent — it would make the app render blank. */
export type I18nMap = Record<string, string>;

/** A guide rubric as the editor sees it (GET /admin/gastroguide/categories).
 * Unlike the guest read this includes switched-off rubrics. */
export interface GuideCategory {
  id: string;
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  position: number;
  is_active: boolean;
}

/** Body of POST/PUT /admin/gastroguide/categories. */
export interface GuideCategoryInput {
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  position: number;
  is_active: boolean;
}

/** A collection row in the editor's list. */
export interface GuideCollection {
  id: string;
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  subtitle: string;
  subtitle_i18n?: I18nMap;
  description: string;
  description_i18n?: I18nMap;
  cover_image_url: string | null;
  /** null means the collection is shown in every city. */
  city: string | null;
  status: GuideCollectionStatus;
  published_at: string | null;
  position: number;
  /**
   * How many venues a GUEST can open right now — not how many the editor
   * attached. A collection holding a deactivated venue reports fewer than it
   * shows in the detail, and that difference is the point: it is the same
   * number the app displays.
   */
  venue_count: number;
  category_slugs: string[];
  updated_at: string;
}

/** One venue inside a collection, as the editor sees it. */
export interface GuideCollectionVenue {
  restaurant_id: string;
  position: number;
  note: string;
  note_i18n?: I18nMap;
  name: string;
  address: string;
  cuisine_type: string;
  city: string;
  price_category: string;
  primary_image_url: string | null;
  /**
   * The venue's catalog state. False means the venue is currently invisible to
   * guests and does not count towards venue_count — the editor keeps the
   * curation (deactivation is routinely temporary), but has to be able to SEE
   * that the slot is dark.
   */
  is_active: boolean;
}

/** GET /admin/gastroguide/collections/:id — the collection plus everything in it. */
export interface GuideCollectionDetail extends GuideCollection {
  venues: GuideCollectionVenue[];
  categories: GuideCategory[];
}

/**
 * Body of POST/PUT /admin/gastroguide/collections — a FULL replace of the
 * editable fields.
 *
 * Status and published_at are deliberately absent: publication is its own set
 * of endpoints, so fixing a typo can never take a collection live or pull it
 * down. `city: null` means "every city".
 */
export interface GuideCollectionInput {
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  subtitle: string;
  subtitle_i18n?: I18nMap;
  description: string;
  description_i18n?: I18nMap;
  cover_image_url: string | null;
  city: string | null;
  position: number;
}

/** Query of the editor's collection listing. */
export interface GuideCollectionListParams {
  /** Empty/omitted = every status. */
  status?: GuideCollectionStatus[];
  city?: string;
  q?: string;
  page?: number;
  per_page?: number;
}

/** One row of the venue catalog search used when attaching a venue
 * (GET /restaurants/search — the public catalog endpoint, reused here). */
export interface VenueSearchResult {
  id: string;
  name: string;
  address: string;
  cuisine_type: string;
  city: string;
  price_category: string;
  is_active: boolean;
  primary_image?: string | null;
}
