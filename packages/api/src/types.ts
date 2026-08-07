export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * День недели ровно в той нумерации, в которой его присылает сервер:
 * **0 = воскресенье**, 6 = суббота (совпадает с `Date.prototype.getDay()`).
 * Понедельник-первый порядок — это дело отрисовки, а не модели.
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Ключи словаря `t.weekdays`, разложенные по `DayOfWeek` (индекс 0 — вс). */
export const WEEKDAY_BY_DAY_OF_WEEK: readonly Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/** Понедельник-первый порядок для отрисовки недели (RU-конвенция). */
export const WEEK_ORDER_MONDAY_FIRST: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

/**
 * Один день недели в графике заведения.
 *
 * Три РАЗНЫХ состояния, которые нельзя схлопывать:
 *   - `isOpen: true` + время — рабочий день;
 *   - `isOpen: false` — настоящий выходной (сервер прислал день и сказал, что
 *     он нерабочий; `opensAt`/`closesAt` при этом приходят пустыми);
 *   - дня вообще нет в `VenueSchedule.days` — про этот день НИЧЕГО не
 *     известно. Это не выходной.
 */
export interface ScheduleDay {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  /** "12:00". null — заведение открыто, но время не записано (или выходной). */
  opensAt: string | null;
  closesAt: string | null;
  /**
   * Заведение работает за полночь: `12:00–01:00` с этим флагом значит «до часу
   * ночи следующего дня», а не «закрылось через час после открытия».
   */
  closesNextDay: boolean;
}

/**
 * График работы заведения — то, что присылает сервер, без нашей
 * интерпретации.
 *
 * ЖЁСТКОЕ ПРАВИЛО: `openNow` считает СЕРВЕР в таймзоне самого заведения.
 * Клиент не пересчитывает его и не выводит «открыто» из `opensAt`/`closesAt`
 * — именно эта самодеятельность и была багом (см. bugs/
 * bookeat-frontend-invented-data-in-catalog.md, раздел «осталось нечинёным»).
 */
export interface VenueSchedule {
  /** IANA-зона заведения, например "Asia/Almaty". */
  timezone: string;
  /** true/false — ответ сервера. null — сервер не сказал (поле не булево). */
  openNow: boolean | null;
  /** Только те дни, которые сервер прислал. Отсутствие дня = неизвестно. */
  days: ScheduleDay[];
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
  /** Необязательно: у заведения может не быть ни одной картинки (в тестовом
   * каталоге такое одно из 20, проверено curl'ом 2026-07-27). Раньше на это
   * место подставлялась ссылка на СТОРОННИЙ сервис placehold.co — то есть
   * приложение ходило в чужой домен за серой плашкой и без интернета не
   * показывало ничего. Теперь «фото нет» — это отсутствие поля, и рисует его
   * само приложение (см. components/PhotoView.tsx), тем же правилом, что уже
   * действует для блюд без фото. */
  coverPhoto?: Photo;
  photos: Photo[];
  promoBanners: PromoBanner[];
  menuHighlights: MenuHighlight[];
  /**
   * Свободнотекстовая строка `opening_hours` — то, что заведение написало о
   * себе само («Пн-Вс 12:00–01:00, Пт–Сб до 02:00»).
   *
   * Экран показывает её ТОЛЬКО когда структурного графика нет (`schedule ===
   * null`): тогда это единственное, что мы знаем, и подписано как слова
   * заведения. Разбирать её на часы нельзя — на этом и стоял старый баг.
   */
  openingHoursText: string;
  /** Структурный график с сервера. null — часы работы у заведения НЕ ЗАПИСАНЫ
   * (ключа `schedule` в ответе нет). Это «неизвестно», а не «закрыто». */
  schedule: VenueSchedule | null;
  tables: RestaurantTable[];
  description: string;
  /**
   * Может ли сервер вообще выдать слот по этому заведению
   * (`accepts_online_bookings`). false — слотов не будет ни на одну дату, и
   * гостю нужно сказать это ДО выбора даты. На тестовом каталоге таких 17 из
   * 24 (проверено curl'ом 2026-07-26).
   */
  acceptsOnlineBookings: boolean;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  cuisines: Cuisine[];
  priceLevel: PriceLevel;
  rating: number;
  reviewsCount: number;
  address: string;
  /** Plain-text venue description. The listing/search endpoint carries the same
   * `description` field the detail read does (only images/features/tags/social
   * are detail-only — see http-mapping ApiRestaurant). Used as a 2-line muted
   * line on the search card. May be empty when the venue left it blank. */
  description: string;
  /** См. Restaurant.coverPhoto — может отсутствовать. */
  coverPhoto?: Photo;
  /** См. Restaurant.schedule — листинг, поиск и избранное отдают то же поле. */
  schedule: VenueSchedule | null;
  /** См. Restaurant.acceptsOnlineBookings. Есть и в списке, и в деталке. */
  acceptsOnlineBookings: boolean;
}

export interface SearchFilters {
  cuisineIds: string[];
  minRating?: number;
  /**
   * «Открыто сейчас» — фильтр по СЕРВЕРНОМУ `schedule.open_now`. Заведение без
   * графика под него не попадает: мы не знаем, открыто ли оно, а фильтр
   * обещает именно открытые.
   */
  openNowOnly: boolean;
  /** «Можно забронировать онлайн» — по `accepts_online_bookings`. По умолчанию
   * выключен: 17 из 24 заведений каталога брони не принимают, и прятать их
   * молча — то же враньё, только умолчанием. */
  onlineBookableOnly: boolean;
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
  onlineBookableOnly: false,
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

/**
 * One promo "story" — an Instagram-highlight-style card the venue pins to its
 * screen (`GET /restaurants/:id/stories`). The rail under the Обзор/Фото tabs
 * shows them in `sortOrder` ascending, and tapping one opens the fullscreen
 * viewer.
 */
export interface RestaurantStory {
  id: string;
  /** Absolute URL of the story image. The backend never returns a story
   * without one, but the mapper still drops any that arrives blank rather than
   * drawing an empty red-bordered tile. */
  imageUrl: string;
  /** Overlaid caption, or `null` when the venue left it blank — the API omits
   * the key entirely in that case, and the card then shows just the image. */
  caption: string | null;
  /** The venue's own ordering. Ties keep the server's array order. */
  sortOrder: number;
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

/**
 * The answer to "send me a code".
 *
 * `devCode` is the server's own debug echo: the OTP usecase returns the code in
 * the response body ONLY when the deployment sets `AUTH_OTP_DEV_EXPOSE=true`
 * (internal/usecase/auth/otp.go). It is absent on the test backend — verified
 * by curl on 2026-07-26 — so nothing may depend on it, and it is never shown
 * in a production bundle.
 */
export interface OtpRequest {
  /** The server accepted the request and handed the code to its delivery
   * waterfall. It does NOT mean anything was actually delivered. */
  sent: boolean;
  devCode: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  /**
   * The number the account is keyed on. NOT editable anywhere: `PATCH
   * /users/me` has no phone field at all (users/request.go: updateMeRequest),
   * and OTP sign-in finds-or-creates the account BY this number, so changing
   * it would mean a different account. Shown, never offered for editing.
   */
  phone: string | null;
  /** Free-form city string on the account. `null` when never filled in — the
   * backend has no city dictionary behind this column. */
  city: string | null;
  /** Plain calendar date, "YYYY-MM-DD", or null. Never a timestamp. */
  birthDate: string | null;
}

/**
 * The subset of `PATCH /users/me` this app sends. Every key is optional and
 * means "change this"; an ABSENT key means "leave it alone" — that is the
 * server's own semantics (pointer fields), so the caller must diff against
 * the current profile and send only what the guest actually changed.
 *
 * Deliberately narrower than the endpoint. The endpoint also accepts
 * `avatar_url`, `preferred_language`, `country_code` and
 * `cuisine_category_ids`; none of them has an honest source in this app today
 * (no upload endpoint, one shipped locale, no ISO-country list, and the
 * cuisine ids are `restaurant_categories` UUIDs the guest app never receives —
 * its cuisine chips are built from free-text `cuisine_type` strings). They are
 * left out rather than guessed at.
 *
 * Note there is NO way to clear `birthDate` through this API: the field is a
 * `*string` parsed with time.Parse, so `null` means "unchanged" and `""` is a
 * 422. Callers must not offer a "remove" action for it.
 */
export interface ProfileUpdate {
  fullName?: string;
  /** `""` clears the city (null would mean "leave unchanged"). */
  city?: string;
  /** "YYYY-MM-DD". */
  birthDate?: string;
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

/**
 * One promo of the cross-venue home feed (`GET /feed?city=…`, items with
 * `kind: "promo"`) — the Home «Акции» strip. The feed also carries `event`
 * items, which this type deliberately does NOT model: the promotions section
 * reads only promos (see RestaurantRepository.getPromotions), and the events
 * strip has its own `/events` endpoint.
 *
 * Shape read from the feed contract, not guessed: `restaurant_name`,
 * `cover_image_url` and `discount_percent` may all be ABSENT from a promo item,
 * so each degrades to an empty/`null` value here rather than to a thrown mapper.
 */
export interface HomePromo {
  id: string;
  restaurantId: string;
  /** Host venue name, shown as the card subtitle. Empty when the feed omits it. */
  restaurantName: string;
  title: string;
  description: string;
  /** RFC3339 campaign window. Present on the feed but not shown on the card today. */
  startsAt: string;
  endsAt: string;
  /** Null when the promo carries no cover — the card shows its photo placeholder. */
  coverImageUrl: string | null;
  /** Percentage for the «−N%» badge, or `null` when the feed omits it (no badge). */
  discountPercent: number | null;
}

/**
 * One editorial collection of venues — the guest-facing «Статьи» feature, which
 * maps to the backend's GASTROGUIDE (`GET /gastroguide/collections`). This is
 * the LIST shape (card): the venues themselves are only on the detail read
 * (`GuideCollectionDetail`).
 *
 * There is NO author field anywhere in the payload: this is editorial content
 * and the byline is a constant («От BookEat»), supplied by the UI, not the API —
 * so no fabricated critic name ever appears. `subtitle`, `description` and
 * `coverImageUrl` may all be absent server-side and degrade to empty/`null`.
 */
export interface GuideCollection {
  /** Stable identifier used in the URL (`/articles/:slug`) and as the list key. */
  slug: string;
  title: string;
  /** One-line strapline under the title. Empty when the collection omits it. */
  subtitle: string;
  /** Editorial blurb shown on the detail screen. Empty when absent. */
  description: string;
  /** Null when the collection has no cover — the card shows its placeholder. */
  coverImageUrl: string | null;
  /** How many venues the collection holds, for a subtitle/count without
   * fetching the whole detail. */
  venueCount: number;
  /** Cuisine/category slugs the collection is tagged with. Empty when absent. */
  categorySlugs: string[];
}

/**
 * One venue inside a collection's detail read. Carries just enough to render a
 * venue block and open the restaurant screen (`/restaurant/:restaurantId`).
 *
 * There is deliberately NO `instagram` (or any social link) here: the payload
 * carries only the postal `address`, so the block shows the address and nothing
 * social is invented. `note` is the collection's editorial line about this
 * venue (why it made the list); empty when the editor left it blank.
 */
export interface GuideCollectionVenue {
  restaurantId: string;
  name: string;
  /** The editor's note about this venue — the block's description line. Empty
   * when absent. */
  note: string;
  address: string;
  /** Empty when the venue has no cuisine recorded — the block hides the line. */
  cuisineType: string;
  city: string;
  /** «₸»/«₸₸»/«₸₸₸» tier, empty when unset. */
  priceCategory: string;
  /** `primary_image_url` of the venue, or `null` when it has no photo. */
  imageUrl: string | null;
}

/**
 * A single collection with its venues — the «Статья» detail read
 * (`GET /gastroguide/collections/:slug`). Extends the card shape with the
 * ordered venue blocks.
 */
export interface GuideCollectionDetail extends GuideCollection {
  /** Venues in the collection's own order (the backend returns them by
   * `position`); rendered as received. */
  venues: GuideCollectionVenue[];
}

/**
 * Platforms the backend accepts for a device push token
 * (`domain.ValidDevicePlatform`: ios, android, web). "web" is listed because
 * the column allows it, NOT because this app ever sends it — see
 * `describePushSupport` in the mobile app: the web build has no Expo push
 * token to register.
 */
export type DevicePlatform = "ios" | "android" | "web";

/** Body of `POST /devices/push-tokens`. */
export interface RegisterPushTokenInput {
  /** The provider token, verbatim ("ExponentPushToken[…]" today). The server
   * caps it at 512 characters and validates nothing else about its shape —
   * the provider owns that format. */
  token: string;
  platform: DevicePlatform;
}
