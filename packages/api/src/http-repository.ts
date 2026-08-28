import {
  HttpClient,
  type ApiPage,
  type LanguageProvider,
  type TokenProvider,
  type UnauthorizedHandler,
} from "./http-client";
import { timeOfDayWindow } from "./time-of-day";
import {
  mapCuisine,
  mapAvailability,
  mapBooking,
  mapEventSummary,
  mapFavoriteItems,
  mapGuideCategories,
  mapGuideCollections,
  mapGuideRoutes,
  mapGuideRouteDetail,
  mapGuideCollectionDetail,
  mapHomePromos,
  mapMenuSections,
  MENU_HIGHLIGHT_LIMIT,
  mapNotificationFeed,
  mapPayment,
  mapPreorder,
  mapRestaurantDetail,
  mapRestaurantStories,
  mapRestaurantSummary,
  mapSession,
  mapUser,
  priceLevelToPriceCategory,
  type ApiAvailability,
  type ApiBooking,
  type ApiEventListItem,
  type ApiFavoriteItems,
  type ApiFeedItem,
  type ApiGuideCategory,
  type ApiGuideCollection,
  type ApiGuideCollectionDetail,
  type ApiGuideRoute,
  type ApiGuideRouteDetail,
  type ApiMenuItem,
  type ApiNotificationFeed,
  type ApiPayment,
  type ApiPreorder,
  type ApiPromo,
  type ApiRestaurant,
  type ApiReviewSummary,
  type ApiStory,
  type ApiTokenPair,
  type ApiUser,
} from "./http-mapping";
import { sortCuisines, type CuisineDictionaryEntry } from "./admin/cuisines";
import {
  sortVenueFeatures,
  type VenueFeatureDictionaryEntry,
} from "./admin/venue-features";
import { RepositoryError, type AuthRepository, type RestaurantRepository } from "./repository";
import { buildMapPreviewUrl, type MapPreviewOptions } from "./static-map";
import type {
  Amenity,
  AuthSession,
  AuthUser,
  Booking,
  BookingPage,
  BookingPayment,
  CancelBookingInput,
  CreateBookingInput,
  Cuisine,
  DayAvailability,
  EventPage,
  EventQuery,
  FavoriteItems,
  FavoriteKind,
  GuideCategory,
  GuideCollection,
  GuideCollectionDetail,
  GuideRoute,
  GuideRouteDetail,
  HomePromo,
  MenuSection,
  NotificationFeed,
  OtpRequest,
  Preorder,
  PreorderLineInput,
  ProfileUpdate,
  RegisterPushTokenInput,
  RescheduleBookingInput,
  Restaurant,
  RestaurantStory,
  RestaurantSummary,
  SearchQuery,
  SearchResult,
} from "./types";

export interface HttpRepositoryOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** Supplies the bearer token for the authenticated booking calls. Absent =
   * every booking write fails fast with a 401 RepositoryError, which is what
   * the sign-in gate reacts to. */
  getToken?: TokenProvider;
  /** Recovers a single 401 by refreshing the session — see UnauthorizedHandler.
   * Absent = a 401 is final, which is the right behaviour for anything that
   * has no refresh token to spend (the admin panel, tests). */
  onUnauthorized?: UnauthorizedHandler;
  /** Interface language sent as `Accept-Language`; this backend translates
   * content by it. Absent = the runtime's own default header. */
  getLanguage?: LanguageProvider;
}

const POPULAR_PAGE_SIZE = 20;
/** Promos render as a short horizontal strip; one page of this size is all it
 * can show. */
const PROMO_PAGE_SIZE = 8;
/** Backend caps per_page at 100 (domain.RestaurantFilter.PerPage doc
 * comment); used as the working page for the search screen. The live catalog
 * is 22 venues, so one page still covers it — revisit (real pagination) before
 * it passes 100. */
const SEARCH_PAGE_SIZE = 100;
/** One screen of the guest's own bookings. Small on purpose: the list is
 * offset-paginated and every visible row costs one extra venue request for the
 * name, so a big first page is a burst of requests on a phone connection. */
const BOOKINGS_PAGE_SIZE = 20;
/** One page of the Explore events strip. The strip is horizontal and the user
 * scrolls it by hand, so a page bigger than a handful of cards would download
 * rows nobody swipes to. The server caps per_page at 100. */
const EVENTS_PAGE_SIZE = 12;
/** One page of the notifications inbox. The screen shows a single vertical
 * list a guest scrolls by hand, so a page of this size covers the recent inbox
 * without a burst; older items are reachable later via `next_cursor`. */
const NOTIFICATIONS_PAGE_SIZE = 30;
/** The server rejects nothing above 100 — it silently clamps — but sending a
 * value it will not honour makes the response's `per_page` disagree with what
 * the caller asked for, so the clamp happens here too. */
function clampPerPage(value: number): number {
  if (!Number.isFinite(value)) return EVENTS_PAGE_SIZE;
  return Math.min(100, Math.max(1, Math.trunc(value)));
}

/**
 * Запись справочника, как её отдаёт публичный `GET /cuisines`.
 *
 * Это `CuisineDictionaryEntry`, но `display_order`/`is_active` объявлены
 * необязательными НАРОЧНО: в Go они не указатели и всегда сериализуются, а
 * читать их как «обязаны быть» значит уронить весь ряд кухонь на одном
 * отсутствующем ключе. Правило файла общее — см. шапку http-mapping.ts.
 */
type ApiCuisineEntry = Omit<CuisineDictionaryEntry, "display_order" | "is_active"> &
  Partial<Pick<CuisineDictionaryEntry, "display_order" | "is_active">>;

/**
 * Запись справочника удобств, как её отдаёт публичный `GET /venue-features`.
 *
 * Служебные поля объявлены необязательными по той же причине, что и у кухонь:
 * в Go они не указатели и всегда сериализуются, но читать их как «обязаны
 * быть» значит уронить весь список удобств на одном отсутствующем ключе.
 * `name_i18n` необязателен и НА САМОМ ДЕЛЕ: на бою 2026-08-25 его нет у шести
 * записей из девятнадцати («Без детей», «Кальян», …).
 */
type ApiVenueFeatureEntry = Omit<
  VenueFeatureDictionaryEntry,
  "display_order" | "is_active" | "venue_count"
> &
  Partial<Pick<VenueFeatureDictionaryEntry, "display_order" | "is_active" | "venue_count">>;

/**
 * Подпись удобства на языке приложения.
 *
 * Сервер и так переводит `name` по `Accept-Language`, но справочник отдаёт
 * ещё и `name_i18n`, и когда язык известен клиенту — берём подпись оттуда:
 * тогда список не зависит от того, дошёл ли заголовок до бэкенда через
 * прокси. Нет перевода на нужный язык (у шести записей его нет вовсе, а
 * ko/hi/ar/zh/tr в справочнике нет ни у одной) — остаётся `name`, то есть то,
 * что сервер уже выбрал сам. Тег режем до базового языка: `Accept-Language`
 * может прийти как `ru-RU`, а ключи в `name_i18n` — двухбуквенные.
 */
function localizedFeatureName(entry: ApiVenueFeatureEntry, language?: string): string {
  const base = (language ?? "").trim().toLowerCase().split(/[-_]/)[0];
  const translated = base ? entry.name_i18n?.[base] : undefined;
  return translated?.trim() || entry.name;
}

/**
 * HTTP-backed RestaurantRepository over `/api/v1`. See http-mapping.ts for
 * the DTO -> UI-type conversion and unknown-data.ts for the fields the API
 * doesn't have yet.
 */
export class HttpRestaurantRepository implements RestaurantRepository {
  private readonly client: HttpClient;
  /** Kept beside the client because one endpoint (the map preview) is consumed
   * as a URL by an <Image> rather than fetched through HttpClient. */
  private readonly baseUrl: string;
  /** Тот же поставщик языка, что уходит в `Accept-Language`. Нужен отдельно
   * от клиента для справочника удобств: у него подпись выбирается из
   * `name_i18n` (см. localizedFeatureName). Замыкание, а не значение, — язык
   * меняется, пока приложение работает. */
  private readonly getLanguage?: LanguageProvider;

  constructor(options: HttpRepositoryOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.getLanguage = options.getLanguage;
    this.client = new HttpClient({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      getToken: options.getToken,
      onUnauthorized: options.onUnauthorized,
      getLanguage: options.getLanguage,
    });
  }

  /**
   * The venue screen needs four endpoints. They run in parallel, and only the
   * catalog read is allowed to fail the screen: a broken menu, promo or
   * review request degrades its own section (empty strip, no rating) instead
   * of turning the whole venue into an error state.
   */
  async getRestaurant(id: string): Promise<Restaurant> {
    const encoded = encodeURIComponent(id);
    const [api, reviews, highlights, promos] = await Promise.all([
      this.client.get<ApiRestaurant>(`/restaurants/${encoded}`),
      optional(this.client.get<ApiReviewSummary>(`/restaurants/${encoded}/reviews/summary`)),
      // Лента «Лучшие позиции» — отдельной ручкой, с сервера уже собранной и
      // упорядоченной. Раньше здесь качалось ВСЁ меню (у живого заведения до
      // ~300 блюд) ради восьми карточек, а правило ленты жило в клиенте.
      optional(
        this.client.get<ApiMenuItem[]>(`/restaurants/${encoded}/menu-highlights`, {
          limit: MENU_HIGHLIGHT_LIMIT,
        }),
      ),
      optional(
        this.client
          .get<ApiPage<ApiPromo>>(`/restaurants/${encoded}/promos`, {
            page: 1,
            per_page: PROMO_PAGE_SIZE,
          })
          .then((page) => page.items ?? []),
      ),
    ]);
    return mapRestaurantDetail(api, { reviews, highlights, promos });
  }

  /** GET /restaurants/:id, mapped to the card shape — one request, no
   * reviews / menu / promos fan-out. */
  async getRestaurantSummary(id: string): Promise<RestaurantSummary> {
    const api = await this.client.get<ApiRestaurant>(`/restaurants/${encodeURIComponent(id)}`);
    return mapRestaurantSummary(api);
  }

  /** GET /restaurants/:id/map — a URL, not a request: see the interface. */
  getMapPreviewUrl(restaurantId: string, options?: MapPreviewOptions): string {
    return buildMapPreviewUrl(this.baseUrl, restaurantId, options);
  }

  /**
   * `GET /restaurants/picks` — состав блока «Выбрали для вас».
   *
   * Ответ — ОБЫЧНАЯ страница каталога (`{items, total, page, per_page}` из
   * `ApiRestaurant`), поэтому здесь тот же `mapRestaurantSummary`, что и у
   * листинга: второго маппинга у блока быть не должно, иначе карточки главной
   * и карточки поиска начнут расходиться в мелочах.
   *
   * Порядок ответа НЕ ТРОГАЕМ: если владелец задал список руками, порядок в
   * нём — это его решение, и любая сортировка на клиенте его сотрёт.
   *
   * Пустой `city` не отправляется вовсе (см. HttpClient): для сервера это то
   * же самое, что и запрос без города, — список «для всех городов».
   */
  async getRecommendedRestaurants(
    city?: string,
    limit = POPULAR_PAGE_SIZE,
  ): Promise<RestaurantSummary[]> {
    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants/picks", {
      city: city?.trim() || undefined,
      limit,
    });
    return (page.items ?? []).map(mapRestaurantSummary);
  }

  /**
   * Runs on GET /restaurants/search, the dedicated catalog-search route
   * (internal/transport/rest/restaurants/handler.go: search), not on the
   * frozen listing route. Verified server-side query surface:
   *   - `q`        — Postgres FTS + trigram over the venue's searchable text
   *   - `cuisine`  — repeatable or comma-separated, OR-set, exact
   *                  `cuisine_type = ANY(...)` (case-sensitive)
   *   - `city`     — equality on the city enum value
   *   - `price`    — equality on the price_category tier string
   * Filters with no server-side counterpart stay client-side over the fetched
   * page: `openNowOnly`, `onlineBookableOnly` and `minRating` (the listing
   * carries no rating). `open_now` / `accepts_online_bookings` as query
   * parameters are IGNORED by the server today — checked 2026-07-26:
   * `/restaurants/search?open_now=true&accepts_online_bookings=true` still
   * answers `total: 24`, i.e. the whole catalog — so sending them would look
   * like filtering while doing nothing. The whole catalog fits in one page
   * (per_page=100 → 24 items), so filtering it client-side hides no rows.
   */
  async searchRestaurants(query: SearchQuery): Promise<SearchResult> {
    // Кухни уходят ОДНИМ параметром через запятую: сервер разбирает список,
    // ORит его и сравнивает без учёта регистра, понимая и коды справочника, и
    // старую текстовую строку (проверено на бою 2026-08-25 —
    // `?cuisine=european,kazakh` даёт 15 при 13 и 2 по одиночке). Поэтому
    // никакого разворачивания «всех написаний» на клиенте больше нет.
    const cuisines = query.filters.cuisineIds.map((id) => id.trim()).filter(Boolean);

    // Удобства уходят так же — одним параметром через запятую, — но семантика
    // у них ПРОТИВОПОЛОЖНАЯ кухням: сервер требует ВСЕ перечисленные сразу
    // (проверено на бою 2026-08-25: terrace 4, wifi 3, terrace,wifi 2, то
    // есть пересечение, а не объединение). Это ровно то, что обещает шторка с
    // галочками, поэтому клиент ничего не досчитывает.
    const amenities = query.filters.amenityIds.map((id) => id.trim()).filter(Boolean);

    const period = query.filters.availability?.timeOfDay;
    const timeWindow = period ? timeOfDayWindow(period) : undefined;

    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants/search", {
      q: query.text.trim() || undefined,
      cuisine: cuisines.length > 0 ? cuisines.join(",") : undefined,
      features: amenities.length > 0 ? amenities.join(",") : undefined,
      city: query.filters.city,
      price: query.filters.priceLevel
        ? priceLevelToPriceCategory(query.filters.priceLevel)
        : undefined,
      // Доступность считает только сервер — см. SearchFilters.availability.
      // Дата и гости уходят ТОЛЬКО парой: сервер игнорирует одно без другого,
      // и отправить половину значило бы показать «фильтр применён», когда он
      // не применён.
      date: query.filters.availability?.date,
      guests: query.filters.availability?.guests,
      // Окно времени. Чип «Утро/Обед/Ужин» — это тот же `time_from`/`time_to`,
      // только словами, поэтому он раскрывается в окно ЗДЕСЬ, в одном месте,
      // а не в каждом экране, который его показывает. Выбранное время суток
      // перекрывает явные часы: иначе выдача зависела бы от того, какое из
      // двух полей записали последним.
      time_from: timeWindow?.timeFrom ?? query.filters.availability?.timeFrom,
      time_to: timeWindow?.timeTo ?? query.filters.availability?.timeTo,
      page: 1,
      per_page: SEARCH_PAGE_SIZE,
    });

    const fetched = (page.items ?? []).map(mapRestaurantSummary);
    let items = fetched;

    if (query.filters.minRating !== undefined) {
      items = items.filter((r) => r.rating >= query.filters.minRating!);
    }

    if (query.filters.openNowOnly) {
      // Строго `=== true`: заведение без графика (или без `open_now`) под
      // фильтр «открыто сейчас» не попадает — мы про него не знаем, а не
      // «знаем, что открыто».
      items = items.filter((r) => r.schedule?.openNow === true);
    }

    if (query.filters.onlineBookableOnly) {
      items = items.filter((r) => r.acceptsOnlineBookings);
    }

    // `page.total` counts every match across pages; once a client-side filter
    // has removed rows, that number no longer describes what the user sees.
    const total = items.length === fetched.length ? (page.total ?? items.length) : items.length;
    return { query, items, total };
  }

  /**
   * GET /restaurants?per_page=N — короткая выборка каталога РАДИ ФОТОГРАФИЙ.
   *
   * Последний запасной источник картинки для круга «Выберите кухню», после
   * ссылки из справочника (`image_url`) и снимка, вшитого в сборку. Нужен,
   * пока `image_url` проставлен не у всех: на бою 2026-08-25 его нет ни у
   * одной из 14 кухонь, а своего снимка в приложении нет у четырёх. Здесь
   * фотография берётся у РЕАЛЬНОГО заведения этой кухни — она всегда есть,
   * всегда наша и обновляется сама.
   */
  async getCatalogPreview(perPage = 50): Promise<RestaurantSummary[]> {
    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants", {
      page: 1,
      per_page: perPage,
    });
    return (page.items ?? []).map(mapRestaurantSummary);
  }

  /**
   * `GET /cuisines` — СПРАВОЧНИК кухонь (только активные, в порядке
   * `display_order`), а не выжимка из каталога.
   *
   * Раньше список собирался дедупом одной страницы `/restaurants`: он зависел
   * от того, какие заведения попали в первую сотню, порядок был алфавитный, и
   * в него пролезали типы заведения вроде «Винный бар» — их приходилось
   * отсеивать списком-заплаткой. В справочнике типа заведения нет по
   * определению (проверено на бою 2026-08-25: 14 записей, «Винного бара»
   * среди них нет), поэтому заплатка удалена вместе со сбором.
   *
   * Порядок сервер уже задал, но сортировка повторяется здесь: она дешёвая, а
   * молча показать ряд в порядке выдачи, если сервер однажды отдаст его
   * иначе, — это ровно тот класс расхождений, который потом ищут глазами.
   */
  async getCuisines(): Promise<Cuisine[]> {
    const items = await this.client.get<ApiCuisineEntry[]>("/cuisines");
    // `is_active === false` публичная ручка не отдаёт, но если отдаст —
    // скрытую кухню сервер всё равно не примет фильтром, и показывать её
    // значило бы обещать выдачу, которой не будет.
    const active = (items ?? []).filter((entry) => entry.is_active !== false);
    return sortCuisines(
      active.map((entry) => ({ ...entry, display_order: entry.display_order ?? 0 })),
    ).map(mapCuisine);
  }

  /**
   * `GET /venue-features` — СПРАВОЧНИК удобств (только активные, в порядке
   * `display_order`), значения фильтра `?features=`.
   *
   * Отдаём список ЦЕЛИКОМ, вместе с записями, у которых `venue_count = 0`:
   * на 2026-08-25 таких шесть из девятнадцати (парковка, халал, намазхана,
   * детские стульчики, без детей, безглютеновое меню), владелец заполняет их
   * прямо сейчас, и решение показывать их — его. Выбор такого удобства даёт
   * обычное пустое состояние выдачи («ничего не нашлось» со ссылкой сбросить
   * фильтры), а не ошибку.
   *
   * Записи без `code` выбрасываются: код — это и есть значение фильтра, и
   * галочка, которую сервер не сможет применить, обещает несуществующее.
   */
  async getAmenities(): Promise<Amenity[]> {
    const items = await this.client.get<ApiVenueFeatureEntry[]>("/venue-features");
    const language = this.getLanguage?.();
    // `is_active === false` публичная ручка не отдаёт, но если отдаст —
    // скрытое удобство фильтром всё равно не сработает (та же логика, что у
    // кухонь).
    const active = (items ?? []).filter(
      (entry) => entry.is_active !== false && (entry.code ?? "").trim() !== "",
    );
    return sortVenueFeatures(
      active.map((entry) => ({
        ...entry,
        display_order: entry.display_order ?? 0,
        name: localizedFeatureName(entry, language),
      })),
    ).map((entry) => ({ id: entry.code.trim(), name: entry.name }));
  }

  /** GET /cities returns a bare array of city names (the domain's city enum),
   * not objects with ids — the search filter matches on the name itself. */
  async getCities(): Promise<string[]> {
    return this.client.get<string[]>("/cities");
  }

  /**
   * GET /events — published, not-yet-finished events of active venues across
   * the whole catalog, `starts_at ASC` (ties by id).
   *
   * Verified live on 2026-07-25: the route answers 200 with the standard page
   * envelope and, on the test deployment today, an EMPTY `items` array —
   * `{"data":{"items":[],"total":0,"pages":0,"page":1,"per_page":20}}`. That is
   * the normal shape of "nothing scheduled", so callers must render an empty
   * state, not an error. A malformed `restaurant_id` is a 422
   * (`restaurant_id must be a uuid`), which surfaces as a RepositoryError with
   * `isValidation`.
   */
  async listUpcomingEvents(query?: EventQuery): Promise<EventPage> {
    const perPage = clampPerPage(query?.perPage ?? EVENTS_PAGE_SIZE);
    const page = await this.client.get<ApiPage<ApiEventListItem>>("/events", {
      city: query?.city,
      restaurant_id: query?.restaurantId,
      from: query?.from,
      to: query?.to,
      page: query?.page ?? 1,
      per_page: perPage,
    });
    return {
      items: (page.items ?? []).map(mapEventSummary),
      total: typeof page.total === "number" ? page.total : 0,
      page: typeof page.page === "number" ? page.page : 1,
      pages: typeof page.pages === "number" ? page.pages : 0,
      perPage: typeof page.per_page === "number" ? page.per_page : perPage,
    };
  }

  /**
   * GET /feed?city=… — the unified home feed. Returns `{ items: [...] }` (the
   * standard envelope's `data`), a MIXED list of `promo` and `event` items;
   * this keeps only the promos for the «Акции» strip.
   *
   * `city` is REQUIRED — the endpoint 422s with code `city_required` without
   * it — so the caller must pass a resolved city. It is URL-encoded by the
   * client's `URLSearchParams`, so a city with spaces or Cyrillic goes over the
   * wire safely.
   */
  async getPromotions(city: string): Promise<HomePromo[]> {
    const feed = await this.client.get<{ items?: ApiFeedItem[] }>("/feed", { city });
    return mapHomePromos(feed.items);
  }

  /* --- gastroguide / «Статьи» --- */

  /**
   * GET /gastroguide/collections — the editorial collections list. The standard
   * page envelope wraps `{ items, total, pages, page, per_page }`; the «Статьи»
   * list only needs the cards, so this returns the mapped `items` and drops the
   * paging (the strip and screen show the first page). Public, no session.
   */
  /**
   * GET /gastroguide/categories — рубрики гастрогида. Конверт тут НЕ
   * страничный: ручка отдаёт просто `{items: [...]}` без total/page, в отличие
   * от списка подборок.
   */
  async getGuideCategories(): Promise<GuideCategory[]> {
    const body = await this.client.get<{ items?: ApiGuideCategory[] | null }>(
      "/gastroguide/categories",
    );
    return mapGuideCategories(body.items);
  }

  async getGuideCollections(): Promise<GuideCollection[]> {
    const page = await this.client.get<ApiPage<ApiGuideCollection>>("/gastroguide/collections");
    return mapGuideCollections(page.items);
  }

  /**
   * GET /gastroguide/collections/:slug — one collection with its venue blocks.
   * An unknown slug is a 404, surfaced as a RepositoryError with `isNotFound`
   * so the detail screen shows its "not found" state. Public, no session.
   */
  async getGuideCollection(slug: string): Promise<GuideCollectionDetail> {
    const api = await this.client.get<ApiGuideCollectionDetail>(
      `/gastroguide/collections/${encodeURIComponent(slug)}`,
    );
    return mapGuideCollectionDetail(api);
  }

  /**
   * GET /gastroguide/routes?city=<город> — гастропрогулки. Город ОБЯЗАТЕЛЕН:
   * без него ручка отвечает 422 `city_required`, поэтому вызывающий хук
   * гейтится на разрешённом городе, как лента акций.
   */
  async getGuideRoutes(city: string): Promise<GuideRoute[]> {
    const page = await this.client.get<ApiPage<ApiGuideRoute>>("/gastroguide/routes", { city });
    return mapGuideRoutes(page.items);
  }

  /**
   * GET /gastroguide/routes/:slug — маршрут с остановками. Неизвестный слаг,
   * черновик и снятый с публикации маршрут дают одинаковый 404 (так устроена
   * ручка), он приходит сюда как RepositoryError c `isNotFound`, и экран
   * показывает честное «не найдено». Гостевая ручка, сессия не нужна.
   */
  async getGuideRoute(slug: string): Promise<GuideRouteDetail> {
    const api = await this.client.get<ApiGuideRouteDetail>(
      `/gastroguide/routes/${encodeURIComponent(slug)}`,
    );
    return mapGuideRouteDetail(api);
  }

  /* --- «Статьи» --- */

  /**
   * GET /articles — список СТАТЕЙ. Конверт и форма элемента те же, что у
   * `/gastroguide/collections`, поэтому здесь тот же маппер: разница ровно в
   * том, ЧТО отдаёт сервер (`kind: "article"` против `kind: "collection"`).
   *
   * Параметра `?category=` у этой ручки нет и быть не может: у статьи нет
   * рубрики — именно этим она и отличается от подборки.
   */
  async listArticles(): Promise<GuideCollection[]> {
    const page = await this.client.get<ApiPage<ApiGuideCollection>>("/articles");
    return mapGuideCollections(page.items);
  }

  /**
   * GET /articles/:slug — одна статья с блоками заведений. Неизвестный слаг —
   * 404 с `isNotFound`, экран показывает «не найдено». Ручка резолвит слаг
   * ЛЮБОГО вида (слаг уникален глобально), поэтому старая ссылка на подборку
   * тут открывается, а не отваливается.
   */
  async getArticle(slug: string): Promise<GuideCollectionDetail> {
    const api = await this.client.get<ApiGuideCollectionDetail>(
      `/articles/${encodeURIComponent(slug)}`,
    );
    return mapGuideCollectionDetail(api);
  }

  /* --- reservation flow --- */

  /**
   * GET /restaurants/:id/availability. The party-size parameter is `guests`,
   * NOT `party_size` — verified against the live API on 2026-07-25: the
   * handler reads `c.DefaultQuery("guests", "2")`, so a `party_size=4` request
   * silently answers for a party of 2. Public route, no session.
   */
  async getAvailability(input: {
    restaurantId: string;
    date: string;
    guests: number;
  }): Promise<DayAvailability> {
    const api = await this.client.get<ApiAvailability>(
      `/restaurants/${encodeURIComponent(input.restaurantId)}/availability`,
      { date: input.date, guests: input.guests },
    );
    return mapAvailability(api);
  }

  /** GET /restaurants/:id/menu — a bare array inside the standard envelope
   * (no Page wrapper, no limit parameter), up to ~300 dishes. */
  async getMenuSections(restaurantId: string): Promise<MenuSection[]> {
    const items = await this.client.get<ApiMenuItem[]>(
      `/restaurants/${encodeURIComponent(restaurantId)}/menu`,
    );
    return mapMenuSections(items);
  }

  /** GET /restaurants/:id/stories — a bare array inside the standard envelope
   * (no Page wrapper). An empty array is the normal "no stories" answer, so
   * the rail hides on it rather than showing an error. */
  async getRestaurantStories(restaurantId: string): Promise<RestaurantStory[]> {
    const items = await this.client.get<ApiStory[]>(
      `/restaurants/${encodeURIComponent(restaurantId)}/stories`,
    );
    return mapRestaurantStories(items);
  }

  /**
   * POST /bookings. The Idempotency-Key header is mandatory (422 without it)
   * and the backend hashes the body alongside it: replaying the same key with
   * the same body returns 201 and the ORIGINAL booking, so a double tap or a
   * retry after a timeout can never create a second table.
   *
   * `items` is deliberately not sent even though the create body accepts it:
   * that path takes prices from the client. The pre-order goes through
   * setPreorder instead, which prices the lines server-side.
   */
  async createBooking(input: CreateBookingInput, idempotencyKey: string): Promise<Booking> {
    const api = await this.client.post<ApiBooking>(
      "/bookings",
      {
        restaurant_id: input.restaurantId,
        starts_at: input.startsAt,
        guests: input.guests,
        name: input.name,
        phone: input.phone,
        notes: input.notes?.trim() ? input.notes.trim() : undefined,
      },
      { auth: true, headers: { "Idempotency-Key": idempotencyKey } },
    );
    return mapBooking(api);
  }

  async getBooking(bookingId: string): Promise<Booking> {
    const api = await this.client.get<ApiBooking>(
      `/bookings/${encodeURIComponent(bookingId)}`,
      undefined,
      { auth: true },
    );
    return mapBooking(api);
  }

  /**
   * GET /bookings — the caller's own bookings, `starts_at DESC`.
   *
   * The server derives the owner from the bearer token (`listMine`), so there
   * is no user filter to send and no way to read somebody else's list. It
   * answers a standard page envelope; `pages` is 0 when the guest has no
   * bookings at all, which the caller must treat as "one empty page", not as
   * "more pages to come".
   */
  async listMyBookings(input?: { page?: number; perPage?: number }): Promise<BookingPage> {
    const page = await this.client.get<ApiPage<ApiBooking>>(
      "/bookings",
      { page: input?.page ?? 1, per_page: input?.perPage ?? BOOKINGS_PAGE_SIZE },
      { auth: true },
    );
    return {
      items: (page.items ?? []).map(mapBooking),
      total: typeof page.total === "number" ? page.total : 0,
      page: typeof page.page === "number" ? page.page : 1,
      pages: typeof page.pages === "number" ? page.pages : 0,
      perPage:
        typeof page.per_page === "number" ? page.per_page : (input?.perPage ?? BOOKINGS_PAGE_SIZE),
    };
  }

  /**
   * GET /favorites. Not paginated server-side — it answers a bare array of the
   * same restaurant objects the catalog returns (verified live 2026-07-25), so
   * the catalog mapper is reused rather than a second one written.
   */
  async getFavorites(): Promise<RestaurantSummary[]> {
    const items = await this.client.get<ApiRestaurant[]>("/favorites", undefined, { auth: true });
    return (items ?? []).map(mapRestaurantSummary);
  }

  /** PUT /favorites/:restaurantId. Idempotent server-side. */
  async addFavorite(restaurantId: string): Promise<void> {
    await this.client.put<unknown>(
      `/favorites/${encodeURIComponent(restaurantId)}`,
      undefined,
      { auth: true },
    );
  }

  /** DELETE /favorites/:restaurantId. Idempotent server-side. */
  async removeFavorite(restaurantId: string): Promise<void> {
    await this.client.delete<unknown>(`/favorites/${encodeURIComponent(restaurantId)}`, {
      auth: true,
    });
  }

  /**
   * GET /favorites/items — venues, events and promos in ONE list, plus the
   * counters for all three kinds.
   *
   * Called WITHOUT `type` by the app: `counts` is whole-set regardless, so a
   * single response feeds both the tab row and every tab's contents, and
   * switching a tab is a filter, not a request.
   */
  async getFavoriteItems(type?: FavoriteKind): Promise<FavoriteItems> {
    const payload = await this.client.get<ApiFavoriteItems>(
      "/favorites/items",
      type ? { type } : undefined,
      { auth: true },
    );
    return mapFavoriteItems(payload);
  }

  /** PUT /events/:eventId/favorite. Idempotent; saves the whole SERIES when the
   * event recurs. */
  async addEventFavorite(eventId: string): Promise<void> {
    await this.client.put<unknown>(
      `/events/${encodeURIComponent(eventId)}/favorite`,
      undefined,
      { auth: true },
    );
  }

  /** DELETE /events/:eventId/favorite. Idempotent. */
  async removeEventFavorite(eventId: string): Promise<void> {
    await this.client.delete<unknown>(`/events/${encodeURIComponent(eventId)}/favorite`, {
      auth: true,
    });
  }

  /** PUT /promos/:promoId/favorite. Idempotent. */
  async addPromoFavorite(promoId: string): Promise<void> {
    await this.client.put<unknown>(
      `/promos/${encodeURIComponent(promoId)}/favorite`,
      undefined,
      { auth: true },
    );
  }

  /** DELETE /promos/:promoId/favorite. Idempotent. */
  async removePromoFavorite(promoId: string): Promise<void> {
    await this.client.delete<unknown>(`/promos/${encodeURIComponent(promoId)}/favorite`, {
      auth: true,
    });
  }

  /** PUT /bookings/:id/preorder — replace semantics. Only menu_item_id,
   * quantity and comment travel; the server resolves the name and the price
   * from its own menu. */
  async setPreorder(bookingId: string, lines: PreorderLineInput[]): Promise<Preorder> {
    const api = await this.client.put<ApiPreorder>(
      `/bookings/${encodeURIComponent(bookingId)}/preorder`,
      {
        items: lines.map((line) => ({
          menu_item_id: line.menuItemId,
          quantity: line.quantity,
          comment: line.comment?.trim() ? line.comment.trim() : null,
        })),
      },
      { auth: true },
    );
    return mapPreorder(api);
  }

  async getPreorder(bookingId: string): Promise<Preorder> {
    const api = await this.client.get<ApiPreorder>(
      `/bookings/${encodeURIComponent(bookingId)}/preorder`,
      undefined,
      { auth: true },
    );
    return mapPreorder(api);
  }

  /**
   * POST /bookings/:id/cancel. The body is optional server-side; `{}` is sent
   * when the guest gave no reason so the request always has a valid JSON body.
   *
   * Deliberately NO Idempotency-Key: this endpoint does not honour one (only
   * POST /bookings does), and a replayed cancel answers 422 "invalid status
   * transition" rather than 200. Single-flight is the caller's job.
   */
  async cancelBooking(bookingId: string, input?: CancelBookingInput): Promise<Booking> {
    const api = await this.client.post<ApiBooking>(
      `/bookings/${encodeURIComponent(bookingId)}/cancel`,
      {
        reason_code: input?.reasonCode?.trim() ? input.reasonCode.trim() : undefined,
        reason: input?.reason?.trim() ? input.reason.trim() : undefined,
      },
      { auth: true },
    );
    return mapBooking(api);
  }

  /**
   * `PATCH /bookings/:id` — перенос брони: другое время, другое число гостей.
   *
   * Отправляются ТОЛЬКО изменённые поля. Сервер пересобирает посадку заново и
   * может отказать: столик на новое время уже заняли (409). Этот отказ обязан
   * дойти до экрана как отказ, а не как «сохранено» — иначе гость уйдёт с
   * мыслью, что перенёс бронь, а заведение будет ждать его в старое время.
   */
  async rescheduleBooking(bookingId: string, input: RescheduleBookingInput): Promise<Booking> {
    const api = await this.client.patch<ApiBooking>(
      `/bookings/${encodeURIComponent(bookingId)}`,
      {
        starts_at: input.startsAt,
        guests: input.guests,
      },
      { auth: true },
    );
    return mapBooking(api);
  }

  /**
   * GET /bookings/:id/payment. A booking with no deposit / pre-payment answers
   * 404, which is the NORMAL case on this deployment today — it is turned into
   * `null`, not thrown, so "nothing to lose" and "the request failed" stay
   * distinguishable at the call site. Every other failure still throws.
   */
  async getBookingPayment(bookingId: string): Promise<BookingPayment | null> {
    try {
      const api = await this.client.get<ApiPayment>(
        `/bookings/${encodeURIComponent(bookingId)}/payment`,
        undefined,
        { auth: true },
      );
      return mapPayment(api);
    } catch (error) {
      if (error instanceof RepositoryError && error.isNotFound) return null;
      throw error;
    }
  }

  /**
   * POST /devices/push-tokens.
   *
   * The response (`{id, platform, status}`) is read and discarded: `id` is
   * only useful for correlating with support, and pretending otherwise would
   * mean carrying a value no screen renders. What matters here is that the
   * call is authenticated — the account the token is attached to comes from
   * the bearer token, never from the body.
   */
  async registerPushToken(input: RegisterPushTokenInput): Promise<void> {
    await this.client.post<unknown>(
      "/devices/push-tokens",
      { token: input.token, platform: input.platform },
      { auth: true },
    );
  }

  /** DELETE /devices/push-tokens, token in the body (see deleteWithBody). */
  async unregisterPushToken(token: string): Promise<void> {
    await this.client.deleteWithBody<unknown>("/devices/push-tokens", { token }, { auth: true });
  }

  /* --- notifications feed («Уведомления») --- */

  /**
   * GET /notifications?cursor=&limit= — the caller's inbox, authenticated (the
   * server derives the owner from the bearer token, same as GET /bookings).
   * An absent `cursor` reads the first page; the empty-string guard in
   * HttpClient.get drops `cursor: undefined` from the query string.
   */
  async listNotifications(cursor?: string): Promise<NotificationFeed> {
    const feed = await this.client.get<ApiNotificationFeed>(
      "/notifications",
      { cursor, limit: NOTIFICATIONS_PAGE_SIZE },
      { auth: true },
    );
    return mapNotificationFeed(feed);
  }

  /** POST /notifications/:id/read — authenticated; a 404 means the id is not
   * the caller's, surfaced as a RepositoryError with `isNotFound`. */
  async markNotificationRead(id: string): Promise<void> {
    await this.client.post<unknown>(
      `/notifications/${encodeURIComponent(id)}/read`,
      undefined,
      { auth: true },
    );
  }

  /** POST /notifications/read-all — authenticated; idempotent server-side. */
  async markAllNotificationsRead(): Promise<void> {
    await this.client.post<unknown>("/notifications/read-all", undefined, { auth: true });
  }
}

/**
 * HTTP-backed AuthRepository over `/api/v1/auth` + `/api/v1/users/me`.
 *
 * Only the email+password pair is implemented. `/auth/otp/request` exists and
 * answers `{"sent":true}`, but delivery on this deployment is
 * infrastructure/otpsender.Stub — it logs and returns, no SMS is ever sent,
 * and the code is withheld from the log outside APP_ENV=development. Wiring a
 * phone/OTP screen would therefore ship a login nobody can complete. See the
 * delivery note in conventions/bookeat-frontend.md.
 */
/** `POST /auth/otp/request` payload (transport/rest/auth/response.go:
 * otpRequestedResponse). `code` is omitted unless the server runs with
 * AUTH_OTP_DEV_EXPOSE=true. */
interface ApiOtpRequested {
  sent?: boolean;
  code?: string;
}

/** The shared `{sent, devCode}` mapping used by every OTP-request endpoint
 * (sign-in and phone-change). `devCode` is the server's debug echo, present
 * only with AUTH_OTP_DEV_EXPOSE=true — carried, never depended on. */
function mapOtpRequested(api: ApiOtpRequested): OtpRequest {
  return {
    sent: api.sent === true,
    devCode: typeof api.code === "string" && api.code !== "" ? api.code : null,
  };
}

/**
 * Deadline for the two endpoints that DELIVER a one-time code, in ms.
 *
 * Why it is not the client default (8 000 ms): the backend sends the code
 * SYNCHRONOUSLY inside the request. Its delivery waterfall
 * (internal/infrastructure/otpsender/waterfall.go) has a 12-second budget —
 * Telegram Gateway, then WhatsApp, then SMS — and the HTTP server's own
 * WriteTimeout is 15 s. With an 8-second client deadline the app gave up on a
 * request that was still working: the guest got the code on their phone and the
 * screen said «Проверьте соединение», never advancing to the code field. A real
 * sign-in blocker.
 *
 * 20 s = the server's 12-second delivery budget + headroom for a slow mobile
 * connection, and still under the 15 s WriteTimeout + TLS handshake, so we now
 * always outlive the server rather than the other way round.
 *
 * Scoped to these endpoints on purpose. Raising the global default would make
 * every dead screen in the app spin for 20 seconds before admitting failure.
 */
const OTP_DELIVERY_TIMEOUT_MS = 20_000;

export class HttpAuthRepository implements AuthRepository {
  private readonly client: HttpClient;
  /**
   * A second client differing ONLY in the deadline, used by the two OTP-REQUEST
   * endpoints. Verification is deliberately left on the normal client: it sends
   * nothing, it only compares a code, so 8 seconds is right there and a longer
   * wait would just be a longer spinner on a broken connection.
   */
  private readonly otpDeliveryClient: HttpClient;
  /** Аватар — единственная загрузка файла в приложении, и она не может идти
   * через HttpClient: тот всегда ставит `Content-Type: application/json`, а
   * multipart требует, чтобы заголовок с границей выставил сам fetch. Поэтому
   * здесь хранятся адрес и токен — см. uploadAvatar. */
  private readonly baseUrl: string;
  private readonly getToken?: HttpRepositoryOptions["getToken"];

  constructor(options: HttpRepositoryOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.getToken = options.getToken;
    this.client = new HttpClient({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      getToken: options.getToken,
      onUnauthorized: options.onUnauthorized,
      getLanguage: options.getLanguage,
    });
    this.otpDeliveryClient = new HttpClient({
      baseUrl: options.baseUrl,
      // An explicit `timeoutMs` from the caller still wins — a test that wants
      // a 50 ms deadline gets one — but the DEFAULT here is the long one, not
      // the client's 8 s.
      timeoutMs: options.timeoutMs ?? OTP_DELIVERY_TIMEOUT_MS,
      getToken: options.getToken,
      onUnauthorized: options.onUnauthorized,
      getLanguage: options.getLanguage,
    });
  }

  /**
   * `POST /users/me/avatar` — кладёт фотографию и возвращает ссылку, которую
   * сервер УЖЕ записал в профиль. Второго запроса на сохранение нет намеренно:
   * привязка происходит на сервере в той же транзакции, поэтому «фото
   * загрузилось, но не сохранилось» здесь невозможно.
   *
   * `file` — то, что отдаёт системный выбор фото: локальный uri вида
   * `file:///…`. React Native принимает такой объект в FormData и читает файл
   * сам; читать его в память здесь не нужно и вредно (это лишние мегабайты в
   * куче телефона).
   *
   * Content-Type НЕ ставим — его вычислит fetch вместе с границей multipart.
   * Прописать его руками значит отправить чужую границу и получить отказ на
   * каждой части.
   */
  async uploadAvatar(file: { uri: string; name?: string; type?: string }): Promise<string> {
    const token = (await this.getToken?.()) ?? null;
    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name ?? "avatar.jpg",
      type: file.type ?? "image/jpeg",
    } as unknown as Blob);

    // XMLHttpRequest, А НЕ fetch. Оба есть в React Native, но multipart с
    // локальным файлом надёжно отправляет только XHR: файл читает нативная
    // часть по uri. fetch в новых версиях Expo пытается сделать это в JS и
    // падает ещё до сети — «не удалось загрузить», при том что сервер не
    // получал ни одного запроса (ровно это и случилось 14.08.2026).
    //
    // Ошибки здесь РАЗЛИЧАЮТСЯ: обрыв связи, отказ сервера и пустой ответ —
    // три разные причины, и человеку с «попробуйте ещё раз» на каждую из них
    // делать нечего, если на самом деле упёрлись в лимит размера.
    return await new Promise<string>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", `${this.baseUrl}/users/me/avatar`);
      request.setRequestHeader("Accept", "application/json");
      // Content-Type НЕ ставим: его вместе с границей multipart подставит сам
      // XHR. Прописанный руками заголовок отправит чужую границу, и сервер
      // отвергнет каждую часть.
      if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);

      request.onload = () => {
        let body: { data?: { url?: string }; error?: string } | undefined;
        try {
          body = JSON.parse(request.responseText) as { data?: { url?: string }; error?: string };
        } catch {
          body = undefined;
        }
        if (request.status < 200 || request.status >= 300) {
          reject(
            new RepositoryError(
              `Avatar upload failed with ${request.status}`,
              undefined,
              request.status,
              body?.error,
            ),
          );
          return;
        }
        const url = body?.data?.url;
        if (!url) {
          // 200 без ссылки — ответ, которому нельзя верить: показать «готово»
          // и не иметь что показать хуже, чем честная ошибка.
          reject(new RepositoryError("Avatar upload returned no url"));
          return;
        }
        resolve(url);
      };
      request.onerror = () => reject(new RepositoryError("Network error uploading avatar"));
      request.ontimeout = () => reject(new RepositoryError("Avatar upload timed out"));
      request.send(form);
    });
  }


  async signUp(input: { email: string; password: string; fullName: string }): Promise<AuthSession> {
    const api = await this.client.post<ApiTokenPair>("/auth/signup", {
      email: input.email.trim(),
      password: input.password,
      full_name: input.fullName.trim(),
    });
    return mapSession(api);
  }

  async signIn(input: { email: string; password: string }): Promise<AuthSession> {
    const api = await this.client.post<ApiTokenPair>("/auth/login", {
      email: input.email.trim(),
      password: input.password,
    });
    return mapSession(api);
  }

  /**
   * `POST /auth/otp/request` — verified by curl on 2026-07-26:
   * `200 {"data":{"sent":true}}`, and a second request for the same phone
   * inside a minute answers `422 {"error":"validation failed",
   * "code":"validation_failed"}`.
   *
   * `sent: true` means the backend accepted the request and handed the code to
   * its delivery waterfall — NOT that anything was delivered. On a deployment
   * with no channel credentials the waterfall degrades to
   * infrastructure/otpsender.Stub, which answers success and sends nothing.
   */
  async requestOtp(phone: string): Promise<OtpRequest> {
    // Long deadline — see OTP_DELIVERY_TIMEOUT_MS: this call carries the
    // delivery, not just the bookkeeping.
    const api = await this.otpDeliveryClient.post<ApiOtpRequested>("/auth/otp/request", { phone });
    return mapOtpRequested(api);
  }

  /** `POST /auth/otp/verify` — the ONLY sign-in step for a phone: the backend
   * creates the user here if the phone is new (usecase/auth/otp.go). */
  async verifyOtp(input: { phone: string; code: string }): Promise<AuthSession> {
    const api = await this.client.post<ApiTokenPair>("/auth/otp/verify", {
      phone: input.phone,
      code: input.code,
    });
    return mapSession(api);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const api = await this.client.post<ApiTokenPair>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return mapSession(api);
  }

  async getMe(): Promise<AuthUser> {
    const api = await this.client.get<ApiUser>("/users/me", undefined, { auth: true });
    return mapUser(api);
  }

  /**
   * Only the keys present in `input` are put on the wire. An absent key is the
   * server's "leave this column alone", and `city: ""` is the only way to
   * clear a city (null would read as "unchanged") — see ProfileUpdate.
   *
   * Goes through the same authenticated path as every other write, so a 401 on
   * an access token that expired mid-edit is refreshed and the SAME body is
   * retried once (HttpClient.send). The guest's edit is not dropped and they
   * are not asked to retype it.
   */
  async updateMe(input: ProfileUpdate): Promise<AuthUser> {
    const body: Record<string, string> = {};
    if (input.fullName !== undefined) body.full_name = input.fullName;
    if (input.city !== undefined) body.city = input.city;
    if (input.birthDate !== undefined) body.birth_date = input.birthDate;
    const api = await this.client.patch<ApiUser>("/users/me", body, { auth: true });
    return mapUser(api);
  }

  /**
   * `POST /users/me/phone/otp/request` — sends a code to the NEW number the
   * guest wants to move to. AUTHENTICATED: goes through the same bearer path as
   * updateMe (`{ auth: true }`), NOT the anonymous sign-in path — the server
   * has to know which account is asking, and the code is delivered to the new
   * number rather than the current one. Same `{sent, devCode}` mapping as
   * requestOtp.
   */
  async requestPhoneChangeOtp(newPhone: string): Promise<OtpRequest> {
    // Same synchronous waterfall as sign-in, so the same long deadline.
    const api = await this.otpDeliveryClient.post<ApiOtpRequested>(
      "/users/me/phone/otp/request",
      { new_phone: newPhone },
      { auth: true },
    );
    return mapOtpRequested(api);
  }

  /**
   * `POST /users/me/phone/otp/verify` — proves the new number and moves the
   * account onto it. AUTHENTICATED. Answers the UPDATED user (same shape as
   * `updateMe`/`getMe`), mapped with the SAME `mapUser`, so the caller can drop
   * it straight into the `["me"]` cache.
   */
  async confirmPhoneChange(input: { newPhone: string; code: string }): Promise<AuthUser> {
    const api = await this.client.post<ApiUser>(
      "/users/me/phone/otp/verify",
      { new_phone: input.newPhone, code: input.code },
      { auth: true },
    );
    return mapUser(api);
  }

  /**
   * `DELETE /users/me` — soft delete. Authenticated; the server marks the
   * account deleted and answers success, and the caller (auth.tsx) signs the
   * guest out right after. The endpoint is being built on the backend
   * separately; the contract this client commits to is the verb + path only.
   */
  async deleteAccount(): Promise<void> {
    await this.client.delete<unknown>("/users/me", { auth: true });
  }
}

/** Resolves to undefined instead of rejecting — for the venue screen's
 * secondary sections, see getRestaurant. */
async function optional<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

export { RepositoryError };
