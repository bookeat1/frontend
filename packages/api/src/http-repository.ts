import {
  HttpClient,
  type ApiPage,
  type TokenProvider,
  type UnauthorizedHandler,
} from "./http-client";
import {
  cuisineIdFor,
  mapAvailability,
  mapBooking,
  mapEventSummary,
  mapHomePromos,
  mapMenuSections,
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
  type ApiFeedItem,
  type ApiMenuItem,
  type ApiPayment,
  type ApiPreorder,
  type ApiPromo,
  type ApiRestaurant,
  type ApiReviewSummary,
  type ApiStory,
  type ApiTokenPair,
  type ApiUser,
} from "./http-mapping";
import { RepositoryError, type AuthRepository, type RestaurantRepository } from "./repository";
import { buildMapPreviewUrl, type MapPreviewOptions } from "./static-map";
import type {
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
  HomePromo,
  MenuSection,
  OtpRequest,
  Preorder,
  PreorderLineInput,
  ProfileUpdate,
  RegisterPushTokenInput,
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
}

const POPULAR_PAGE_SIZE = 20;
/** Promos render as a short horizontal strip; one page of this size is all it
 * can show. */
const PROMO_PAGE_SIZE = 8;
/** Backend caps per_page at 100 (domain.RestaurantFilter.PerPage doc
 * comment); used as the working page for the search screen and for building
 * the cuisine list out of the catalog. The live catalog is 29 venues, so one
 * page still covers it — revisit (real pagination) before it passes 100. */
const SEARCH_PAGE_SIZE = 100;
/** One screen of the guest's own bookings. Small on purpose: the list is
 * offset-paginated and every visible row costs one extra venue request for the
 * name, so a big first page is a burst of requests on a phone connection. */
const BOOKINGS_PAGE_SIZE = 20;
/** One page of the Explore events strip. The strip is horizontal and the user
 * scrolls it by hand, so a page bigger than a handful of cards would download
 * rows nobody swipes to. The server caps per_page at 100. */
const EVENTS_PAGE_SIZE = 12;
/** The server rejects nothing above 100 — it silently clamps — but sending a
 * value it will not honour makes the response's `per_page` disagree with what
 * the caller asked for, so the clamp happens here too. */
function clampPerPage(value: number): number {
  if (!Number.isFinite(value)) return EVENTS_PAGE_SIZE;
  return Math.min(100, Math.max(1, Math.trunc(value)));
}

/** The chip label plus every exact spelling of that cuisine present in the
 * catalog. The server's cuisine filter is a case-sensitive
 * `cuisine_type = ANY($1)`, and the data really does contain both
 * "Европейская" and "европейская", so one chip has to send both. */
interface CuisineCatalog {
  list: Cuisine[];
  variantsById: Map<string, string[]>;
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
  private cuisinesPromise: Promise<CuisineCatalog> | null = null;

  constructor(options: HttpRepositoryOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.client = new HttpClient({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      getToken: options.getToken,
      onUnauthorized: options.onUnauthorized,
    });
  }

  /**
   * There is no cuisines endpoint: GET /restaurant-categories exists but is
   * empty on the live catalog and no restaurant carries a category_id, while
   * the dimension search actually filters on is the free-text `cuisine_type`
   * column (see cuisineIdFor in http-mapping.ts). So the cuisine list is
   * derived from one page of the catalog and cached for the process lifetime
   * — cleared on failure so a network blip doesn't wedge the filter row.
   */
  private async getCuisineCatalog(): Promise<CuisineCatalog> {
    if (!this.cuisinesPromise) {
      this.cuisinesPromise = this.client
        .get<ApiPage<ApiRestaurant>>("/restaurants", { page: 1, per_page: SEARCH_PAGE_SIZE })
        .then((page) => buildCuisineCatalog(page.items ?? []))
        .catch((err) => {
          this.cuisinesPromise = null;
          throw err;
        });
    }
    return this.cuisinesPromise;
  }

  /**
   * The venue screen needs four endpoints. They run in parallel, and only the
   * catalog read is allowed to fail the screen: a broken menu, promo or
   * review request degrades its own section (empty strip, no rating) instead
   * of turning the whole venue into an error state.
   */
  async getRestaurant(id: string): Promise<Restaurant> {
    const encoded = encodeURIComponent(id);
    const [api, reviews, menu, promos] = await Promise.all([
      this.client.get<ApiRestaurant>(`/restaurants/${encoded}`),
      optional(this.client.get<ApiReviewSummary>(`/restaurants/${encoded}/reviews/summary`)),
      optional(this.client.get<ApiMenuItem[]>(`/restaurants/${encoded}/menu`)),
      optional(
        this.client
          .get<ApiPage<ApiPromo>>(`/restaurants/${encoded}/promos`, {
            page: 1,
            per_page: PROMO_PAGE_SIZE,
          })
          .then((page) => page.items ?? []),
      ),
    ]);
    return mapRestaurantDetail(api, { reviews, menu, promos });
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

  async getPopularRestaurants(): Promise<RestaurantSummary[]> {
    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants", {
      is_popular: true,
      page: 1,
      per_page: POPULAR_PAGE_SIZE,
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
    const cuisines = await this.cuisineVariants(query.filters.cuisineIds);

    const page = await this.client.get<ApiPage<ApiRestaurant>>("/restaurants/search", {
      q: query.text.trim() || undefined,
      cuisine: cuisines.length > 0 ? cuisines.join(",") : undefined,
      city: query.filters.city,
      price: query.filters.priceLevel
        ? priceLevelToPriceCategory(query.filters.priceLevel)
        : undefined,
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

  /** Expands the selected chips into the exact `cuisine_type` spellings the
   * server compares against. An id we've never seen (stale filter state after
   * the catalog changed) is passed through rather than dropped, so the user
   * gets an honest empty result instead of a silently wider one. */
  private async cuisineVariants(cuisineIds: string[]): Promise<string[]> {
    if (cuisineIds.length === 0) return [];
    const catalog = await this.getCuisineCatalog();
    return cuisineIds.flatMap((id) => catalog.variantsById.get(id) ?? [id]);
  }

  async getCuisines(): Promise<Cuisine[]> {
    const catalog = await this.getCuisineCatalog();
    return catalog.list;
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

export class HttpAuthRepository implements AuthRepository {
  private readonly client: HttpClient;

  constructor(options: HttpRepositoryOptions) {
    this.client = new HttpClient({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      getToken: options.getToken,
      onUnauthorized: options.onUnauthorized,
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
    const api = await this.client.post<ApiOtpRequested>("/auth/otp/request", { phone });
    return {
      sent: api.sent === true,
      // Present only when the deployment sets AUTH_OTP_DEV_EXPOSE=true. Absent
      // on test. Carried, never depended on.
      devCode: typeof api.code === "string" && api.code !== "" ? api.code : null,
    };
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

function buildCuisineCatalog(items: ApiRestaurant[]): CuisineCatalog {
  const list: Cuisine[] = [];
  const variantsById = new Map<string, string[]>();
  for (const item of items) {
    const name = (item.cuisine_type ?? "").trim();
    if (!name) continue;
    const id = cuisineIdFor(name);
    const variants = variantsById.get(id);
    if (!variants) {
      // The first spelling seen becomes the chip label.
      list.push({ id, name });
      variantsById.set(id, [name]);
    } else if (!variants.includes(name)) {
      variants.push(name);
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "ru-RU"));
  return { list, variantsById };
}

export { RepositoryError };
