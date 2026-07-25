import type {
  AuthSession,
  AuthUser,
  Booking,
  CreateBookingInput,
  Cuisine,
  DayAvailability,
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
  getPopularRestaurants(): Promise<RestaurantSummary[]>;
  searchRestaurants(query: SearchQuery): Promise<SearchResult>;
  getCuisines(): Promise<Cuisine[]>;
  /** Cities the catalog actually has venues in, for the city filter. */
  getCities(): Promise<string[]>;
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
   * Replaces the booking's pre-order with exactly these lines (PUT semantics —
   * an empty array clears it). Prices are computed server-side from the
   * venue's own menu; nothing about money is sent from the client.
   */
  setPreorder(bookingId: string, lines: PreorderLineInput[]): Promise<Preorder>;

  /** The booking's current pre-order. Requires a session. */
  getPreorder(bookingId: string): Promise<Preorder>;
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
  ) {
    super(message);
    this.name = "RepositoryError";
  }

  /** The session is missing, expired or rejected — the caller should send the
   * guest to sign in rather than showing a generic failure. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** The slot was taken (or the venue has no table that fits) between loading
   * availability and submitting. Recoverable by picking another time. */
  get isSlotConflict(): boolean {
    return this.status === 409 && !this.isDuplicateSubmit;
  }

  /** A 409 that means "this exact request already created something", not
   * "somebody else took the slot". The backend answers it when an
   * Idempotency-Key is replayed with a DIFFERENT body — i.e. the booking very
   * probably EXISTS. The two conflicts demand opposite reactions, so they must
   * never share a branch: treating this one as a lost slot walks the guest into
   * booking a second table. */
  get isDuplicateSubmit(): boolean {
    return this.status === 409 && (this.serverMessage ?? "").toLowerCase().includes("already exists");
  }

  /** The server refused the payload. Almost always a stale draft (a time that
   * has since fallen inside the lead window, too many guests). */
  get isValidation(): boolean {
    return this.status === 422;
  }
}
