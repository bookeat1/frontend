import { RepositoryError } from "../repository";
import type { SocialLink, SocialLinkInput } from "./social-links";
import type { CityDictionaryEntry, CitySaveInput } from "./cities";
import type { CuisineDictionaryEntry, CuisineSaveInput } from "./cuisines";
import type { VenueFeatureDictionaryEntry, VenueFeatureSaveInput } from "./venue-features";
import type {
  AdminBooking,
  AdminEvent,
  AdminEventRecurrence,
  CatalogVenue,
  CatalogVenueInput,
  AdminGuest,
  AdminListParams,
  AdminMenuCategory,
  AdminMenuItem,
  AdminMenuTopPick,
  AdminPromo,
  ApiPage,
  AuthUser,
  BookingPolicy,
  BookingPolicyPatch,
  BookingCancelInput,
  BookingListParams,
  BookingReasonInput,
  EventInput,
  EventRecurrenceInput,
  FeedItemKind,
  FeedItemState,
  FeedReviewInput,
  GuideCategory,
  GuideCategoryInput,
  GuideCollection,
  GuideCollectionDetail,
  GuideCollectionInput,
  GuideCollectionListParams,
  GuideRoute,
  GuideRouteDetail,
  GuideRouteInput,
  GuideRouteListParams,
  GuideRoutePoint,
  GuideRoutePointInput,
  HomePickVenue,
  HomePicksInput,
  MyRestaurant,
  Schedule,
  ScheduleOverrideInput,
  SetManagerWhatsAppInput,
  PromoInput,
  PlatformBookings,
  PlatformOverview,
  PlatformPayments,
  PlatformGuest,
  PlatformGuestQuery,
  PlatformPeriod,
  PushSubscriptionInput,
  RestaurantManager,
  RestaurantPricePatch,
  RestaurantPricing,
  RestaurantProfile,
  Story,
  StoryInput,
  TelegramSettings,
  WhatsAppSettings,
  TokenPair,
  TopRestaurant,
  VenueDashboardSummary,
  VenueLoadSlot,
  VenueSearchResult,
  VenueToday,
  VenueTodayParams,
} from "./types";

/** Every backend response is wrapped in this envelope (response.Envelope). */
interface Envelope<T> {
  data?: T;
  error?: string;
  /** Machine-readable failure code (additive since 2026-07-25, omitted by
   * older builds). Surfaced on AdminApiError.code — branch on this, never on
   * the `error` text. */
  code?: string;
}

const DEFAULT_TIMEOUT_MS = 12000;

/** Image uploads carry up to 8MB of body, so the 12s JSON default would abort a
 * legitimate upload on a slow mobile connection and surface as a spurious
 * "network error". Give multipart its own, much longer budget. */
const UPLOAD_TIMEOUT_MS = 60000;

type Params = Record<string, string | number | boolean | undefined>;

export interface AdminApiClientOptions {
  baseUrl: string;
  /** Called before every authorized request to fetch the current bearer token.
   * Returning null/undefined sends the request unauthenticated. May be async:
   * the admin panel renews an about-to-expire token here, so the request goes
   * out with a token that is still valid rather than one that dies in flight. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /**
   * Called at most once per request when an AUTHORIZED request comes back 401,
   * with the token that request carried. Return a fresh token to retry the
   * request exactly once (never more — a loop here is an infinite login
   * bounce), or null to let the 401 propagate to the caller.
   *
   * Unauthenticated requests (`auth: false`, i.e. login/refresh/logout) never
   * reach this hook, so a refresh cannot recurse into itself.
   */
  onUnauthorized?: (usedToken: string | null) => Promise<string | null>;
  timeoutMs?: number;
}

/**
 * HTTP client for the restaurant admin panel over `/api/v1`. Mirrors the
 * mobile HttpClient's envelope/RepositoryError normalization (see
 * ../http-client.ts) but adds bearer auth and write verbs, which the
 * read-only mobile client does not need.
 *
 * Auth note: the backend exposes a single `POST /auth/login` (email +
 * password) — there is no separate staff-login endpoint. A user's staff role
 * for a given restaurant is enforced server-side by RequireRestaurantManager +
 * the usecase RBAC matrix; there is currently NO endpoint that lists the
 * restaurants a signed-in user manages, so the panel takes the restaurant id
 * explicitly and validates it via getProfile (403 => not a manager here).
 */
export class AdminApiClient {
  private readonly baseUrl: string;
  private readonly getToken?: AdminApiClientOptions["getToken"];
  private readonly onUnauthorized?: AdminApiClientOptions["onUnauthorized"];
  private readonly timeoutMs: number;

  constructor(options: AdminApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.getToken = options.getToken;
    this.onUnauthorized = options.onUnauthorized;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    opts: { params?: Params; body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        if (value === undefined || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    const authorized = opts.auth !== false;
    const token = authorized ? ((await this.getToken?.()) ?? null) : null;

    const send = (bearer: string | null): Promise<Response> => {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (opts.body !== undefined) headers["Content-Type"] = "application/json";
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      return fetch(url.toString(), {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        // A fresh signal per attempt: an aborted one would kill the retry too.
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    };

    let response: Response;
    try {
      response = await send(token);
      // The access token died (or was revoked) — give the session one chance to
      // renew and replay the request. Exactly one: `send` is not called again
      // after this branch, so there is no way to loop.
      if (response.status === 401 && authorized && this.onUnauthorized) {
        const renewed = await this.onUnauthorized(token);
        if (renewed) response = await send(renewed);
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new RepositoryError(`Request to ${path} timed out after ${this.timeoutMs}ms`, cause);
      }
      if (cause instanceof RepositoryError) throw cause; // e.g. a failed refresh
      throw new RepositoryError(`Network error requesting ${path}`, cause);
    }

    // 204 / empty-body successes (none today, but be defensive).
    if (response.status === 204) return undefined as T;

    let body: Envelope<T> | undefined;
    try {
      body = (await response.json()) as Envelope<T>;
    } catch (cause) {
      if (!response.ok) {
        throw new AdminApiError(
          `Server error ${response.status} requesting ${path}`,
          response.status,
          cause,
        );
      }
      throw new RepositoryError(`Empty or malformed response from ${path}`, cause);
    }

    if (!response.ok) {
      throw new AdminApiError(
        body?.error ?? `Server error ${response.status} requesting ${path}`,
        response.status,
        undefined,
        body?.code,
      );
    }

    return body?.data as T;
  }

  // ---- Auth ----------------------------------------------------------------

  login(email: string, password: string): Promise<TokenPair> {
    return this.request<TokenPair>("POST", "/auth/login", {
      body: { email, password },
      auth: false,
    });
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.request<TokenPair>("POST", "/auth/refresh", {
      body: { refresh_token: refreshToken },
      auth: false,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.request<unknown>("POST", "/auth/logout", {
      body: { refresh_token: refreshToken },
      auth: false,
    });
  }

  getMe(): Promise<AuthUser> {
    return this.request<AuthUser>("GET", "/users/me");
  }

  // ---- Restaurant context --------------------------------------------------

  getProfile(restaurantId: string): Promise<RestaurantProfile> {
    return this.request<RestaurantProfile>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/profile`,
    );
  }

  /** GET /admin/my-restaurants — the restaurants the signed-in staff member
   * manages, for the post-login picker. Returns the raw list (unwraps the
   * `{restaurants: [...]}` envelope). May be empty (fall back to the manual
   * restaurant-id gate). */
  async listMyRestaurants(): Promise<MyRestaurant[]> {
    const res = await this.request<{ restaurants: MyRestaurant[] }>(
      "GET",
      "/admin/my-restaurants",
    );
    return res?.restaurants ?? [];
  }

  // ---- Venue catalog (superadmin) -----------------------------------------

  /**
   * GET /admin/restaurants — the catalog INCLUDING hidden venues.
   *
   * The public listing answers only active venues, which would make a venue
   * disappear from the panel the moment it is hidden — and there would be no
   * way back. This is the same shape, hidden ones included, so the row can say
   * so and offer to bring the venue back.
   */
  listCatalogVenues(params: {
    search?: string;
    city?: string;
    page?: number;
    perPage?: number;
  } = {}): Promise<ApiPage<CatalogVenue>> {
    return this.request<ApiPage<CatalogVenue>>("GET", "/admin/restaurants", {
      params: {
        search: params.search,
        city: params.city,
        page: params.page,
        per_page: params.perPage,
      },
    });
  }

  /** POST /restaurants — create a venue. Superadmin only. */
  createVenue(input: CatalogVenueInput): Promise<CatalogVenue> {
    return this.request<CatalogVenue>("POST", "/restaurants", { body: input });
  }

  /** PATCH /restaurants/:id — partial update. Omitted keys are left alone. */
  updateVenue(id: string, input: CatalogVenueInput): Promise<CatalogVenue> {
    return this.request<CatalogVenue>("PATCH", `/restaurants/${encodeURIComponent(id)}`, {
      body: input,
    });
  }

  /**
   * DELETE /restaurants/:id — deactivates the venue (the backend soft-deletes:
   * `is_active = false`). Bringing it back is `updateVenue(id, {is_active:
   * true})`, which is why the panel calls this "скрыть", not "удалить
   * навсегда".
   */
  async deactivateVenue(id: string): Promise<void> {
    await this.request<unknown>("DELETE", `/restaurants/${encodeURIComponent(id)}`);
  }

  // ---- Справочник кухонь ----------------------------------------------------
  //
  // Справочник принадлежит ПЛАТФОРМЕ: читать его может кто угодно
  // (`GET /cuisines` смонтирован публично), а править — только суперадмин
  // (`/admin/cuisines` под RequireRole(RoleAdmin), и usecase проверяет роль
  // повторно). Набор кухонь ЗАВЕДЕНИЯ живёт отдельно и пишется целиком.

  /** GET /cuisines — активные кухни в порядке справочника. Публичный роут:
   * им пользуются и приложение, и выбор кухни в панели, чтобы список был один. */
  listCuisines(): Promise<CuisineDictionaryEntry[]> {
    return this.request<CuisineDictionaryEntry[]>("GET", "/cuisines");
  }

  /** GET /admin/cuisines — справочник глазами владельца: СО скрытыми записями.
   * Без них скрытую кухню нельзя было бы вернуть. Только суперадмин. */
  listCuisinesForAdmin(): Promise<CuisineDictionaryEntry[]> {
    return this.request<CuisineDictionaryEntry[]>("GET", "/admin/cuisines");
  }

  /** POST /admin/cuisines. `code` — машинный ключ (a-z, 0-9, _): по нему
   * клиенты подбирают запасную картинку, поэтому кириллица и пробелы сервером
   * отвергаются. */
  createCuisine(input: CuisineSaveInput): Promise<CuisineDictionaryEntry> {
    return this.request<CuisineDictionaryEntry>("POST", "/admin/cuisines", { body: input });
  }

  /** PATCH /admin/cuisines/:id — меняет только присланные ключи. */
  updateCuisine(id: string, input: CuisineSaveInput): Promise<CuisineDictionaryEntry> {
    return this.request<CuisineDictionaryEntry>(
      "PATCH",
      `/admin/cuisines/${encodeURIComponent(id)}`,
      { body: input },
    );
  }

  /**
   * DELETE /admin/cuisines/:id — СКРЫВАЕТ запись (`is_active = false`), а не
   * удаляет: на кухню ссылаются заведения и предпочтения гостей, и удаление
   * унесло бы эти данные с собой. Ответ — та же запись с is_active: false.
   * Вернуть её — `updateCuisine(id, {is_active: true})`.
   */
  hideCuisine(id: string): Promise<CuisineDictionaryEntry> {
    return this.request<CuisineDictionaryEntry>(
      "DELETE",
      `/admin/cuisines/${encodeURIComponent(id)}`,
    );
  }

  /** GET /restaurants/:id/cuisines — набор кухонь заведения В ЕГО ПОРЯДКЕ:
   * первая позиция — главная кухня. */
  getRestaurantCuisines(restaurantId: string): Promise<CuisineDictionaryEntry[]> {
    return this.request<CuisineDictionaryEntry[]>(
      "GET",
      `/restaurants/${encodeURIComponent(restaurantId)}/cuisines`,
    );
  }

  /**
   * PUT /restaurants/:id/cuisines — ЗАМЕЩАЕТ набор целиком (PUT, не PATCH).
   * Порядок значим, до пяти штук, скрытую кухню сервер не примет. Отправлять
   * можно только полный набор: `[]` очищает кухни заведения.
   */
  setRestaurantCuisines(
    restaurantId: string,
    cuisineIds: readonly string[],
  ): Promise<CuisineDictionaryEntry[]> {
    return this.request<CuisineDictionaryEntry[]>(
      "PUT",
      `/restaurants/${encodeURIComponent(restaurantId)}/cuisines`,
      { body: { cuisine_ids: [...cuisineIds] } },
    );
  }

  // ---- Справочник удобств («Удобства») -------------------------------------
  //
  // Тот же расклад, что у кухонь: `GET /venue-features` смонтирован публично,
  // управление (`/admin/venue-features`) — под RequireRole(RoleAdmin), а набор
  // удобств ЗАВЕДЕНИЯ пишется своей ручкой на группе restScoped
  // (RequireRestaurantManager) — то есть управляющий заведения правит свои
  // удобства сам, без платформы.
  //
  // ВАЖНО: свободнотекстовые удобства в теле `PATCH /restaurants/:id` сервер
  // теперь ОТВЕРГАЕТ с 422, поэтому ключа `features` в CatalogVenueInput нет и
  // быть не должно.

  /** GET /venue-features — активные удобства в порядке справочника. Публичный
   * роут: им пользуются и приложение, и панель, чтобы список был один. */
  listVenueFeatures(): Promise<VenueFeatureDictionaryEntry[]> {
    return this.request<VenueFeatureDictionaryEntry[]>("GET", "/venue-features");
  }

  /** GET /admin/venue-features — справочник глазами владельца: СО скрытыми
   * записями. Без них скрытое удобство нельзя было бы вернуть. */
  listVenueFeaturesForAdmin(): Promise<VenueFeatureDictionaryEntry[]> {
    return this.request<VenueFeatureDictionaryEntry[]>("GET", "/admin/venue-features");
  }

  /** POST /admin/venue-features. `code` — машинный ключ (a-z, 0-9, _): по нему
   * ездит фильтр каталога и клиенты подбирают иконку. */
  createVenueFeature(input: VenueFeatureSaveInput): Promise<VenueFeatureDictionaryEntry> {
    return this.request<VenueFeatureDictionaryEntry>("POST", "/admin/venue-features", {
      body: input,
    });
  }

  /** PATCH /admin/venue-features/:id — меняет только присланные ключи. */
  updateVenueFeature(
    id: string,
    input: VenueFeatureSaveInput,
  ): Promise<VenueFeatureDictionaryEntry> {
    return this.request<VenueFeatureDictionaryEntry>(
      "PATCH",
      `/admin/venue-features/${encodeURIComponent(id)}`,
      { body: input },
    );
  }

  /**
   * DELETE /admin/venue-features/:id — СКРЫВАЕТ запись (`is_active = false`),
   * а не удаляет: на удобство ссылаются заведения. Ответ — та же запись с
   * is_active: false. Вернуть — `updateVenueFeature(id, {is_active: true})`.
   */
  hideVenueFeature(id: string): Promise<VenueFeatureDictionaryEntry> {
    return this.request<VenueFeatureDictionaryEntry>(
      "DELETE",
      `/admin/venue-features/${encodeURIComponent(id)}`,
    );
  }

  /** GET /restaurants/:id/features — набор удобств заведения. */
  getRestaurantFeatures(restaurantId: string): Promise<VenueFeatureDictionaryEntry[]> {
    return this.request<VenueFeatureDictionaryEntry[]>(
      "GET",
      `/restaurants/${encodeURIComponent(restaurantId)}/features`,
    );
  }

  /**
   * PUT /restaurants/:id/features — ЗАМЕЩАЕТ набор целиком (PUT, не PATCH).
   * До пятнадцати штук, скрытое удобство сервер не примет. Отправлять можно
   * только полный набор: `[]` очищает удобства заведения.
   */
  setRestaurantFeatures(
    restaurantId: string,
    featureIds: readonly string[],
  ): Promise<VenueFeatureDictionaryEntry[]> {
    return this.request<VenueFeatureDictionaryEntry[]>(
      "PUT",
      `/restaurants/${encodeURIComponent(restaurantId)}/features`,
      { body: { feature_ids: [...featureIds] } },
    );
  }

  // ---- Справочник городов --------------------------------------------------
  //
  // Тот же расклад, что у кухонь: читают все, правит только платформа
  // (`/admin/cities` под RequireRole(RoleAdmin), usecase проверяет роль ещё
  // раз). Отличий от кухонь два, и оба важны:
  //   • публичный `GET /cities` БЕЗ параметров отдаёт голый массив названий —
  //     замороженный контракт старой сборки. Панели нужен `?format=full`;
  //   • у порядка есть СВОЯ ручка `PUT /admin/cities/order`, принимающая весь
  //     список id разом, поэтому перестановка тут один запрос, а не пачка
  //     PATCH-ей, как у кухонь.

  /** GET /cities?format=full — активные города в порядке справочника, полными
   * записями. Без `format=full` этот же адрес отдаёт массив строк. */
  listCities(): Promise<CityDictionaryEntry[]> {
    return this.request<CityDictionaryEntry[]>("GET", "/cities", {
      params: { format: "full" },
    });
  }

  /** GET /admin/cities — справочник глазами владельца: СО скрытыми записями.
   * Только для суперадмина. */
  listCitiesForAdmin(): Promise<CityDictionaryEntry[]> {
    return this.request<CityDictionaryEntry[]>("GET", "/admin/cities");
  }

  /** POST /admin/cities. `code` — машинный ключ (a-z, 0-9, _): он ездит в
   * адресной строке и не зависит от языка, поэтому менять его потом не стоит. */
  createCity(input: CitySaveInput): Promise<CityDictionaryEntry> {
    return this.request<CityDictionaryEntry>("POST", "/admin/cities", { body: input });
  }

  /** PATCH /admin/cities/:id — меняет только присланные ключи. Переименование
   * сервер проводит в одной транзакции с переписыванием строки `city` у всех
   * заведений этого города. */
  updateCity(id: string, input: CitySaveInput): Promise<CityDictionaryEntry> {
    return this.request<CityDictionaryEntry>(
      "PATCH",
      `/admin/cities/${encodeURIComponent(id)}`,
      { body: input },
    );
  }

  /**
   * DELETE /admin/cities/:id — СКРЫВАЕТ запись (`is_active = false`), а не
   * удаляет: на город ссылаются заведения (FK RESTRICT) и его название лежит
   * строкой в `restaurants.city`. Вернуть — `updateCity(id, {is_active: true})`.
   */
  hideCity(id: string): Promise<CityDictionaryEntry> {
    return this.request<CityDictionaryEntry>(
      "DELETE",
      `/admin/cities/${encodeURIComponent(id)}`,
    );
  }

  /** PUT /admin/cities/order — весь порядок разом, последовательностью id.
   * Отвечает справочником целиком, включая скрытые записи. */
  reorderCities(cityIds: readonly string[]): Promise<CityDictionaryEntry[]> {
    return this.request<CityDictionaryEntry[]>("PUT", "/admin/cities/order", {
      body: { city_ids: [...cityIds] },
    });
  }

  /**
   * POST /admin/cities/:id/aliases — ещё одно написание, означающее этот город.
   *
   * Синоним ничего не переименовывает. Он учит базу узнавать город по чужой
   * строке: заведение, у которого город записан этим написанием, привяжется к
   * записи справочника при следующей записи строки (триггер
   * `trg_restaurants_sync_city`), и его написание приведётся к каноническому.
   */
  addCityAlias(id: string, alias: string): Promise<CityDictionaryEntry> {
    return this.request<CityDictionaryEntry>(
      "POST",
      `/admin/cities/${encodeURIComponent(id)}/aliases`,
      { body: { alias } },
    );
  }

  // ---- Platform dashboard (superadmin) -------------------------------------
  //
  // Platform-wide, NOT venue-scoped: the backend gates these on the global
  // admin role and they take no restaurant id. A staff member of one venue
  // gets 403, which is the intended answer, not an error to work around.

  /** GET /admin/dashboard/overview — counters with no period. */
  platformOverview(): Promise<PlatformOverview> {
    return this.request<PlatformOverview>("GET", "/admin/dashboard/overview");
  }

  /** GET /admin/dashboard/bookings — booking counts by status over a period.
   * Omitting the period lets the backend apply its own window. */
  platformBookings(period: PlatformPeriod = {}): Promise<PlatformBookings> {
    return this.request<PlatformBookings>("GET", "/admin/dashboard/bookings", {
      params: { from: period.from, to: period.to },
    });
  }

  /** GET /admin/dashboard/payments — captured and refunded volume. Amounts come
   * back in minor units and stay integers all the way to the formatter. */
  platformPayments(period: PlatformPeriod = {}, currency?: string): Promise<PlatformPayments> {
    return this.request<PlatformPayments>("GET", "/admin/dashboard/payments", {
      params: { from: period.from, to: period.to, currency },
    });
  }

  /** GET /admin/dashboard/top-restaurants — leaderboard by bookings or GMV.
   * Unwraps the `{restaurants: [...]}` envelope like listMyRestaurants does. */
  async platformTopRestaurants(
    period: PlatformPeriod = {},
    by: "bookings" | "gmv" = "bookings",
    limit = 10,
  ): Promise<TopRestaurant[]> {
    const res = await this.request<{ restaurants: TopRestaurant[] }>(
      "GET",
      "/admin/dashboard/top-restaurants",
      { params: { from: period.from, to: period.to, by, limit } },
    );
    return res?.restaurants ?? [];
  }

  // ---- Venue dashboard -----------------------------------------------------

  /** GET /restaurants/:id/dashboard/summary — the venue's own counters. */
  venueDashboardSummary(
    restaurantId: string,
    period: PlatformPeriod = {},
  ): Promise<VenueDashboardSummary> {
    return this.request<VenueDashboardSummary>(
      "GET",
      `/restaurants/${restaurantId}/dashboard/summary`,
      { params: { from: period.from, to: period.to } },
    );
  }

  /** GET /restaurants/:id/dashboard/load — occupancy by weekday and hour.
   * Unwraps the `{slots: [...]}` envelope. */
  async venueDashboardLoad(
    restaurantId: string,
    period: PlatformPeriod = {},
  ): Promise<VenueLoadSlot[]> {
    const res = await this.request<{ slots: VenueLoadSlot[] }>(
      "GET",
      `/restaurants/${restaurantId}/dashboard/load`,
      { params: { from: period.from, to: period.to } },
    );
    return res?.slots ?? [];
  }

  /**
   * GET /restaurants/:id/dashboard/today — what still needs an answer and what
   * the venue's local day looks like. No period: the server owns "today".
   *
   * The arrays are defaulted so a screen never has to guard `?.map` — the Go
   * handler always sends them, but a proxy that swallows the body should not
   * turn into a crash on the panel's landing page.
   */
  async venueDashboardToday(
    restaurantId: string,
    params: VenueTodayParams = {},
  ): Promise<VenueToday> {
    const res = await this.request<VenueToday>(
      "GET",
      `/restaurants/${encodeURIComponent(restaurantId)}/dashboard/today`,
      { params: { awaiting_limit: params.awaiting_limit, today_limit: params.today_limit } },
    );
    return {
      awaiting: res?.awaiting ?? [],
      awaiting_total: res?.awaiting_total ?? 0,
      today: res?.today ?? [],
      today_total: res?.today_total ?? 0,
      guests: res?.guests ?? 0,
    };
  }

  // ---- Events --------------------------------------------------------------

  listEvents(restaurantId: string, params: AdminListParams = {}): Promise<ApiPage<AdminEvent>> {
    return this.request<ApiPage<AdminEvent>>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/events`,
      {
        params: {
          status: params.statuses?.length ? params.statuses.join(",") : undefined,
          page: params.page,
          per_page: params.per_page,
        },
      },
    );
  }

  getEvent(eventId: string): Promise<AdminEvent> {
    return this.request<AdminEvent>("GET", `/admin/events/${encodeURIComponent(eventId)}`);
  }

  createEvent(restaurantId: string, input: EventInput): Promise<AdminEvent> {
    return this.request<AdminEvent>(
      "POST",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/events`,
      { body: input },
    );
  }

  updateEvent(eventId: string, input: EventInput): Promise<AdminEvent> {
    return this.request<AdminEvent>("PUT", `/admin/events/${encodeURIComponent(eventId)}`, {
      body: input,
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.request<unknown>("DELETE", `/admin/events/${encodeURIComponent(eventId)}`);
  }

  // ---- Правила повтора (серии событий) -------------------------------------
  //
  // Правило — ГЕНЕРАТОР дат, а не дата. Гость правил не видит вовсе: он видит
  // события, которые они породили, через уже существующие публичные ручки.
  //
  // DELETE тут нет и не будет (см. events.RecurrenceHandler): у правила уже
  // есть прошедшие даты с проданными билетами, поэтому серию ВЫКЛЮЧАЮТ
  // (`deactivateEventRecurrence`), а не уничтожают.

  listEventRecurrences(
    restaurantId: string,
    params: AdminListParams = {},
  ): Promise<ApiPage<AdminEventRecurrence>> {
    return this.request<ApiPage<AdminEventRecurrence>>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/event-recurrences`,
      { params: { page: params.page, per_page: params.per_page } },
    );
  }

  getEventRecurrence(recurrenceId: string): Promise<AdminEventRecurrence> {
    return this.request<AdminEventRecurrence>(
      "GET",
      `/admin/event-recurrences/${encodeURIComponent(recurrenceId)}`,
    );
  }

  /** PUT — ПОЛНАЯ ЗАМЕНА правила. Тело собирать только `recurrenceToInput`. */
  updateEventRecurrence(
    recurrenceId: string,
    input: EventRecurrenceInput,
  ): Promise<AdminEventRecurrence> {
    return this.request<AdminEventRecurrence>(
      "PUT",
      `/admin/event-recurrences/${encodeURIComponent(recurrenceId)}`,
      { body: input },
    );
  }

  /** Останавливает ГЕНЕРАЦИЮ новых дат. Уже созданные даты не трогает — это
   * ровно то различие, которое кабинет обязан показать человеку словами. */
  async deactivateEventRecurrence(recurrenceId: string): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/admin/event-recurrences/${encodeURIComponent(recurrenceId)}/deactivate`,
    );
  }

  async activateEventRecurrence(recurrenceId: string): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/admin/event-recurrences/${encodeURIComponent(recurrenceId)}/activate`,
    );
  }

  /** Заявка на главную для ВСЕЙ серии (migration 0075): модерируется серия,
   * даты наследуют вердикт. Ничего не одобряет — одобряет суперадмин. */
  submitRecurrenceToFeed(recurrenceId: string): Promise<AdminEventRecurrence> {
    return this.request<AdminEventRecurrence>(
      "POST",
      `/admin/event-recurrences/${encodeURIComponent(recurrenceId)}/feed/submit`,
    );
  }

  withdrawRecurrenceFromFeed(recurrenceId: string): Promise<AdminEventRecurrence> {
    return this.request<AdminEventRecurrence>(
      "POST",
      `/admin/event-recurrences/${encodeURIComponent(recurrenceId)}/feed/withdraw`,
    );
  }

  // ---- Платформенные события и акции ---------------------------------------
  //
  // Контент, у которого НЕТ заведения (backend PR #103, migration 0085). Свои
  // только СОЗДАНИЕ и СПИСОК: правка, чтение и удаление идут теми же
  // `/admin/events/:id` и `/admin/promos/:id`, что и у заведения — они сначала
  // находят запись и авторизуют по её владельцу, так что второй ручки для
  // платформы там не нужно. Доступ — только суперадмину
  // (domain.PlatformContentRoles); всем остальным сервер отвечает 403.

  listPlatformEvents(params: AdminListParams = {}): Promise<ApiPage<AdminEvent>> {
    return this.request<ApiPage<AdminEvent>>("GET", "/admin/platform/events", {
      params: {
        status: params.statuses?.length ? params.statuses.join(",") : undefined,
        page: params.page,
        per_page: params.per_page,
      },
    });
  }

  createPlatformEvent(input: EventInput): Promise<AdminEvent> {
    return this.request<AdminEvent>("POST", "/admin/platform/events", { body: input });
  }

  listPlatformPromos(params: AdminListParams = {}): Promise<ApiPage<AdminPromo>> {
    return this.request<ApiPage<AdminPromo>>("GET", "/admin/platform/promos", {
      params: {
        status: params.statuses?.length ? params.statuses.join(",") : undefined,
        page: params.page,
        per_page: params.per_page,
      },
    });
  }

  createPlatformPromo(input: PromoInput): Promise<AdminPromo> {
    return this.request<AdminPromo>("POST", "/admin/platform/promos", { body: input });
  }

  // ---- Promos --------------------------------------------------------------

  listPromos(restaurantId: string, params: AdminListParams = {}): Promise<ApiPage<AdminPromo>> {
    return this.request<ApiPage<AdminPromo>>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/promos`,
      {
        params: {
          status: params.statuses?.length ? params.statuses.join(",") : undefined,
          page: params.page,
          per_page: params.per_page,
        },
      },
    );
  }

  getPromo(promoId: string): Promise<AdminPromo> {
    return this.request<AdminPromo>("GET", `/admin/promos/${encodeURIComponent(promoId)}`);
  }

  createPromo(restaurantId: string, input: PromoInput): Promise<AdminPromo> {
    return this.request<AdminPromo>(
      "POST",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/promos`,
      { body: input },
    );
  }

  updatePromo(promoId: string, input: PromoInput): Promise<AdminPromo> {
    return this.request<AdminPromo>("PUT", `/admin/promos/${encodeURIComponent(promoId)}`, {
      body: input,
    });
  }

  async deletePromo(promoId: string): Promise<void> {
    await this.request<unknown>("DELETE", `/admin/promos/${encodeURIComponent(promoId)}`);
  }

  // ---- Stories (restaurant rail) -------------------------------------------
  //
  // Restaurant-scoped CRUD for the story rail on a venue's card (backend PR #71,
  // PermRestaurantManage). The LIST returns EVERY story, active and inactive,
  // already ordered by sort_order; the create/patch routes carry the venue id or
  // the story id as the contract dictates.

  /** GET /admin/restaurants/:id/stories — all stories (incl. inactive), ordered
   * by sort_order. Returns the raw array (the envelope's data IS the array). */
  listStories(restaurantId: string): Promise<Story[]> {
    return this.request<Story[]>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/stories`,
    ).then((res) => res ?? []);
  }

  /** POST /admin/restaurants/:id/stories — create one. `image_url` is required;
   * `sort_order` defaults to the end and `is_active` to true server-side. */
  createStory(restaurantId: string, input: StoryInput): Promise<Story> {
    return this.request<Story>(
      "POST",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/stories`,
      { body: input },
    );
  }

  /** PUT /admin/stories/:storyId — partial update (the story id resolves its
   * owning restaurant server-side). Send only the changed fields. */
  updateStory(storyId: string, input: Partial<StoryInput>): Promise<Story> {
    return this.request<Story>("PUT", `/admin/stories/${encodeURIComponent(storyId)}`, {
      body: input,
    });
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.request<unknown>("DELETE", `/admin/stories/${encodeURIComponent(storyId)}`);
  }

  /**
   * POST /admin/restaurants/:id/stories/reorder — rewrite sort_order to match
   * the given id order. Foreign ids are ignored server-side, so a payload built
   * from a slightly stale list is safe (it never touches stories it does not
   * name). Carries the WHOLE intended order rather than a move, so replaying it
   * after a lost response is harmless.
   */
  async reorderStories(restaurantId: string, orderedIds: string[]): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/stories/reorder`,
      { body: { ordered_ids: orderedIds } },
    );
  }

  // ---- Home-feed placement (venue submit / withdraw) -----------------------
  //
  // The app's Home rail shows a promo/event only after the venue SUBMITS it and
  // a superadmin APPROVES it. These four are the venue side of that flow; the
  // superadmin moderation queue is a separate section. Authorization
  // (PermRestaurantManage at the item's OWN restaurant) is enforced server-side
  // inside the usecase — the per-item routes carry an item id, not a restaurant
  // id, so the backend resolves the owning restaurant from the item.

  /** GET /admin/restaurants/:id/feed — every promo AND event of this venue with
   * its derived feed state, in one page. The panel fetches this once and maps
   * the result by (kind, id) rather than asking per item. NOTE: promos and
   * events share this one page, so `per_page` caps the COMBINED count (server
   * max 100). */
  listVenueFeed(
    restaurantId: string,
    params: AdminListParams = {},
  ): Promise<ApiPage<FeedItemState>> {
    return this.request<ApiPage<FeedItemState>>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/feed`,
      { params: { page: params.page, per_page: params.per_page } },
    );
  }

  /** GET /admin/feed/items/:kind/:itemId — one item's current feed state. */
  getFeedItem(kind: FeedItemKind, itemId: string): Promise<FeedItemState> {
    return this.request<FeedItemState>(
      "GET",
      `/admin/feed/items/${kind}/${encodeURIComponent(itemId)}`,
    );
  }

  /** POST …/submit (no body) — sends the item for moderation:
   * not_submitted|rejected → pending_review. Answers the new state. Replaying a
   * lost response is harmless (a resubmit of an already-pending item is a no-op
   * on the server's side of the transition guard). */
  submitFeedItem(kind: FeedItemKind, itemId: string): Promise<FeedItemState> {
    return this.request<FeedItemState>(
      "POST",
      `/admin/feed/items/${kind}/${encodeURIComponent(itemId)}/submit`,
    );
  }

  /** POST …/withdraw (no body) — pulls the item back toward not_submitted from
   * pending_review or approved. Answers the new state. */
  withdrawFeedItem(kind: FeedItemKind, itemId: string): Promise<FeedItemState> {
    return this.request<FeedItemState>(
      "POST",
      `/admin/feed/items/${kind}/${encodeURIComponent(itemId)}/withdraw`,
    );
  }

  // ---- Home-feed placement (platform / superadmin moderation) --------------
  //
  // The superadmin side of the merchandising feed: the pending_review queue and
  // the two decisions taken on it. All three are mounted on the
  // RequireRole(RoleAdmin) group (GET /admin/feed/queue, .../review,
  // .../placement-weight) and re-check the superadmin role in the usecase — a
  // venue manager gets a 403, so the panel hides the screen from them.

  /** GET /admin/feed/queue — the platform-wide moderation queue: every item in
   * `pending_review`, oldest first, paginated (server per_page max 100). One
   * page of `FeedItemState`, same shape as the venue side. */
  listFeedQueue(params: AdminListParams = {}): Promise<ApiPage<FeedItemState>> {
    return this.request<ApiPage<FeedItemState>>("GET", "/admin/feed/queue", {
      params: { page: params.page, per_page: params.per_page },
    });
  }

  /** POST …/review — approve or reject a pending item, optionally pricing the
   * placement in the same call. `approve=false` requires a non-empty
   * `rejection_reason` (enforced again server-side). Answers the new state. */
  reviewFeedItem(
    kind: FeedItemKind,
    itemId: string,
    input: FeedReviewInput,
  ): Promise<FeedItemState> {
    return this.request<FeedItemState>(
      "POST",
      `/admin/feed/items/${kind}/${encodeURIComponent(itemId)}/review`,
      { body: input },
    );
  }

  /** PUT …/placement-weight — set the paid-placement lever (0..100) on an
   * already-moderated item without re-reviewing it. Answers the new state. */
  setFeedPlacementWeight(
    kind: FeedItemKind,
    itemId: string,
    weight: number,
  ): Promise<FeedItemState> {
    return this.request<FeedItemState>(
      "PUT",
      `/admin/feed/items/${kind}/${encodeURIComponent(itemId)}/placement-weight`,
      { body: { placement_weight: weight } },
    );
  }

  // ---- Schedule ------------------------------------------------------------

  getSchedule(restaurantId: string): Promise<Schedule> {
    return this.request<Schedule>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/schedule`,
    );
  }

  async setWorkingHours(
    restaurantId: string,
    workingHours: Schedule["working_hours"],
  ): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/working-hours`,
      { body: { working_hours: workingHours } },
    );
  }

  async setScheduleOverride(restaurantId: string, override: ScheduleOverrideInput): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/schedule/overrides`,
      { body: override },
    );
  }

  async deleteScheduleOverride(restaurantId: string, date: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/schedule/overrides/${encodeURIComponent(
        date,
      )}`,
    );
  }

  // ---- Booking policy / capacity mode --------------------------------------

  /** NOTE the path: this pair is NOT under `/admin`. bookings.Handler's
   * venue-cabinet routes are mounted on the plain authenticated group
   * (bootstrap/app.go: `bookingScoped := authed.Group("")`), so the real URL is
   * `/api/v1/restaurants/:id/booking-policy`. Staff membership is enforced by
   * RequireRestaurantManager on that group all the same. */
  getBookingPolicy(restaurantId: string): Promise<BookingPolicy> {
    return this.request<BookingPolicy>(
      "GET",
      `/restaurants/${encodeURIComponent(restaurantId)}/booking-policy`,
    );
  }

  /**
   * PATCH /restaurants/:id/booking-policy (not under `/admin` — see above).
   *
   * This is the single most consequential thing the cabinet can do to
   * EXISTING reservations: switching between `tables` and `seats` rewrites
   * every live booking's occupancy inside one transaction (seats every
   * table-less booking at a real table, or backfills capacity holds). It is
   * therefore also the one write with refusals a staff member has to be able
   * to tell apart — see classifyCapacitySwitchFailure.
   *
   * Answers the whole policy (effective + overrides) on success.
   */
  updateBookingPolicy(restaurantId: string, patch: BookingPolicyPatch): Promise<BookingPolicy> {
    return this.request<BookingPolicy>(
      "PATCH",
      `/restaurants/${encodeURIComponent(restaurantId)}/booking-policy`,
      { body: patch },
    );
  }

  // ---- Restaurant pricing (average check) ----------------------------------
  //
  // NOTE the paths: the READ is `GET /admin/restaurants/:id`, the WRITE is
  // `PATCH /restaurants/:id` — like booking-policy, the write is NOT under
  // `/admin`. Both are mounted on the same RequireRestaurantManager(…, "id")
  // group (RegisterRestaurantScoped), so the venue's own manager reaches both;
  // the backend STRIPS the marketing flags and `is_active` for non-admin
  // callers, so this UI only ever sends the pricing fields.

  /**
   * GET /admin/restaurants/:id — the venue as the CABINET sees it.
   *
   * NOT the public `GET /restaurants/:id`, which is what this used to call. The
   * public endpoint serves the catalog, and the catalog does not contain a
   * deactivated venue: `is_active = false` made it answer 404, and the panel
   * turned that into «Не удалось загрузить. Проверьте соединение» — sending
   * people to look for a network fault while the venue was simply hidden.
   *
   * The admin read is mounted on the same RequireRestaurantManager(…, "id")
   * group as the write below, sees hidden venues, and carries the numeric
   * `price_range` next to the categorical `price_category` (the admin profile
   * endpoint, `getProfile`, returns the tier alone). It also does NOT localize:
   * the panel gets the venue's own stored fields rather than a translation
   * resolved from Accept-Language.
   */
  getRestaurantPricing(restaurantId: string): Promise<RestaurantPricing> {
    return this.request<RestaurantPricing>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}`,
    );
  }

  // ---- Ссылки на соцсети ----------------------------------------------------
  //
  // Тот же PATCH /restaurants/:id и тот же админский GET, что у «Среднего
  // чека». Оба роута смонтированы на группе RequireRestaurantManager, а
  // `social_links` (в отличие от is_active и маркетинговых флагов) для
  // не-админа НЕ вырезается — значит менеджер своего заведения правит свои
  // ссылки сам, без суперадмина.

  /**
   * GET /admin/restaurants/:id → `social_links`. Ключ ОПУЩЕН, когда ссылок нет
   * (`omitempty`), поэтому пустой ответ и отсутствие ссылок — одно и то же.
   *
   * Читается админской ручкой, а не публичной карточкой: публичная не отдаёт
   * скрытое из каталога заведение (404), и у выключенного заведения блок
   * «Соцсети» не открывался вовсе — ни в настройках, ни в правке из каталога.
   */
  async getRestaurantSocialLinks(restaurantId: string): Promise<SocialLink[]> {
    const restaurant = await this.request<{ social_links?: SocialLink[] }>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}`,
    );
    return restaurant.social_links ?? [];
  }

  /**
   * PATCH /restaurants/:id — ЗАМЕЩАЕТ весь набор ссылок заведения
   * (ReplaceSocialLinks удаляет строки и вставляет присланные заново). Значит
   * отправлять можно только полный набор: `[]` стирает все ссылки, а частичный
   * список тихо потеряет остальные. Ответ — обновлённое заведение целиком,
   * читаем из него тот же список.
   */
  async setRestaurantSocialLinks(
    restaurantId: string,
    links: SocialLinkInput[],
  ): Promise<SocialLink[]> {
    const restaurant = await this.request<{ social_links?: SocialLink[] }>(
      "PATCH",
      `/restaurants/${encodeURIComponent(restaurantId)}`,
      { body: { social_links: links } },
    );
    return restaurant.social_links ?? [];
  }

  /**
   * PATCH /restaurants/:id — updates the venue's pricing. `price_min`/
   * `price_max` are whole tenge and the backend validates the MERGED row
   * (both-null-or-both-set, 0 <= min <= max), so the caller sends the pair
   * together or omits both. Answers the full updated restaurant; typed as the
   * pricing slice the card reads back.
   */
  patchRestaurant(restaurantId: string, input: RestaurantPricePatch): Promise<RestaurantPricing> {
    return this.request<RestaurantPricing>(
      "PATCH",
      `/restaurants/${encodeURIComponent(restaurantId)}`,
      { body: input },
    );
  }

  // ---- Telegram notification settings --------------------------------------

  /** GET /admin/restaurants/:id/notification-settings/telegram — where the
   * venue's booking/cancel alerts are delivered. */
  getTelegramSettings(restaurantId: string): Promise<TelegramSettings> {
    return this.request<TelegramSettings>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/notification-settings/telegram`,
    );
  }

  /** PUT — connect the alert chat. `chatId` is a numeric id or an @username. */
  setTelegramChatId(restaurantId: string, chatId: string): Promise<TelegramSettings> {
    return this.request<TelegramSettings>(
      "PUT",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/notification-settings/telegram`,
      { body: { telegram_chat_id: chatId } },
    );
  }

  /** DELETE — disconnect the alert chat. Idempotent. */
  async clearTelegramSettings(restaurantId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/notification-settings/telegram`,
    );
  }

  /** GET — the venue's WhatsApp alert number. */
  getWhatsAppSettings(restaurantId: string): Promise<WhatsAppSettings> {
    return this.request<WhatsAppSettings>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/notification-settings/whatsapp`,
    );
  }

  /** PUT — connect the alert number. The server normalizes it and answers with
   * what it stored, so the caller should render the RESPONSE, not the input. */
  setWhatsAppPhone(restaurantId: string, phone: string): Promise<WhatsAppSettings> {
    return this.request<WhatsAppSettings>(
      "PUT",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/notification-settings/whatsapp`,
      { body: { whatsapp_phone: phone } },
    );
  }

  /** DELETE — disconnect the alert number. Idempotent. */
  async clearWhatsAppSettings(restaurantId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/notification-settings/whatsapp`,
    );
  }

  // ---- Staff roster --------------------------------------------------------

  /**
   * GET /restaurants/:id/managers — персонал заведения.
   *
   * Роут смонтирован НЕ под `/admin`, а на обычной authed-группе
   * (bootstrap/app.go: `restHandler.RegisterStaffRoutes(authed)`): права
   * считает usecase, а не middleware. Список видит только владелец заведения
   * (право `staff.manage`) или суперадмин — остальным 403.
   */
  listManagers(restaurantId: string): Promise<RestaurantManager[]> {
    return this.request<RestaurantManager[]>(
      "GET",
      `/restaurants/${encodeURIComponent(restaurantId)}/managers`,
    );
  }

  /**
   * PATCH — согласие сотрудника получать брони в WhatsApp и номер для них.
   *
   * Тело только с WhatsApp-полями: `role` тем же запросом не трогаем, чтобы
   * галочка на согласии не могла случайно переписать роль. Сервер приводит
   * номер сам и отвечает сохранённой строкой — рисовать надо ОТВЕТ.
   */
  setManagerWhatsApp(
    restaurantId: string,
    managerId: string,
    input: SetManagerWhatsAppInput,
  ): Promise<RestaurantManager> {
    return this.request<RestaurantManager>(
      "PATCH",
      `/restaurants/${encodeURIComponent(restaurantId)}/managers/${encodeURIComponent(managerId)}`,
      { body: input },
    );
  }

  // ---- Guests --------------------------------------------------------------

  /** GET /admin/dashboard/guests — платформенный список гостей (суперадмин).
   * Пустые фильтры выбрасываются: сервер отличает «параметра нет» от «параметр
   * пустой», и пустая строка города означала бы «город равен пустому». */
  listPlatformGuests(query: PlatformGuestQuery = {}): Promise<ApiPage<PlatformGuest>> {
    const params: Record<string, string | number | undefined> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      params[key] = value as string | number;
    }
    return this.request<ApiPage<PlatformGuest>>("GET", "/admin/dashboard/guests", { params });
  }

  listGuests(restaurantId: string): Promise<AdminGuest[]> {
    return this.request<AdminGuest[]>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/guests`,
    );
  }

  // ---- Bookings ------------------------------------------------------------

  listBookings(restaurantId: string, params: BookingListParams = {}): Promise<ApiPage<AdminBooking>> {
    return this.request<ApiPage<AdminBooking>>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/bookings`,
      {
        params: {
          date: params.date,
          from: params.from,
          to: params.to,
          status: params.statuses?.length ? params.statuses.join(",") : undefined,
          page: params.page,
          per_page: params.per_page,
        },
      },
    );
  }

  confirmBooking(restaurantId: string, bookingId: string, body?: BookingReasonInput): Promise<AdminBooking> {
    return this.bookingAction(restaurantId, bookingId, "confirm", body);
  }

  rejectBooking(restaurantId: string, bookingId: string, body?: BookingReasonInput): Promise<AdminBooking> {
    return this.bookingAction(restaurantId, bookingId, "reject", body);
  }

  noShowBooking(restaurantId: string, bookingId: string, body?: BookingReasonInput): Promise<AdminBooking> {
    return this.bookingAction(restaurantId, bookingId, "no-show", body);
  }

  cancelBooking(restaurantId: string, bookingId: string, body?: BookingCancelInput): Promise<AdminBooking> {
    return this.bookingAction(restaurantId, bookingId, "cancel", body);
  }

  private bookingAction(
    restaurantId: string,
    bookingId: string,
    action: "confirm" | "reject" | "cancel" | "no-show",
    body?: BookingReasonInput | BookingCancelInput,
  ): Promise<AdminBooking> {
    return this.request<AdminBooking>(
      "POST",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/bookings/${encodeURIComponent(
        bookingId,
      )}/${action}`,
      { body: body ?? {} },
    );
  }

  // ---- Web push subscriptions ----------------------------------------------

  /** POST /push/subscriptions — register (or refresh) the caller's browser push
   * subscription for a restaurant they are staff of. NOTE: this route is NOT
   * under /admin — it is mounted on the plain authenticated group; membership
   * of `restaurant_id` is enforced server-side inside the usecase. Idempotent:
   * re-registering the same endpoint refreshes it. */
  async registerPushSubscription(input: PushSubscriptionInput): Promise<void> {
    await this.request<unknown>("POST", "/push/subscriptions", { body: input });
  }

  /** DELETE /push/subscriptions — remove the caller's own subscription by
   * endpoint. Idempotent (unknown endpoint still succeeds). */
  async unregisterPushSubscription(endpoint: string): Promise<void> {
    await this.request<unknown>("DELETE", "/push/subscriptions", { body: { endpoint } });
  }

  // ---- Menu ----------------------------------------------------------------

  listMenu(restaurantId: string, lang?: string): Promise<AdminMenuItem[]> {
    return this.request<AdminMenuItem[]>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/menu`,
      { params: { lang } },
    );
  }

  listMenuCategories(restaurantId: string): Promise<AdminMenuCategory[]> {
    return this.request<AdminMenuCategory[]>(
      "GET",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/menu-categories`,
    );
  }

  async setMenuItemAvailability(
    restaurantId: string,
    itemId: string,
    isAvailable: boolean,
  ): Promise<void> {
    await this.request<unknown>(
      "PATCH",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/menu-items/${encodeURIComponent(
        itemId,
      )}/availability`,
      { body: { is_available: isAvailable } },
    );
  }

  /** Bulk "we ran out" toggle. Returns the number of items updated. */
  async setStopList(restaurantId: string, itemIds: string[], available: boolean): Promise<number> {
    const res = await this.request<{ updated: number }>(
      "POST",
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/stop-list`,
      { body: { item_ids: itemIds, available } },
    );
    return res?.updated ?? 0;
  }

  // ---- Menu: «Лучшие позиции» ----------------------------------------------
  //
  // Три ручки ниже смонтированы БЕЗ префикса /admin — на группе menuScoped
  // (internal/bootstrap/app.go), то есть путь начинается с /restaurants/:id.
  // Это не описка и не разнобой ради разнобоя: правки меню всегда жили на
  // общей венью-группе за RequireRestaurantManager(..., "id"), а /admin/... —
  // отдельный обработчик панели, в который эти маршруты не добавляли. Тот же
  // гейт, тот же владелец, другой префикс. Такие вызовы в клиенте уже есть
  // (/restaurants/:id/cuisines, /restaurants/:id/booking-policy).

  /** GET /restaurants/:id/menu-top-picks — редакторский вид полки: что
   * заведение отметило, в его порядке, ВКЛЮЧАЯ блюда в стоп-листе. Отдельно от
   * гостевой выдачи именно поэтому: она недоступные блюда прячет, а
   * управляющий должен видеть, что место занято. */
  listMenuTopPicks(restaurantId: string): Promise<AdminMenuTopPick[]> {
    return this.request<AdminMenuTopPick[]>(
      "GET",
      `/restaurants/${encodeURIComponent(restaurantId)}/menu-top-picks`,
    );
  }

  /** PATCH /restaurants/:id/menu-items/:itemId/top-pick — отметить или снять
   * одно блюдо. Отметка занимает наименьшее свободное место. Повторная отметка
   * уже отмеченного блюда его НЕ двигает. Полная полка — 422 с кодом
   * `menu_top_picks_limit`, см. classifyMenuTopPickFailure. */
  async setMenuItemTopPick(
    restaurantId: string,
    itemId: string,
    isTopPick: boolean,
  ): Promise<void> {
    await this.request<unknown>(
      "PATCH",
      `/restaurants/${encodeURIComponent(restaurantId)}/menu-items/${encodeURIComponent(
        itemId,
      )}/top-pick`,
      { body: { is_top_pick: isTopPick } },
    );
  }

  /** PUT /restaurants/:id/menu-highlights — весь порядок целиком, одной
   * транзакцией. Тело описывает РЕЗУЛЬТАТ, поэтому повтор безобиден; посылать
   * по запросу на каждый обмен местами нельзя — такая череда записей может
   * примениться наполовину. Пустой список очищает полку. */
  async replaceMenuTopPicks(restaurantId: string, itemIds: string[]): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/restaurants/${encodeURIComponent(restaurantId)}/menu-highlights`,
      { body: { item_ids: itemIds } },
    );
  }

  // ---- Gastroguide (superadmin editor) -------------------------------------
  //
  // Every route here is mounted behind RequireRole(RoleAdmin) on the server and
  // re-checked in the usecase. A venue owner calling any of them gets 403 with
  // code "forbidden"; the panel hides the section for them as well, but the
  // server is what actually enforces it.

  listGuideCategories(): Promise<GuideCategory[]> {
    return this.request<{ items: GuideCategory[] }>(
      "GET",
      "/admin/gastroguide/categories",
    ).then((res) => res?.items ?? []);
  }

  createGuideCategory(input: GuideCategoryInput): Promise<GuideCategory> {
    return this.request<GuideCategory>("POST", "/admin/gastroguide/categories", { body: input });
  }

  updateGuideCategory(categoryId: string, input: GuideCategoryInput): Promise<GuideCategory> {
    return this.request<GuideCategory>(
      "PUT",
      `/admin/gastroguide/categories/${encodeURIComponent(categoryId)}`,
      { body: input },
    );
  }

  listGuideCollections(
    params: GuideCollectionListParams = {},
  ): Promise<ApiPage<GuideCollection>> {
    return this.request<ApiPage<GuideCollection>>("GET", "/admin/gastroguide/collections", {
      params: {
        // The server reads ?status= as one comma-separated list, so several
        // statuses are joined rather than repeated.
        status: params.status?.length ? params.status.join(",") : undefined,
        kind: params.kind,
        city: params.city,
        q: params.q,
        page: params.page,
        per_page: params.per_page,
      },
    });
  }

  getGuideCollection(collectionId: string): Promise<GuideCollectionDetail> {
    return this.request<GuideCollectionDetail>(
      "GET",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}`,
    );
  }

  createGuideCollection(input: GuideCollectionInput): Promise<GuideCollection> {
    return this.request<GuideCollection>("POST", "/admin/gastroguide/collections", { body: input });
  }

  updateGuideCollection(
    collectionId: string,
    input: GuideCollectionInput,
  ): Promise<GuideCollection> {
    return this.request<GuideCollection>(
      "PUT",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}`,
      { body: input },
    );
  }

  /** publishedAt omitted = publish now; a future ISO timestamp schedules it. */
  publishGuideCollection(collectionId: string, publishedAt?: string): Promise<GuideCollection> {
    return this.request<GuideCollection>(
      "POST",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}/publish`,
      publishedAt ? { body: { published_at: publishedAt } } : {},
    );
  }

  unpublishGuideCollection(collectionId: string): Promise<GuideCollection> {
    return this.request<GuideCollection>(
      "POST",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}/unpublish`,
    );
  }

  archiveGuideCollection(collectionId: string): Promise<GuideCollection> {
    return this.request<GuideCollection>(
      "POST",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}/archive`,
    );
  }

  /** Replaces the collection's WHOLE rubric set, in the given order. */
  async setGuideCollectionCategories(collectionId: string, categoryIds: string[]): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}/categories`,
      { body: { category_ids: categoryIds } },
    );
  }

  /** Appends a venue after the last one. 409 guide_venue_already_attached when
   * it is already in THIS collection (the same venue in other collections is
   * fine and is the point of the guide). */
  async attachGuideVenue(collectionId: string, restaurantId: string, note = ""): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}/venues`,
      { body: { restaurant_id: restaurantId, note } },
    );
  }

  async detachGuideVenue(collectionId: string, restaurantId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/admin/gastroguide/collections/${encodeURIComponent(
        collectionId,
      )}/venues/${encodeURIComponent(restaurantId)}`,
    );
  }

  async setGuideVenueNote(
    collectionId: string,
    restaurantId: string,
    note: string,
  ): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/admin/gastroguide/collections/${encodeURIComponent(
        collectionId,
      )}/venues/${encodeURIComponent(restaurantId)}/note`,
      { body: { note } },
    );
  }

  /**
   * Writes the intended FINAL order of a collection's venues.
   *
   * restaurantIds must name exactly the collection's current members, each
   * once — the server refuses anything else with 422 guide_order_mismatch and
   * writes nothing, because a payload that disagrees with the membership means
   * this screen is stale and guessing would silently rewrite a curation.
   *
   * Because it carries the whole order rather than a move, replaying it after
   * a lost response is harmless.
   */
  async reorderGuideVenues(collectionId: string, restaurantIds: string[]): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/admin/gastroguide/collections/${encodeURIComponent(collectionId)}/venues/order`,
      { body: { restaurant_ids: restaurantIds } },
    );
  }

  /**
   * Venue catalog search, used when attaching a venue to a collection. This is
   * the PUBLIC catalog endpoint (GET /restaurants/search) — there is no
   * admin-only venue search, and inventing one would be a second contract for
   * the same question.
   */
  searchVenues(query: string, perPage = 20): Promise<ApiPage<VenueSearchResult>> {
    return this.request<ApiPage<VenueSearchResult>>("GET", "/restaurants/search", {
      params: { q: query, per_page: perPage },
    });
  }

  // ---- Гастропрогулки (маршруты гастрогида) ----------------------------------
  //
  // Отдельное семейство ручек, а не «подборка с точками»: у маршрута свои
  // поля (длительность), свои остановки со своей позицией и остановка может
  // вообще не иметь заведения. Сервер держит их врозь — держим и здесь.

  listGuideRoutes(params: GuideRouteListParams = {}): Promise<ApiPage<GuideRoute>> {
    return this.request<ApiPage<GuideRoute>>("GET", "/admin/gastroguide/routes", {
      params: {
        // Как и у подборок: ?status= — один список через запятую.
        status: params.status?.length ? params.status.join(",") : undefined,
        city: params.city,
        q: params.q,
        page: params.page,
        per_page: params.per_page,
      },
    });
  }

  getGuideRoute(routeId: string): Promise<GuideRouteDetail> {
    return this.request<GuideRouteDetail>(
      "GET",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}`,
    );
  }

  createGuideRoute(input: GuideRouteInput): Promise<GuideRoute> {
    return this.request<GuideRoute>("POST", "/admin/gastroguide/routes", { body: input });
  }

  updateGuideRoute(routeId: string, input: GuideRouteInput): Promise<GuideRoute> {
    return this.request<GuideRoute>(
      "PUT",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}`,
      { body: input },
    );
  }

  /** Публикация. Маршрут без единой остановки сервер публиковать отказывается
   * (422 `guide_route_empty`) — пустая прогулка гостю показываться не должна. */
  publishGuideRoute(routeId: string, publishedAt?: string): Promise<GuideRoute> {
    return this.request<GuideRoute>(
      "POST",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}/publish`,
      publishedAt ? { body: { published_at: publishedAt } } : {},
    );
  }

  unpublishGuideRoute(routeId: string): Promise<GuideRoute> {
    return this.request<GuideRoute>(
      "POST",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}/unpublish`,
    );
  }

  archiveGuideRoute(routeId: string): Promise<GuideRoute> {
    return this.request<GuideRoute>(
      "POST",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}/archive`,
    );
  }

  /** Новая остановка встаёт в КОНЕЦ маршрута — позицию сервер назначает сам. */
  addGuideRoutePoint(routeId: string, input: GuideRoutePointInput): Promise<GuideRoutePoint> {
    return this.request<GuideRoutePoint>(
      "POST",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}/points`,
      { body: input },
    );
  }

  /** Правка остановки позицию НЕ меняет — порядок правится только reorder'ом. */
  updateGuideRoutePoint(
    routeId: string,
    pointId: string,
    input: GuideRoutePointInput,
  ): Promise<GuideRoutePoint> {
    return this.request<GuideRoutePoint>(
      "PUT",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}/points/${encodeURIComponent(
        pointId,
      )}`,
      { body: input },
    );
  }

  async deleteGuideRoutePoint(routeId: string, pointId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}/points/${encodeURIComponent(
        pointId,
      )}`,
    );
  }

  /**
   * Пишет ИТОГОВЫЙ порядок остановок маршрута — целиком.
   *
   * `pointIds` обязан называть ровно текущие остановки, каждую один раз: всё
   * остальное сервер отвергает (422 `guide_order_mismatch`) и не пишет ничего.
   * Payload, разошедшийся с составом, означает устаревший экран, а угаданный
   * порядок молча переписал бы маршрут.
   *
   * Запрос несёт весь порядок, а не перемещение, поэтому повтор после
   * потерянного ответа безвреден.
   */
  async reorderGuideRoutePoints(routeId: string, pointIds: string[]): Promise<void> {
    await this.request<unknown>(
      "PUT",
      `/admin/gastroguide/routes/${encodeURIComponent(routeId)}/points/order`,
      { body: { point_ids: pointIds } },
    );
  }

  // ---- «Выбрали для вас»: ручной состав блока на главной ---------------------

  /**
   * `GET /admin/restaurants/picks?city=…` — РУЧНОЙ список этого города, в
   * заданном порядке и ВМЕСТЕ с выключенными заведениями.
   *
   * Это НЕ то же самое, что видит гость: публичная `GET /restaurants/picks`
   * при отсутствии ручного списка собирает блок автоматически, а здесь пустой
   * массив — честный ответ «ручного списка нет», и именно на нём экран
   * объясняет владельцу, что блок работает сам.
   *
   * Пустая строка города = список «для всех городов». Она не уезжает в адрес
   * (request() пропускает пустые параметры), и это ровно та же семантика:
   * запрос без города сервер читает как общий ключ.
   */
  listHomePicks(city = ""): Promise<ApiPage<HomePickVenue>> {
    return this.request<ApiPage<HomePickVenue>>("GET", "/admin/restaurants/picks", {
      params: { city },
    });
  }

  /**
   * `PUT /admin/restaurants/picks` — заменяет список города ЦЕЛИКОМ.
   *
   * Одна запись описывает результат полностью, поэтому её безопасно повторить,
   * а двойное нажатие «Сохранить» не может собрать список, которого никто не
   * просил. Пустой массив — это осознанное «вернуть блок к автоматическому
   * подбору», а не ошибка.
   *
   * Повтор одного id в списке сервер отвергает (422): порядок с дублем
   * неоднозначен.
   */
  async replaceHomePicks(city: string, restaurantIds: string[]): Promise<void> {
    const body: HomePicksInput = { city, restaurant_ids: restaurantIds };
    await this.request<unknown>("PUT", "/admin/restaurants/picks", { body });
  }

  // ---- Media (image upload) ------------------------------------------------

  /**
   * POST /admin/media/images — upload one image, get its public URL back.
   *
   * This is the one write that MUST NOT go through request<T>(): multipart
   * cannot carry a forced `Content-Type: application/json`. The browser has to
   * set `multipart/form-data; boundary=…` itself, derived from the FormData
   * body, so we hand fetch the FormData untouched and set NO Content-Type — a
   * hardcoded one would ship the wrong boundary and every part would be
   * rejected. Everything else mirrors request(): a token is fetched up front
   * (renewed if about to expire) via the same getToken, and the upload is
   * replayed exactly once if it still comes back 401 via the same
   * onUnauthorized. A fresh FormData per attempt because a request body can
   * only be consumed once.
   *
   * Non-2xx maps to an AdminApiError carrying the HTTP status and a stable,
   * i18n-free code (see imageUploadErrorCode) so the panel can show a friendly
   * message for the cases a user can act on (>8MB, wrong type, not configured).
   */
  async uploadImage(file: File | Blob): Promise<string> {
    const token = (await this.getToken?.()) ?? null;

    const send = (bearer: string | null): Promise<Response> => {
      const form = new FormData();
      form.append("file", file, file instanceof File ? file.name : "upload");
      const headers: Record<string, string> = { Accept: "application/json" };
      // Deliberately NO Content-Type here — see the method doc.
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      return fetch(`${this.baseUrl}/admin/media/images`, {
        method: "POST",
        headers,
        body: form,
        // An 8MB upload needs a longer budget than the JSON default — see
        // UPLOAD_TIMEOUT_MS. A fresh signal per attempt so a retry is not born
        // already aborted.
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
    };

    let response: Response;
    try {
      response = await send(token);
      if (response.status === 401 && this.onUnauthorized) {
        const renewed = await this.onUnauthorized(token);
        if (renewed) response = await send(renewed);
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new RepositoryError(`Image upload timed out after ${UPLOAD_TIMEOUT_MS}ms`, cause);
      }
      if (cause instanceof RepositoryError) throw cause; // e.g. a failed refresh
      throw new RepositoryError("Network error uploading image", cause);
    }

    let body: Envelope<{ url: string }> | undefined;
    try {
      body = (await response.json()) as Envelope<{ url: string }>;
    } catch (cause) {
      if (!response.ok) {
        throw new AdminApiError(
          `Image upload failed with ${response.status}`,
          response.status,
          cause,
          imageUploadErrorCode(response.status),
        );
      }
      throw new RepositoryError("Empty or malformed response uploading image", cause);
    }

    if (!response.ok) {
      throw new AdminApiError(
        body?.error ?? `Image upload failed with ${response.status}`,
        response.status,
        undefined,
        imageUploadErrorCode(response.status, body?.code),
      );
    }

    const url = body?.data?.url;
    if (!url) throw new RepositoryError("Image upload response carried no url");
    return url;
  }
}

/** Stable, i18n-free classification of an image-upload failure, derived from
 * the HTTP status (a code the server sent wins if it is already one of these).
 * The panel switches on this to show a friendly RU message for the cases a
 * user can fix; anything else is a generic "try again". Surfaced on
 * AdminApiError.code by uploadImage. */
export type ImageUploadErrorCode =
  | "image_too_large"
  | "image_bad_type"
  | "image_upload_unconfigured"
  | "unauthorized"
  | "upload_failed";

const IMAGE_UPLOAD_CODES: readonly ImageUploadErrorCode[] = [
  "image_too_large",
  "image_bad_type",
  "image_upload_unconfigured",
  "unauthorized",
  "upload_failed",
];

export function imageUploadErrorCode(status: number, serverCode?: string): ImageUploadErrorCode {
  if (serverCode && (IMAGE_UPLOAD_CODES as readonly string[]).includes(serverCode)) {
    return serverCode as ImageUploadErrorCode;
  }
  switch (status) {
    case 413:
      return "image_too_large";
    case 422:
      return "image_bad_type";
    case 503:
      return "image_upload_unconfigured";
    case 401:
    case 403:
      return "unauthorized";
    default:
      return "upload_failed";
  }
}

/** Thrown on any non-2xx admin response; carries the HTTP status so the UI can
 * distinguish 401 (re-login), 403 (not a manager of this restaurant) and the
 * rest. Extends RepositoryError so existing catch(RepositoryError) still works. */
export class AdminApiError extends RepositoryError {
  constructor(
    message: string,
    public readonly status: number,
    cause?: unknown,
    /** `response.Envelope.code`, when the server sent one. Same contract as on
     * RepositoryError: optional, additive, the only safe thing to branch on. */
    code?: string,
  ) {
    // `status` is redeclared above (it is required here, optional on the
    // base), so the base copies of status/serverMessage stay undefined exactly
    // as before — only `code` is new.
    super(message, cause, undefined, undefined, code);
    this.name = "AdminApiError";
  }
}
