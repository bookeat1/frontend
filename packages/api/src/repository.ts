import type { MapPreviewOptions } from "./static-map";
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
  GuideCollection,
  GuideCollectionDetail,
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

/**
 * Data-access boundary. UI code and TanStack Query hooks must depend only on
 * this interface, never on a concrete implementation, so swapping the mock
 * for the real backend later is a one-file change (see MockRestaurantRepository).
 *
 * Adding a method here means adding it to BOTH implementations — the mock is
 * what keeps the app runnable with no backend at all, and `tsc` is currently
 * the only thing enforcing that the two stay in step (there are no tests in
 * this repo yet).
 */
export interface RestaurantRepository {
  getRestaurant(id: string): Promise<Restaurant>;
  /**
   * The card-sized view of ONE venue (name, photo, cuisine, price tier).
   *
   * Exists next to `getRestaurant` because that one fans out to four endpoints
   * (venue + reviews + menu + promos) to build the detail screen. A list that
   * only needs the venue's NAME — «Мои брони», whose payload carries just
   * `restaurant_id` — would otherwise pay four requests per row.
   */
  getRestaurantSummary(id: string): Promise<RestaurantSummary>;
  /**
   * URL of the server-rendered map preview for one venue, or `undefined` when
   * this build has no backend to ask (the mock).
   *
   * Synchronous and not a Promise on purpose: it performs no request. The
   * bytes are fetched by the <Image> that receives the URL, which is what
   * gives us the platform's own HTTP caching (the server sends
   * `Cache-Control: max-age` + ETag) instead of a second cache of our own.
   */
  getMapPreviewUrl(restaurantId: string, options?: MapPreviewOptions): string | undefined;
  getPopularRestaurants(): Promise<RestaurantSummary[]>;
  searchRestaurants(query: SearchQuery): Promise<SearchResult>;
  getCuisines(): Promise<Cuisine[]>;
  /** Cities the catalog actually has venues in, for the city filter. */
  getCities(): Promise<string[]>;

  /**
   * Upcoming events across every venue (`GET /events`) — the Explore
   * «События» strip.
   *
   * Public, no session. Visibility is decided server-side: only PUBLISHED,
   * not-yet-finished events of ACTIVE restaurants are ever returned, and no
   * query parameter can widen that — so an empty page is a real answer
   * ("nothing is scheduled"), not a permissions problem to work around.
   *
   * Sorted by start time ascending, ties broken by id, i.e. a stable order
   * across pages. `pages` is 0 when there is nothing at all (same convention
   * as listMyBookings).
   */
  listUpcomingEvents(query?: EventQuery): Promise<EventPage>;

  /**
   * Cross-venue promotions for the Home «Акции» strip, read from the unified
   * home feed (`GET /feed?city=…`) and filtered to `kind: "promo"` — the feed
   * also returns `event` items, which this method drops.
   *
   * Public, no session. `city` is REQUIRED: the endpoint answers 422
   * (`city_required`) without it, so the caller must resolve a city before
   * asking (the Home header's city). An empty array is a real "no promos here"
   * answer, so the section hides on it rather than showing an error.
   */
  getPromotions(city: string): Promise<HomePromo[]>;

  /* --- gastroguide / «Статьи» --- */

  /**
   * The editorial collections of venues (`GET /gastroguide/collections`) — the
   * guest-facing «Статьи» list.
   *
   * Public, no session. The card shape only (no venues): the collection's
   * venues are read per-collection with `getGuideCollection`. An empty array is
   * a real "no collections published" answer, so the section/screen hides or
   * shows a calm empty state rather than an error. There is no author field on
   * the wire — the byline is a UI constant.
   */
  getGuideCollections(): Promise<GuideCollection[]>;

  /**
   * One collection with its venues (`GET /gastroguide/collections/:slug`), for
   * the «Статья» detail screen. Public, no session. An unknown slug is a 404
   * (RepositoryError.isNotFound), which the screen renders as "not found", not
   * as a transport error.
   */
  getGuideCollection(slug: string): Promise<GuideCollectionDetail>;

  /* --- reservation flow --- */

  /**
   * Bookable slots for one calendar day. Public — no session needed, which is
   * why the guest can walk the whole flow before signing in.
   * @param date "YYYY-MM-DD" in the venue's own timezone.
   */
  getAvailability(input: {
    restaurantId: string;
    date: string;
    guests: number;
  }): Promise<DayAvailability>;

  /** The venue's whole menu grouped by category, for the pre-order step. */
  getMenuSections(restaurantId: string): Promise<MenuSection[]>;

  /**
   * The venue's promo "stories" (`GET /restaurants/:id/stories`) — the
   * horizontal highlight rail under the Обзор/Фото tabs.
   *
   * Public, no session. A venue with no stories answers an empty array, which
   * is a real "nothing pinned" answer, not a permissions problem — the rail
   * hides itself on it, exactly as it does on a failed request. Ordered by
   * `sortOrder` ascending, so the caller renders the array as received.
   */
  getRestaurantStories(restaurantId: string): Promise<RestaurantStory[]>;

  /**
   * Creates the booking. Requires a session.
   * @param idempotencyKey mandatory — the backend rejects the request without
   * it (422). The SAME key must be reused for a retry of the same logical
   * booking so a double tap or a retried request cannot double-book.
   */
  createBooking(input: CreateBookingInput, idempotencyKey: string): Promise<Booking>;

  /** One of the caller's own bookings. Requires a session. */
  getBooking(bookingId: string): Promise<Booking>;

  /**
   * The caller's own bookings, newest start time first (`GET /bookings`).
   * Requires a session — an anonymous call is a 401, not an empty list.
   *
   * Offset pagination: the server caps nothing itself, so the caller decides
   * `perPage` and walks `page` upwards while `page < pages`.
   */
  listMyBookings(input?: { page?: number; perPage?: number }): Promise<BookingPage>;

  /* --- favorites --- */

  /**
   * The caller's favorite venues (`GET /favorites`). Requires a session; the
   * payload is a plain array of the same restaurant objects the catalog
   * returns, so it maps through mapRestaurantSummary unchanged.
   */
  getFavorites(): Promise<RestaurantSummary[]>;

  /**
   * Adds a venue to the caller's favorites (`PUT /favorites/:restaurantId`).
   * Idempotent on the server — favoriting an already-favorited venue answers
   * 200, not a conflict.
   */
  addFavorite(restaurantId: string): Promise<void>;

  /** Removes a venue (`DELETE /favorites/:restaurantId`). Also idempotent. */
  removeFavorite(restaurantId: string): Promise<void>;

  /**
   * Replaces the booking's pre-order with exactly these lines (PUT semantics —
   * an empty array clears it). Prices are computed server-side from the
   * venue's own menu; nothing about money is sent from the client.
   */
  setPreorder(bookingId: string, lines: PreorderLineInput[]): Promise<Preorder>;

  /** The booking's current pre-order. Requires a session. */
  getPreorder(bookingId: string): Promise<Preorder>;

  /**
   * Cancels one of the caller's own bookings (`POST /bookings/:id/cancel`).
   * Requires a session.
   *
   * There is no "too late to cancel" gate any more (see authorizeTransition in
   * internal/usecase/bookings/status.go): a guest may cancel at any time and
   * the deadline only decides the MONEY. A booking already in a terminal state
   * (cancelled / completed / no_show) answers 422 "invalid status transition";
   * see RepositoryError.isInvalidStatusTransition.
   *
   * NOT idempotent on the server, so the caller must guarantee a single
   * in-flight request per booking.
   *
   * The response is the plain booking payload, which — unlike GET
   * /bookings/:id — carries NO `free_cancel_deadline` (verified against the
   * live test API on 2026-07-25), so the returned Booking always has
   * `freeCancelDeadline: null`. Callers that merge into a cache must keep the
   * value they already had rather than overwriting it with null.
   */
  cancelBooking(bookingId: string, input?: CancelBookingInput): Promise<Booking>;

  /**
   * The booking's live payment, or `null` when there is none (the endpoint
   * answers 404 in that case, and "no deposit" is the common case today).
   * Requires a session for a booking that belongs to an account.
   */
  getBookingPayment(bookingId: string): Promise<BookingPayment | null>;

  /* --- push notifications --- */

  /**
   * Registers this device's provider push token against the CALLING account
   * (`POST /devices/push-tokens`, authenticated).
   *
   * Idempotent on the token value, and deliberately so: the backend upserts on
   * the token, not on (user, token), so re-registering a token that already
   * exists RE-POINTS it at the caller instead of creating a second row
   * (internal/usecase/notifications/devicetokens.go). That is what makes a
   * shared phone safe — the previous owner stops receiving the new owner's
   * booking notifications.
   *
   * The server answers `{id, platform, status}` and never echoes the token
   * back (it is a device credential). Nothing in the app needs the row id, so
   * this returns void rather than inventing a use for it.
   */
  registerPushToken(input: RegisterPushTokenInput): Promise<void>;

  /**
   * Silences this device (`DELETE /devices/push-tokens`, authenticated, token
   * in the BODY). Idempotent: an unknown or not-owned token is a no-op success
   * server-side, so a double sign-out cannot fail.
   */
  unregisterPushToken(token: string): Promise<void>;
}

/**
 * Authentication is a separate seam from the catalog on purpose: it is the
 * only thing that writes the session, so keeping it out of
 * RestaurantRepository means no screen can reach a token through the data
 * layer it already holds.
 */
export interface AuthRepository {
  signUp(input: { email: string; password: string; fullName: string }): Promise<AuthSession>;
  signIn(input: { email: string; password: string }): Promise<AuthSession>;
  /**
   * Asks the backend to send a one-time code to `phone` (E.164, "+7…").
   *
   * Server-side limits, read from internal/bootstrap/config.go and the OTP
   * usecase, NOT guessed: 1 request per minute and 5 per hour PER PHONE
   * (`AUTH_OTP_RATE_PER_MIN` / `AUTH_OTP_RATE_PER_HOUR`), plus 5 requests per
   * minute per IP on the strict middleware tier. Over the phone limits the
   * server answers 422; over the IP limit, 429 with `Retry-After`.
   */
  requestOtp(phone: string): Promise<OtpRequest>;
  /**
   * Exchanges phone + code for a session. There is NO separate sign-up: the
   * backend finds-or-creates the user inside this call
   * (internal/usecase/auth/otp.go, VerifyOTP → users.GetByPhone → Create).
   *
   * A wrong code, an expired code, a phone with no active code and a phone
   * locked out after 5 wrong attempts are ALL the same
   * `401 {"error":"unauthorized","code":"unauthorized"}` — verified by curl on
   * 2026-07-26. The client cannot tell them apart and must not pretend to.
   */
  verifyOtp(input: { phone: string; code: string }): Promise<AuthSession>;
  /**
   * Exchanges a refresh token for a new pair. The refresh token ROTATES —
   * verified against the live API on 2026-07-25: replaying the same one
   * answers 401. So the caller must persist the returned pair before using
   * it, and must never run two refreshes concurrently (the loser destroys the
   * session). See ensureFreshToken in apps/mobile/src/lib/auth.tsx.
   */
  refresh(refreshToken: string): Promise<AuthSession>;
  /** The signed-in user, used to prefill the guest's name/phone. */
  getMe(): Promise<AuthUser>;
  /**
   * `PATCH /users/me` — a PARTIAL update of the guest's own profile. Send only
   * the keys that changed: an absent key means "leave that column alone"
   * server-side, so passing the whole profile back would overwrite fields this
   * app does not even render.
   *
   * Server-side rules, read from internal/usecase/users/facade.go (NOT
   * guessed): `birth_date` must parse as "YYYY-MM-DD", must be strictly in the
   * past and must not imply an age over 120; `full_name` and `city` have NO
   * server validation at all. The whole update runs in one transaction, so a
   * rejection changes nothing.
   *
   * Answers the updated profile, which the caller should treat as the new
   * truth (the server may normalize).
   */
  updateMe(input: ProfileUpdate): Promise<AuthUser>;

  /**
   * `POST /users/me/phone/otp/request` — asks the backend to send a one-time
   * code to a NEW phone number the signed-in guest wants to move their account
   * to. AUTHENTICATED (bearer token, same path as updateMe): the server has to
   * know which account is asking, and the code goes to the NEW number, not the
   * current one.
   *
   * Answer shape mirrors `requestOtp` (`{sent, devCode}`): `sent: true` means
   * the request was accepted and handed to the delivery waterfall, NOT that
   * anything was delivered; `devCode` is the server's debug echo, present only
   * with `AUTH_OTP_DEV_EXPOSE=true` and never depended on.
   *
   * Server outcomes worth branching on: 409 if the number already belongs to
   * another account; 422 if it is the same as the current number or malformed.
   */
  requestPhoneChangeOtp(newPhone: string): Promise<OtpRequest>;
  /**
   * `POST /users/me/phone/otp/verify` — proves ownership of the NEW number with
   * the code sent to it and moves the account onto it. AUTHENTICATED. Answers
   * the UPDATED user object (same shape as `updateMe`/`getMe`), which the caller
   * should write into the `["me"]` cache as the new truth.
   *
   * Server outcomes: 401 for a wrong/expired code; 409 if the number was taken
   * between request and verify; 422 for the same-number / invalid case.
   */
  confirmPhoneChange(input: { newPhone: string; code: string }): Promise<AuthUser>;

  /**
   * Soft-deletes the caller's own account (`DELETE /users/me`, authenticated).
   *
   * SOFT delete: the backend marks the account deleted and hides it, but keeps
   * it recoverable for a retention window (a later sign-in with the same phone
   * restores it). The exact window is the server's to define — this frontend
   * does not encode a number of days, because the endpoint is still being
   * built and inventing the retention period here would be inventing a
   * contract. The agreed frontend contract is only the verb + path.
   *
   * The caller must sign the guest out afterwards (the token now belongs to a
   * deleted account). Returns nothing: there is no post-delete account to hand
   * back.
   */
  deleteAccount(): Promise<void>;
}

/**
 * The outcome behind a 409 on the booking endpoints, once the machine-readable
 * `code` of the error envelope has been read.
 *
 * The three narrow values come straight from the backend (`domain.WithCode`,
 * added 2026-07-25); `"unknown"` is what an older server build gives us, where
 * every one of them was the same byte-identical
 * `409 {"error":"already exists"}` and the client CANNOT tell them apart.
 * It is a distinct value on purpose — not folded into any of the others — so a
 * caller is forced to decide what to do when the answer is genuinely unknown.
 */
export type BookingConflictKind =
  /** Nobody booked anything: the time was taken between loading availability
   * and submitting (also: an external hold, and PATCH /bookings/:id). */
  | "slot_taken"
  /** Nobody booked anything: the party does not fit at that time. */
  | "no_table_available"
  /** The EARLIER submit went through — a booking exists. Answered when the
   * same Idempotency-Key arrives with a different body. */
  | "idempotency_key_reused"
  /** The server did not say. Could be either of the two above. */
  | "unknown";

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    /** HTTP status when the failure came from the server; undefined for
     * transport failures (offline, timeout, malformed body). */
    public readonly status?: number,
    /** The backend's own English `error` string. For logs only — never render
     * it: the app's UI is Russian and this text is written for developers. */
    public readonly serverMessage?: string,
    /**
     * The machine-readable `code` of the error envelope, when the server sent
     * one (`response.Envelope.code`, additive since 2026-07-25). Unlike
     * `serverMessage` this IS a contract: branch on it, never on the text.
     * `undefined` on an older server build and on transport failures.
     */
    public readonly code?: string,
    /**
     * `Retry-After` from a 429, in whole seconds, when the server sent one.
     * The rate-limit middleware always does (middleware/ratelimit.go), and it
     * is the only honest source for "попробуйте через N секунд" — a number
     * invented on the client would be a guess about somebody else's window.
     */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RepositoryError";
  }

  /** The session is missing, expired or rejected — the caller should send the
   * guest to sign in rather than showing a generic failure. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * Which of the mutually exclusive booking conflicts this 409 is, or `null`
   * when the failure is not a 409 at all.
   *
   * Two of them demand OPPOSITE reactions — "your time is gone, pick another"
   * versus "you already have this booking, do not send it again" — and until
   * the backend gained `code` they were byte-identical on the wire. Anything
   * the server does not label narrowly stays `"unknown"`: guessing here is how
   * a guest gets told they hold a table that was never booked.
   */
  get bookingConflict(): BookingConflictKind | null {
    if (this.status !== 409) return null;
    switch (this.code) {
      case "slot_taken":
      case "no_table_available":
      case "idempotency_key_reused":
        return this.code;
      // "already_exists" (the generic sentinel code) and no code at all are
      // the same thing to us: the server did not disambiguate.
      default:
        return "unknown";
    }
  }

  /** The server refused the payload. Almost always a stale draft (a time that
   * has since fallen inside the lead window, too many guests). */
  /** The server refused because too many requests arrived from this source
   * (per-IP tier). Distinct from the per-phone OTP limit, which the backend
   * reports as a plain 422. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  /**
   * The 422 that means "the booking is not in a state from which this
   * transition is legal" — `domain.ErrInvalidStatus`, rendered by
   * response.classify as the fixed string "invalid status transition"
   * (verified live: a second cancel of the same booking answers exactly that).
   *
   * For a cancel this almost always means the booking is ALREADY cancelled,
   * which is a success from the guest's point of view — but the message alone
   * cannot distinguish it from "already completed", so the caller must re-read
   * the booking and decide on the real status, never on this flag alone.
   */
  get isInvalidStatusTransition(): boolean {
    return this.status === 422 && (this.serverMessage ?? "").toLowerCase().includes("invalid status");
  }

  /** The resource does not exist (or is not visible to this session). */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}
