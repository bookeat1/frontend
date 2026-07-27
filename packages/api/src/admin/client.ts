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
  PushSubscriptionInput,
  RestaurantProfile,
  TokenPair,
  VenueSearchResult,
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
  /** Called before every authorized request to fetch the current bearer
   * token. Returning null/undefined sends the request unauthenticated. */
  getToken?: () => string | null | undefined;
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
  private readonly getToken?: () => string | null | undefined;
  private readonly timeoutMs: number;

  constructor(options: AdminApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.getToken = options.getToken;
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

    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.auth !== false) {
      const token = this.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new RepositoryError(`Request to ${path} timed out after ${this.timeoutMs}ms`, cause);
      }
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
