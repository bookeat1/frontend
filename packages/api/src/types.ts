import type { TimeOfDay } from "./time-of-day";

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

/**
 * Числовой диапазон среднего чека в тенге (МАЖОРНЫЕ единицы, не тийины:
 * `{ min: 4000, max: 9000 }` = «4 000–9 000 ₸»). Бэкенд отдаёт его в поле
 * `price_range` рядом с символьной ступенью `price_category` и ОПУСКАЕТ,
 * когда не задан. Поэтому поле необязательное: у большинства заведений
 * диапазона ещё нет, и UI обязан откатываться на ступень `priceLevel`.
 */
export interface PriceRange {
  min: number;
  max: number;
}

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

/**
 * Кухня, как её видит гость.
 *
 * `id` — это ЗНАЧЕНИЕ ФИЛЬТРА, а не первичный ключ. Для записи справочника
 * (`GET /cuisines`) это её `code` — латиница вроде `european`: ровно то, что
 * понимает `GET /restaurants/search?cuisine=`. У заведения, которому кухни в
 * справочнике ещё не проставили, остаётся старый способ — casefold текстового
 * `cuisine_type` (кириллица). Пересечься эти два набора не могут, так что
 * перепутать код со старой строкой нельзя, и сервер понимает обе формы
 * (проверено на бою 2026-08-25: `?cuisine=european`, `?cuisine=EUROPEAN`,
 * `?cuisine=европейская` и `?cuisine=european,kazakh` отвечают одинаково).
 *
 * UUID записи справочника мобильному приложению не нужен: он ничего не пишет,
 * а фильтрует по коду — поэтому в тип не заводится.
 */
export interface Cuisine {
  id: string;
  name: string;
  /** Картинка кухни из справочника (`image_url`). Отсутствует, когда
   * справочник её не прислал — тогда круг на главной берёт вшитую в
   * приложение (см. cuisine-photos.ts). */
  imageUrl?: string;
}

/**
 * Удобство заведения из справочника платформы (`GET /venue-features`) —
 * «Терраса», «Wi-Fi», «Намазхана».
 *
 * `id` — это ЗНАЧЕНИЕ ФИЛЬТРА, а не первичный ключ: `code` записи справочника
 * (`terrace`, `prayer_room`), ровно то, что понимает серверный параметр
 * `?features=`. UUID записи мобильному приложению не нужен — он ничего не
 * пишет.
 *
 * `name` уже переведён СЕРВЕРОМ по `Accept-Language` (проверено на бою
 * 2026-08-25: ru «Парковка», en «Parking», kk «Тұрақ»); справочник заодно
 * отдаёт `name_i18n`, и репозиторий берёт из него подпись, когда язык
 * приложения известен, — чтобы подпись не зависела от того, дошёл ли заголовок.
 */
export interface Amenity {
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
  /**
   * Та же цена ЧИСЛОМ, в тиынах (`price_minor` в ответе сервера) — только для
   * арифметики: «Добавить · цена × количество» в карточке блюда.
   *
   * `null`, а не 0, когда сервер числа не дал (старая сборка бэкенда или цена,
   * которую он не смог перевести): 0 читался бы как «бесплатно», а разбирать
   * строку «8 990 ₸» обратно в деньги — придумывать деньги. На `null` кнопка
   * «Добавить» остаётся выключенной.
   */
  priceMinor: number | null;
  /**
   * Заведение отметило это блюдо само (`is_top_pick`), а не оно попало в ленту
   * добивкой из остального меню. Сервер уже поставил отмеченные вперёд —
   * порядок ленты пересобирать по этому флагу НЕЛЬЗЯ; он существует, чтобы
   * карточку можно было отличить визуально, когда дизайн этого попросит.
   */
  isTopPick: boolean;
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
  /** Числовой диапазон среднего чека, если бэкенд его прислал. Опущен у
   * заведений без данных — тогда показывается символьная ступень `priceLevel`. */
  priceRange?: PriceRange;
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
  /** См. Restaurant.priceRange — листинг, поиск и избранное отдают то же поле. */
  priceRange?: PriceRange;
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
  /**
   * Блюдо, из-за которого заведение попало в выдачу поиска.
   *
   * Приходит ТОЛЬКО от `GET /restaurants/search` и только когда совпадение
   * случилось по меню: поиск по названию заведения поле не присылает вовсе
   * (проверено на тестовом бэкенде 2026-08-28: «паста» → 8 заведений, у
   * каждого своё блюдо — Social Coffee «Паста с митболами из ягненка»).
   * Листинг, избранное и деталка его не отдают, поэтому поле необязательное.
   */
  matchedDish?: MatchedDish;
}

/** Блюдо из меню, по которому сработал поиск: ровно то, что отдаёт сервер в
 * `matched_dish`. Отдельный тип, а не инлайн-объект — его читают и карточка, и
 * тесты маппинга. */
export interface MatchedDish {
  id: string;
  name: string;
}

export interface SearchFilters {
  cuisineIds: string[];
  /**
   * Удобства («Терраса», «Wi-Fi»), значения — коды справочника
   * `GET /venue-features`. Уходят СЕРВЕРУ параметром `?features=a,b`, и
   * семантика у него И, а не ИЛИ: выбрал два — заведению нужны оба (проверено
   * на бою 2026-08-25: terrace 4, wifi 3, terrace,wifi 2). Пустой массив —
   * фильтра нет.
   *
   * Раньше эти значения жили отдельным состоянием на экране поиска («фасеты,
   * которые никуда не уходят») и в запрос не попадали вовсе — гость
   * фильтровал, а выдача не менялась.
   */
  amenityIds: string[];
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
  /**
   * «Есть стол на N гостей в этот день» — считается СЕРВЕРОМ тем же движком,
   * что рисует сетку времени на экране брони (backend
   * usecase/bookings.AvailabilitySearch).
   *
   * Клиент этот фильтр повторить не может и не должен: у него нет ни столов,
   * ни чужих броней. Поэтому, в отличие от openNowOnly, здесь нет запасного
   * варианта «отфильтруем на месте» — если сервер не ответил, поиск честно
   * падает с ошибкой, а не показывает неотфильтрованный список.
   */
  availability?: AvailabilityFilter;
}

export interface AvailabilityFilter {
  /** Календарная дата YYYY-MM-DD в часовом поясе заведения. */
  date: string;
  guests: number;
  /** Окно времени "HH:MM". Оба поля необязательны: без них — весь день. */
  timeFrom?: string;
  timeTo?: string;
  /**
   * Время суток («Утро»/«Обед»/«Ужин») — то, что человек выбирает чипом, а не
   * набирает часами. Разворачивается в то же серверное окно
   * `time_from`/`time_to` (`timeOfDayWindow` в time-of-day.ts), поэтому фильтр
   * СЕРВЕРНЫЙ и реально сужает выдачу — но, как и вся доступность, только
   * вместе с датой и числом гостей: без пары `date`+`guests` сервер окно
   * игнорирует.
   *
   * Когда задан, он ПЕРЕКРЫВАЕТ `timeFrom`/`timeTo`: два способа сказать одно
   * и то же не должны спорить между собой.
   */
  timeOfDay?: TimeOfDay;
}

/** Что можно поменять в существующей брони (`PATCH /bookings/:id`). Оба поля
 * необязательны, но пустой запрос бессмысленен — экран не даёт его отправить. */
export interface RescheduleBookingInput {
  /** RFC3339, начало визита. */
  startsAt?: string;
  guests?: number;
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
  amenityIds: [],
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
  /**
   * Where a swipe up on this story takes the guest (`action_url`), or `null`
   * when the venue left it blank — most stories have no link.
   *
   * ALWAYS an `http(s)` address by the time it gets here: the mapper drops
   * anything else, because this value is handed straight to `Linking.openURL`
   * and a `tel:`/`javascript:`/bare-word value from a bad row must never reach
   * it. A screen may treat `null` as "this story is not tappable".
   */
  actionUrl: string | null;
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

/**
 * Статусы, из которых бронь уже никуда не переходит: визит состоялся, гость
 * не пришёл или бронь отменена. Переписаны с того же `bookingTransitions` в
 * backend-core/internal/domain/booking.go — у этих трёх набор целей пустой,
 * и любой запрос на смену статуса отвечает 422.
 *
 * `arrived` СЮДА НЕ ВХОДИТ: гость за столом, визит идёт, и заказать что-то
 * ещё он может.
 *
 * Практический смысл на клиенте: у такой брони бессмысленны действия,
 * которые что-то меняют в предстоящем визите — предзаказ и меню в первую
 * очередь. Показывать их — обещать то, чего сервер уже не примет.
 */
export const TERMINAL_BOOKING_STATUSES = ["completed", "cancelled", "no_show"] as const;

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return (TERMINAL_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);
}

/**
 * Бронь, из которой стоит предложить «Забронировать снова» (правка владельца
 * 2026-08-26): визита не будет и уже не было.
 *
 * Три случая владельца — «истекла», «отменена», «не пришёл»:
 *   • `cancelled` и `no_show` — статусы, они есть у бэкенда;
 *   • «ИСТЕКЛА» статуса НЕ ИМЕЕТ. В `BookingStatus` его нет вовсе (список
 *     переписан с domain.BookingStatus), и придумывать его клиенту нельзя.
 *     Истёкшая бронь здесь — это бронь, которая так и осталась `pending`,
 *     `waitlist` или `confirmed`, а время визита уже прошло: заведение не
 *     ответило либо гость просто не пришёл, и статус никто не перевёл.
 *
 * `completed` СЮДА НЕ ВХОДИТ: визит состоялся, и предлагать «снова» поверх
 * удачного ужина — не то же самое, что предлагать замену несостоявшемуся.
 * `arrived` не входит по той же причине — гость был за столом.
 *
 * Граница по `endsAt`, а не по `startsAt`, — та же, что делит «Мои брони» на
 * активные и историю: идущий прямо сейчас ужин ещё не истёк.
 */
export function isRebookableBooking(booking: Booking, now: Date = new Date()): boolean {
  if (booking.status === "cancelled" || booking.status === "no_show") return true;
  if (booking.status === "completed" || booking.status === "arrived") return false;
  const endsAt = Date.parse(booking.endsAt);
  // Нечитаемая дата — не повод объявлять бронь истёкшей.
  return Number.isFinite(endsAt) && endsAt < now.getTime();
}

/** За сколько до начала визита гость ещё может отменить бронь сам. */
export const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Можно ли гостю отменить ЭТУ бронь прямо сейчас.
 *
 * Кроме статуса смотрит на время: за два часа до визита заведение уже держит
 * стол и готовится, поэтому поздняя отмена — разговор с рестораном, а не кнопка
 * в приложении (решение владельца 18.08.2026).
 *
 * Сервер остаётся последней инстанцией: он может отказать и раньше этого срока.
 * Здесь решается только то, показывать ли кнопку — чтобы она не обещала того,
 * чего не сделает.
 */
export function canGuestCancel(booking: Booking, now: Date = new Date()): boolean {
  if (!isCancellableBookingStatus(booking.status)) return false;
  const startsAt = Date.parse(booking.startsAt);
  if (Number.isNaN(startsAt)) return true; // время не разобрали — решает сервер
  return startsAt - now.getTime() > CANCEL_WINDOW_MS;
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
  /**
   * RFC3339 момент создания брони. Сервер отдаёт `created_at` в КАЖДОМ ответе
   * по броням (internal/transport/rest/bookings/response.go, поле не
   * опциональное), но старый ответ его не присылал, поэтому здесь `null` —
   * это «сервер не сказал», а не «брони не было».
   *
   * Нужен ровно для одного: посчитать, сколько бронь прожила до отмены.
   */
  createdAt: string | null;
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
  /**
   * The acquirer's hosted payment page (`https://pay.kaspi.kz/pay/…` for
   * Kaspi). Present once the acquirer answered Authorize; `null` on a payment
   * that never got one, and on any payment the link no longer applies to.
   * NEVER built on the client — a payment link is the acquirer's to issue.
   */
  paymentUrl: string | null;
  /**
   * RFC3339 deadline after which the link is dead, as the ACQUIRER set it.
   * The backend prefers the acquirer's own value over its configured HoldTTL
   * (`CreateForBooking` in internal/usecase/payments/create.go), so this is
   * the only honest thing to run a countdown against — a Kaspi link lives
   * minutes, not hours, and a longer client-side guess would put a live timer
   * on a dead link. `null` when the server sent none: show no countdown
   * rather than invent a deadline.
   */
  expiresAt: string | null;
}

/**
 * Body of `POST /bookings/:id/payment` (createPaymentRequest in
 * internal/transport/rest/payments/request.go). `return_url` is REQUIRED and
 * validated server-side; the acquirer webhook URL is built by the backend and
 * is deliberately not accepted from a client.
 */
export interface CreateBookingPaymentInput {
  /** Where the guest lands after the hosted payment page — our own deep link
   * back into the booking screen. Kaspi ignores it (its adapter never reads
   * ReturnURL), but the endpoint refuses an empty one. */
  returnUrl: string;
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
  /**
   * ЭТОТ вход создал аккаунт (`true`) или открыл существующий (`false`) —
   * поле `is_new_user` ответа `POST /auth/otp/verify`.
   *
   * `null` — «сервер не сказал», и это СЕГОДНЯШНЕЕ состояние боевого бэкенда:
   * `tokenPairResponse` (internal/transport/rest/auth/response.go) отдаёт
   * только три поля с токенами, хотя внутри `completeLogin`
   * (internal/usecase/auth/otp.go) ветка «создали» и ветка «нашли» различаются
   * явно. Поэтому здесь три значения, а не два: `null` означает незнание, и
   * экраны обязаны трактовать его как «не новый» — лишний шаг регистрации,
   * показанный давнему гостю, хуже, чем не показанный новому.
   *
   * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО: догадки по пустому профилю. «Имя не заполнено»
   * или «дата рождения не заполнена» — это НЕ признак нового аккаунта, а
   * признак незаполненного поля, и у давнего гостя оно тоже может быть пустым.
   */
  isNewUser: boolean | null;
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
   * The number the account is keyed on. NOT a `PATCH /users/me` field
   * (users/request.go: updateMeRequest has no phone) — OTP sign-in
   * finds-or-creates the account BY this number, so it can only be changed
   * through the dedicated re-verification flow: `requestPhoneChangeOtp` +
   * `confirmPhoneChange` (POST /users/me/phone/otp/request + /verify), which
   * proves the NEW number and returns the updated user.
   */
  phone: string | null;
  /** Free-form city string on the account. `null` when never filled in — the
   * backend has no city dictionary behind this column. */
  city: string | null;
  /**
   * Публичная ссылка на фотографию профиля, или null, если её не ставили.
   *
   * Ставится ТОЛЬКО через `uploadAvatar`: сервер сам кладёт файл в хранилище и
   * привязывает ссылку к владельцу токена. Поля `avatarUrl` в `ProfileUpdate`
   * нет намеренно — иначе клиент мог бы записать в профиль любой адрес, в том
   * числе чужой или вообще не картинку.
   */
  avatarUrl: string | null;
  /** RFC3339, когда аккаунт создан. Профиль показывает из него, сколько
   * человек с нами: это ЕГО срок, а не выдуманный «стаж». null у аккаунтов,
   * созданных до того, как сервер начал отдавать это поле. */
  createdAt: string | null;
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
 * Tags ("Бранч", "Живая музыка") are free-text labels the venue attaches to an
 * event. The backend now returns them as a top-level `tags` array on both the
 * listing and the detail; it is ALWAYS an array (`[]` when none, never null),
 * so the field here is a plain `string[]` — the chip row simply hides when empty.
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
  /** Extra photos in the editor's order, WITHOUT the cover (the backend keeps
   * the cover in its own column and returns the gallery beside it). Always an
   * array — `[]` on an event with no gallery, and on a server that predates
   * the feature, so the detail screen just shows the cover alone. */
  images: string[];
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
  /** Free-text labels shown as grey chips under the «venue · date» line.
   * Always an array — `[]` when the event has none (the chip row then hides). */
  tags: string[];
  /**
   * Series identifier of a RECURRING event, or null for a one-off.
   *
   * Верифицировано на проде 2026-08-19: публичный `GET /events` отдаёт
   * `recurrence_id` у каждого повторяющегося события. Поле нужно именно
   * сердечку: в избранное сохраняется СЕРИЯ, и сервер возвращает ближайшую
   * будущую дату серии — её `id` может отличаться от того, что гость сохранял.
   * Сравнение «сохранено ли» поэтому идёт по `recurrenceId`, когда он есть.
   */
  recurrenceId: string | null;
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
  /** Extra photos in the editor's order, WITHOUT the cover. Always an array —
   * `[]` for a promo with no gallery and on a server that predates the field. */
  images: string[];
  /** Percentage for the «−N%» badge, or `null` when the feed omits it (no badge). */
  discountPercent: number | null;
}

/* ------------------------------------------------------------------------ *
 * Favorites — venues, events and promos in one list
 * ------------------------------------------------------------------------ */

/** What a saved item IS. The wire calls it `kind`; it is also the `type=`
 * filter of `GET /favorites/items`. */
export type FavoriteKind = "restaurant" | "event" | "promo";

/**
 * A saved EVENT as the favorites endpoint returns it.
 *
 * Deliberately NOT `EventSummary`: the favorites payload is a different,
 * smaller shape (it carries `restaurant_name` / `city` flat instead of a
 * nested restaurant object, and no gallery, capacity or refund rules), and
 * pretending otherwise would mean inventing the missing halves.
 *
 * `recurrenceId` is the SERIES: a recurring event is saved as the series, and
 * the item resolves to the nearest upcoming occurrence — so `id` here can
 * differ from the id the guest tapped. Anything that asks «сохранено ли это
 * событие» must compare by `recurrenceId` first (see favoriteEventKey).
 */
export interface FavoriteEvent {
  id: string;
  restaurantId: string;
  /** Host venue name. Empty when the payload omits it. */
  restaurantName: string;
  city: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  /** Room / area inside the venue. Empty when absent. */
  venue: string;
  coverImageUrl: string | null;
  tags: string[];
  ticketed: boolean;
  /** Integer MINOR units (tiyin), null when the event sells no tickets. */
  ticketPriceMinor: number | null;
  isRecurring: boolean;
  /** Series id, or null for a one-off event. */
  recurrenceId: string | null;
}

/** A saved PROMO as the favorites endpoint returns it. `terms` («условия
 * акции») exists only here and on the promo detail — the home feed omits it. */
export interface FavoritePromo {
  id: string;
  restaurantId: string;
  restaurantName: string;
  city: string;
  title: string;
  description: string;
  terms: string;
  startsAt: string;
  endsAt: string;
  coverImageUrl: string | null;
  discountPercent: number | null;
}

/**
 * One row of `GET /favorites/items`, discriminated by `kind` — the payload
 * carries exactly one of the three entity fields, so the union is modelled the
 * way the wire is instead of with three optional properties.
 */
export type FavoriteItem =
  | { kind: "restaurant"; favoritedAt: string; restaurant: RestaurantSummary }
  | { kind: "event"; favoritedAt: string; event: FavoriteEvent }
  | { kind: "promo"; favoritedAt: string; promo: FavoritePromo };

/**
 * Tab counters. The server computes them for ALL kinds even when `type=` is
 * passed, which is why the tab row can be rendered from any one response and
 * switching a tab needs no request.
 */
export interface FavoriteCounts {
  all: number;
  restaurants: number;
  events: number;
  promos: number;
}

/** The whole `GET /favorites/items` answer. */
export interface FavoriteItems {
  items: FavoriteItem[];
  counts: FavoriteCounts;
}

/**
 * The key a heart compares itself by.
 *
 * ПОЧЕМУ НЕ ПРОСТО `id`: повторяющееся событие сохраняется целиком, как СЕРИЯ.
 * Сервер отдаёт в избранном ближайшую будущую дату этой серии, и её `id`
 * отличается от `id` той даты, на которой гость нажал сердечко. Сравнение по
 * `id` дало бы пустое сердечко на карточке, которая на самом деле сохранена
 * (и повторный PUT сохранил бы ту же серию второй раз). Поэтому ключ — это
 * `recurrence_id`, когда он есть, и `id` у разового события.
 */
export function favoriteEventKey(event: {
  id: string;
  recurrenceId: string | null;
}): string {
  return event.recurrenceId ?? event.id;
}

/**
 * Рубрика гастрогида (`GET /gastroguide/categories`) — плитка сетки «Подборки»
 * на экране гастрогида. Ровно то, что отдаёт гостевой ответ бэкенда
 * (`categoryResponse`): идентификатор, слаг, название и порядковый номер.
 *
 * ВНИМАНИЕ, ПРОБЕЛ В КОНТРАКТЕ: у рубрики на гостевом чтении НЕТ ни картинки,
 * ни подписи, хотя макет рисует плитку с фотографией и подзаголовком. Поэтому
 * поля тут нет — вымышленной обложке взяться неоткуда, плитка рисует
 * стандартную плашку «фото нет». Появится поле у бэкенда — добавится и сюда.
 */
export interface GuideCategory {
  /** Слаг — им же коллекция помечена в `categorySlugs`, поэтому он и ключ, и
   * связь между рубрикой и подборками. */
  slug: string;
  title: string;
  /** Порядок, заданный редакцией. Список приходит отсортированным, поле
   * оставлено, чтобы клиент с кэшем мог пересортировать сам. */
  position: number;
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
export type GuideCollectionKind = "collection" | "article";

export interface GuideCollection {
  /** Stable identifier used in the URL (`/articles/:slug` for an article,
   * `/gastroguide/collections/:slug` for a rubric collection) and as the list
   * key. Slugs are globally unique across BOTH kinds, which is why either
   * detail endpoint resolves any slug and old deep links keep working. */
  slug: string;
  /**
   * ЧТО ЭТО — ПОДБОРКА ГАСТРОГИДА ИЛИ СТАТЬЯ.
   *
   * Владелец развёл их как РАЗНЫЕ сущности (2026-08-28): у подборки есть
   * рубрики и она живёт на экране гастрогида, у статьи рубрик нет и она живёт
   * в разделе «Статьи». На бэкенде это одна таблица с колонкой `kind`, но две
   * ручки: `GET /gastroguide/collections` (только `collection`) и
   * `GET /articles` (только `article`).
   *
   * Поле ОБЯЗАТЕЛЬНОЕ в модели и НЕОБЯЗАТЕЛЬНОЕ на проводе: приложение
   * выходит раньше сервера, и ответ без `kind` должен читаться как подборка —
   * ровно то, чем все восемь опубликованных строк были до разделения.
   */
  kind: GuideCollectionKind;
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
 * The payload now carries the venue's own `instagram` (and only that social
 * link) because the design's last line reads «адрес · @инстаграм» — it is the
 * VENUE's handle, never an invented one, and empty when the venue has none.
 * `note` is the collection's editorial line about this venue (why it made the
 * list); empty when the editor left it blank.
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
  /** The VENUE's own instagram handle/URL, empty when it has none. The design
   * writes the block's last line as «адрес · @инстаграм»; the handle belongs
   * to the venue, so nothing is invented when the field is empty. */
  instagram: string;
  /** The event or promo this block is illustrated with, or `null` when the
   * block stays a plain venue card. */
  highlight: GuideHighlight | null;
}

/**
 * The event/promo shown INSIDE a collection block — the shape the «Статья»
 * design draws above the venue's address: a title, an editorial line and a rail
 * of photos.
 *
 * `kind` is what the tap routes on ("event" → the event card, "promo" → the
 * promo card); an unknown kind is dropped by the mapper rather than routed
 * somewhere wrong.
 */
export interface GuideHighlight {
  kind: "event" | "promo";
  id: string;
  title: string;
  /** Empty when the editor left the item without a description. */
  description: string;
  /** RFC3339 start of an event, empty for a promo or when absent. */
  startsAt: string;
  /** Null when the item has no cover. */
  coverImageUrl: string | null;
  /** Gallery WITHOUT the cover, in the editor's order. Always an array. */
  images: string[];
}

/**
 * A single collection with its venues — the «Статья» detail read
 * (`GET /gastroguide/collections/:slug`). Extends the card shape with the
 * ordered venue blocks.
 */
/**
 * Гастропрогулка — маршрут гастрогида (`GET /gastroguide/routes`).
 *
 * ЧЕМ ОТЛИЧАЕТСЯ ОТ ПОДБОРКИ. Подборка — это НАБОР заведений: порядок в ней
 * редакционный вкус, и если одно выпало, список просто короче. Маршрут —
 * ПОСЛЕДОВАТЕЛЬНОСТЬ остановок: третья точка бессмысленна без первой и второй,
 * а сама остановка может вообще не быть заведением (парк, базар, Кок-Тобе).
 * Поэтому это отдельная сущность, а не подборка с флагом.
 */
export interface GuideRoute {
  /** Стабильное имя в ссылке (`/routes/:slug`) и ключ списка. */
  slug: string;
  title: string;
  /** Редакционный текст под названием. Пустая строка, когда его нет. */
  description: string;
  /** null — обложки нет, карточка покажет свою заглушку. */
  coverImageUrl: string | null;
  /**
   * Строка под названием («1 день · 4 точки») — её ПИШЕТ РЕДАКТОР, а не
   * считает клиент: в ней бывает и «вечер», и «2 дня · 7 точек», и вычислить
   * её из количества точек значило бы потерять первую половину.
   */
  durationLabel: string;
  /** Сколько остановок в маршруте, чтобы не тянуть детальный ответ ради счёта. */
  pointCount: number;
}

/**
 * Остановка маршрута.
 *
 * ВЕТВИТЬСЯ НУЖНО ПО `venue`, А НЕ ПО `kind`. `kind` — это замысел редакции
 * («здесь у нас заведение»), а `venue` — то, что реально есть: у точки-заведения
 * заведение пропадает, если его погасили или удалили из каталога. Точка при
 * этом остаётся в маршруте со своим заголовком, текстом и координатами, потому
 * что выкинуть её значило бы молча сократить маршрут, у которого в подписи
 * по-прежнему написано «4 точки».
 */
export interface GuideRoutePoint {
  /** Идентификатор строки — ключ списка (одно заведение может встретиться
   * в маршруте дважды: кофе утром и ужин вечером). */
  id: string;
  /** Порядковый номер остановки, начиная с 1. Приходит уже отсортированным. */
  position: number;
  /** Замысел редакции. Для отрисовки карточки заведения смотрите на `venue`. */
  kind: "restaurant" | "place";
  /** Собственный заголовок остановки («Утро: Daily Coffee»), а не название
   * заведения. */
  title: string;
  /** Текст остановки. Пустая строка, когда его нет. */
  description: string;
  /** Своё фото остановки. null — у точки-заведения подставляем снимок
   * заведения, у обычного места показываем заглушку. */
  photoUrl: string | null;
  /** Свой адрес остановки. У места он единственный источник, у заведения
   * бывает пустым — тогда берём адрес заведения. */
  address: string;
  /** Живое заведение каталога или null. Именно наличие этого поля решает,
   * можно ли открыть экран заведения. */
  venue: GuideRouteVenue | null;
}

/** Заведение, привязанное к остановке: ровно столько, сколько нужно карточке
 * и переходу на `/restaurant/:id`. */
export interface GuideRouteVenue {
  id: string;
  name: string;
  address: string;
  cuisineType: string;
  city: string;
  priceCategory: string;
  imageUrl: string | null;
}

/** Маршрут с его остановками (`GET /gastroguide/routes/:slug`). */
export interface GuideRouteDetail extends GuideRoute {
  /** Остановки в порядке маршрута — бэкенд отдаёт их по `position`. */
  points: GuideRoutePoint[];
}

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

/* ------------------------------------------------------------------------ *
 * Notifications feed («Уведомления»)
 * ------------------------------------------------------------------------ */

/**
 * The kind of a single inbox item — drives the leading icon and the chip
 * filter on the «Уведомления» screen:
 *   - "booking"  → a confirmed/updated reservation (ForkKnife glyph)
 *   - "reminder" → a visit reminder (Bell glyph)
 *   - "promo"    → a discount/offer from a venue (Percent glyph)
 *
 * These are the three values `GET /notifications` emits in its `type` field.
 * A value the server grows later that this build does not know is mapped to a
 * neutral "reminder" rather than dropped — a bell is the generic notification
 * glyph, so an unknown item still shows honestly instead of vanishing.
 */
export type NotificationType = "booking" | "reminder" | "promo";

/**
 * One item of the guest notifications inbox, already mapped off the wire
 * (`created_at` → `createdAt`, `read` passed through).
 *
 * `bookingId` is the booking the notification is ABOUT, when it is about one:
 * tapping such a row opens that reservation. Null for anything that has no
 * booking behind it (a promo, a general reminder) — those rows only mark
 * themselves read. `restaurant_id` also travels on the wire and is still not
 * modelled: no screen opens a venue from the inbox yet.
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** RFC3339, server time. Rendered via the app's relative-time formatter. */
  createdAt: string;
  read: boolean;
  /** Booking this row is about, or null when it is about nothing openable. */
  bookingId: string | null;
}

/**
 * One page of the notifications feed (`GET /notifications?cursor=&limit=`).
 *
 * `unreadCount` is the WHOLE-inbox unread total the server reports, not just
 * the unread items on this page — it is what the home-header bell badge shows.
 * `nextCursor` is an opaque continuation token, or `null` on the last page;
 * v1 of the screen reads only the first page, but the field is carried so
 * infinite scroll is a later addition, not a reshape.
 */
export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
}
