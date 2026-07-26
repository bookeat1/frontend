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
  MenuSection,
  Preorder,
  PreorderLineInput,
  Restaurant,
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
  getRecentSearches(): Promise<string[]>;
  getPopularSearches(): Promise<string[]>;

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
   * Exchanges a refresh token for a new pair. The refresh token ROTATES —
   * verified against the live API on 2026-07-25: replaying the same one
   * answers 401. So the caller must persist the returned pair before using
   * it, and must never run two refreshes concurrently (the loser destroys the
   * session). See ensureFreshToken in apps/mobile/src/lib/auth.tsx.
   */
  refresh(refreshToken: string): Promise<AuthSession>;
  /** The signed-in user, used to prefill the guest's name/phone. */
  getMe(): Promise<AuthUser>;
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
