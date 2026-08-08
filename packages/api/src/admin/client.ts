import { RepositoryError } from "../repository";
import type {
  AdminBooking,
  AdminEvent,
  AdminGuest,
  AdminListParams,
  AdminMenuCategory,
  AdminMenuItem,
  AdminPromo,
  ApiPage,
  AuthUser,
  BookingPolicy,
  BookingPolicyPatch,
  BookingCancelInput,
  BookingListParams,
  BookingReasonInput,
  EventInput,
  FeedItemKind,
  FeedItemState,
  FeedReviewInput,
  GuideCategory,
  GuideCategoryInput,
  GuideCollection,
  GuideCollectionDetail,
  GuideCollectionInput,
  GuideCollectionListParams,
  MyRestaurant,
  Schedule,
  ScheduleOverrideInput,
  PromoInput,
  PlatformBookings,
  PlatformOverview,
  PlatformPayments,
  PlatformPeriod,
  PushSubscriptionInput,
  RestaurantPricePatch,
  RestaurantPricing,
  RestaurantProfile,
  TelegramSettings,
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
  // NOTE the path: like booking-policy, this is NOT under `/admin`. The write
  // route `PATCH /restaurants/:id` is mounted on the plain authenticated group
  // and reachable by the venue's own manager; the backend STRIPS the marketing
  // flags and `is_active` for non-admin callers, so this UI only ever sends the
  // pricing fields. `RequireRestaurantManager` enforces membership.

  /**
   * GET /restaurants/:id (the PUBLIC catalog endpoint, reused here). This is
   * the only read that carries the numeric `price_range` alongside the
   * categorical `price_category` — the admin profile endpoint
   * (`getProfile`) returns the tier alone — so the «Средний чек» card prefills
   * from here rather than adding a bespoke admin route.
   */
  getRestaurantPricing(restaurantId: string): Promise<RestaurantPricing> {
    return this.request<RestaurantPricing>(
      "GET",
      `/restaurants/${encodeURIComponent(restaurantId)}`,
    );
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

  // ---- Guests --------------------------------------------------------------

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
        signal: AbortSignal.timeout(this.timeoutMs),
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
        throw new RepositoryError(`Image upload timed out after ${this.timeoutMs}ms`, cause);
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
