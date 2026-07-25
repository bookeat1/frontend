import {
  cuisines,
  popularSearches,
  recentSearches,
  restaurants,
  toSummary,
} from "./mock-data";
import { RepositoryError, type AuthRepository, type RestaurantRepository } from "./repository";
import { isCancellableBookingStatus } from "./types";
import type {
  AuthSession,
  AuthUser,
  AvailabilitySlot,
  Booking,
  BookingPayment,
  CancelBookingInput,
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchesQuery(r: Restaurant, query: SearchQuery): boolean {
  const text = query.text.trim().toLowerCase();
  const textMatches =
    text.length === 0 ||
    r.name.toLowerCase().includes(text) ||
    r.cuisines.some((c) => c.name.toLowerCase().includes(text));

  const cuisineMatches =
    query.filters.cuisineIds.length === 0 ||
    r.cuisines.some((c) => query.filters.cuisineIds.includes(c.id));

  const ratingMatches =
    query.filters.minRating === undefined || r.rating >= query.filters.minRating;

  const openMatches = !query.filters.openNowOnly || r.isOpenNow;

  const cityMatches = query.filters.city === undefined || r.city === query.filters.city;

  const priceMatches =
    query.filters.priceLevel === undefined || r.priceLevel === query.filters.priceLevel;

  return (
    textMatches && cuisineMatches && ratingMatches && openMatches && cityMatches && priceMatches
  );
}

export interface MockRepositoryOptions {
  /** Simulated network latency in ms. */
  latencyMs?: number;
  /** If true, every call rejects with RepositoryError (for testing the error state). */
  forceError?: boolean;
}

/**
 * In-memory implementation of RestaurantRepository. Swapping to a real
 * backend later means writing a sibling class (e.g. HttpRestaurantRepository)
 * that implements the same interface — no caller code changes.
 */
export class MockRestaurantRepository implements RestaurantRepository {
  constructor(private readonly options: MockRepositoryOptions = {}) {}

  private async simulateNetwork(): Promise<void> {
    await delay(this.options.latencyMs ?? 500);
    if (this.options.forceError) {
      throw new RepositoryError("Simulated network failure");
    }
  }

  async getRestaurant(id: string): Promise<Restaurant> {
    await this.simulateNetwork();
    const found = restaurants.find((r) => r.id === id);
    if (!found) {
      throw new RepositoryError(`Restaurant ${id} not found`);
    }
    return found;
  }

  async getPopularRestaurants(): Promise<RestaurantSummary[]> {
    await this.simulateNetwork();
    return restaurants.map(toSummary);
  }

  async searchRestaurants(query: SearchQuery): Promise<SearchResult> {
    await this.simulateNetwork();
    const items = restaurants.filter((r) => matchesQuery(r, query)).map(toSummary);
    return { query, items, total: items.length };
  }

  async getCuisines(): Promise<Cuisine[]> {
    await this.simulateNetwork();
    return cuisines;
  }

  /** Derived from the fixtures rather than hard-coded, so the mock's city
   * filter can never offer a city no fixture is in. */
  async getCities(): Promise<string[]> {
    await this.simulateNetwork();
    return Array.from(new Set(restaurants.map((r) => r.city))).sort((a, b) =>
      a.localeCompare(b, "ru-RU"),
    );
  }

  async getRecentSearches(): Promise<string[]> {
    await this.simulateNetwork();
    return recentSearches;
  }

  async getPopularSearches(): Promise<string[]> {
    await this.simulateNetwork();
    return popularSearches;
  }

  /* --- reservation flow --- */

  /**
   * Slots are generated from the fixture's own working hours on the same
   * 30-minute step and 90-minute duration the backend uses, and deliberately
   * reproduce all four real-world shapes so the UI's states can be exercised
   * with no backend: an early slot inside the lead window (`too_soon`), a
   * couple of taken ones (`occupied`), and — for one fixture venue — a whole
   * day of `capacity`, which is what most live venues currently return.
   */
  async getAvailability(input: {
    restaurantId: string;
    date: string;
    guests: number;
  }): Promise<DayAvailability> {
    await this.simulateNetwork();
    const restaurant = restaurants.find((r) => r.id === input.restaurantId);
    if (!restaurant) {
      throw new RepositoryError(`Restaurant ${input.restaurantId} not found`, undefined, 404);
    }
    return {
      restaurantId: restaurant.id,
      date: input.date,
      timezone: MOCK_TIMEZONE,
      guests: input.guests,
      durationMinutes: SLOT_DURATION_MINUTES,
      slots: buildMockSlots(restaurant, input.date, input.guests),
    };
  }

  async getMenuSections(restaurantId: string): Promise<MenuSection[]> {
    await this.simulateNetwork();
    const restaurant = restaurants.find((r) => r.id === restaurantId);
    if (!restaurant) {
      throw new RepositoryError(`Restaurant ${restaurantId} not found`, undefined, 404);
    }
    // The fixtures only carry the highlights strip, so the mock menu is those
    // dishes in one section — enough to drive the pre-order screen without
    // inventing a fake 300-item card.
    return [
      {
        title: "Популярное",
        dishes: restaurant.menuHighlights.map((dish) => ({
          id: dish.id,
          name: dish.name,
          description: dish.description,
          priceMinor: parseMockPriceMinor(dish.price),
          imageUrl: dish.photo.uri,
          isAvailable: true,
        })),
      },
    ];
  }

  /** Keyed by idempotency key, exactly like the backend: replaying a key
   * returns the original booking instead of creating a second one, so the
   * double-submit guard can be exercised offline too. */
  private readonly bookings = new Map<string, Booking>();
  private readonly bookingsByKey = new Map<string, string>();
  private readonly preorders = new Map<string, Preorder>();

  async createBooking(input: CreateBookingInput, idempotencyKey: string): Promise<Booking> {
    await this.simulateNetwork();
    const existingId = this.bookingsByKey.get(idempotencyKey);
    if (existingId) {
      return this.bookings.get(existingId)!;
    }
    const startsAt = new Date(input.startsAt);
    const booking: Booking = {
      id: `mock-booking-${this.bookings.size + 1}`,
      restaurantId: input.restaurantId,
      name: input.name,
      phone: input.phone,
      guests: input.guests,
      startsAt: input.startsAt,
      endsAt: new Date(startsAt.getTime() + SLOT_DURATION_MINUTES * 60_000).toISOString(),
      status: "confirmed",
      notes: input.notes?.trim() ? input.notes.trim() : null,
      freeCancelDeadline: new Date(startsAt.getTime() - 180 * 60_000).toISOString(),
    };
    this.bookings.set(booking.id, booking);
    this.bookingsByKey.set(idempotencyKey, booking.id);
    return booking;
  }

  async getBooking(bookingId: string): Promise<Booking> {
    await this.simulateNetwork();
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new RepositoryError(`Booking ${bookingId} not found`, undefined, 404);
    }
    return booking;
  }

  async setPreorder(bookingId: string, lines: PreorderLineInput[]): Promise<Preorder> {
    await this.simulateNetwork();
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new RepositoryError(`Booking ${bookingId} not found`, undefined, 404);
    }
    const sections = await this.getMenuSections(booking.restaurantId);
    const dishes = new Map(sections.flatMap((s) => s.dishes).map((d) => [d.id, d]));
    const items = lines.map((line, index) => {
      const dish = dishes.get(line.menuItemId);
      // Prices are resolved from the menu, never from the caller — the same
      // rule the real backend enforces.
      const priceMinor = dish?.priceMinor ?? 0;
      return {
        id: `mock-preorder-${bookingId}-${index}`,
        menuItemId: line.menuItemId,
        name: dish?.name ?? "",
        priceMinor,
        quantity: line.quantity,
        totalMinor: priceMinor * line.quantity,
        comment: line.comment?.trim() ? line.comment.trim() : null,
      };
    });
    const preorder: Preorder = {
      bookingId,
      items,
      totalMinor: items.reduce((sum, item) => sum + item.totalMinor, 0),
      currency: "KZT",
    };
    this.preorders.set(bookingId, preorder);
    return preorder;
  }

  async getPreorder(bookingId: string): Promise<Preorder> {
    await this.simulateNetwork();
    return (
      this.preorders.get(bookingId) ?? { bookingId, items: [], totalMinor: 0, currency: "KZT" }
    );
  }

  /**
   * Mirrors the backend's state machine, including the part that matters most
   * to the UI: cancelling an ALREADY terminal booking fails with the same 422
   * "invalid status transition" the real API answers, so the screen's
   * already-cancelled branch can be exercised with no backend at all.
   */
  async cancelBooking(bookingId: string, input?: CancelBookingInput): Promise<Booking> {
    await this.simulateNetwork();
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new RepositoryError(`Booking ${bookingId} not found`, undefined, 404);
    }
    if (!isCancellableBookingStatus(booking.status)) {
      throw new RepositoryError(
        `Booking ${bookingId} is ${booking.status}`,
        undefined,
        422,
        "invalid status transition",
      );
    }
    void input;
    // The real endpoint returns the plain booking payload, which carries no
    // free_cancel_deadline — reproduced here so callers cannot accidentally
    // depend on it surviving a cancel.
    const cancelled: Booking = { ...booking, status: "cancelled", freeCancelDeadline: null };
    this.bookings.set(bookingId, cancelled);
    return cancelled;
  }

  /** The mock has no payments at all, which is also the common live case: the
   * endpoint answers 404 for a booking with no deposit. */
  async getBookingPayment(bookingId: string): Promise<BookingPayment | null> {
    await this.simulateNetwork();
    if (!this.bookings.has(bookingId)) {
      throw new RepositoryError(`Booking ${bookingId} not found`, undefined, 404);
    }
    return null;
  }
}


const MOCK_TIMEZONE = "Asia/Almaty";
const SLOT_DURATION_MINUTES = 90;
const SLOT_STEP_MINUTES = 30;
/** Matches BOOKING_DEFAULT_LEAD_MINUTES on the backend. */
const LEAD_MINUTES = 60;
/** Every fixture whose id ends with this digit behaves like a live venue with
 * no tables: every slot unavailable with reason "capacity". */
const CAPACITY_ONLY_SUFFIX = "2";

/** "8 990 ₸" -> 899000. The fixture price is a display string, so this is a
 * best-effort read; an unparseable one becomes null (unknown, not free). */
function parseMockPriceMinor(display: string): number | null {
  const digits = display.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits) * 100;
}

function buildMockSlots(restaurant: Restaurant, date: string, guests: number): AvailabilitySlot[] {
  const hours = restaurant.workingHours.find((h) => h.opensAt && h.closesAt);
  if (!hours?.opensAt || !hours.closesAt) return [];
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const open = toMinutes(hours.opensAt);
  // A close time past midnight is clamped to the same day; the fixture data
  // only needs a plausible strip, not a second-day rollover.
  const close = Math.max(open + SLOT_DURATION_MINUTES, toMinutes(hours.closesAt));
  const capacityOnly = restaurant.id.endsWith(CAPACITY_ONLY_SUFFIX);
  const leadCutoff = Date.now() + LEAD_MINUTES * 60_000;

  const slots: AvailabilitySlot[] = [];
  for (let minute = open; minute + SLOT_DURATION_MINUTES <= close; minute += SLOT_STEP_MINUTES) {
    const startsAt = new Date(`${date}T${formatClock(minute)}:00`);
    const endsAt = new Date(startsAt.getTime() + SLOT_DURATION_MINUTES * 60_000);
    const index = slots.length;
    let available = true;
    let reason: AvailabilitySlot["reason"] = null;
    if (capacityOnly || guests > 12) {
      available = false;
      reason = "capacity";
    } else if (startsAt.getTime() < leadCutoff) {
      available = false;
      reason = "too_soon";
    } else if (index % 5 === 2) {
      available = false;
      reason = "occupied";
    }
    slots.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      available,
      freeTables: available ? 3 : 0,
      reason,
    });
  }
  return slots;
}

function formatClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Offline stand-in for the auth API. Accepts any well-formed email + a
 * password of at least 6 characters (the backend's own `min=6` rule) and
 * hands out an obviously fake token, so the sign-in gate and everything
 * behind it can be walked with no backend. It authenticates nobody.
 */
export class MockAuthRepository implements AuthRepository {
  private user: AuthUser | null = null;

  constructor(private readonly options: MockRepositoryOptions = {}) {}

  private async simulateNetwork(): Promise<void> {
    await delay(this.options.latencyMs ?? 500);
    if (this.options.forceError) {
      throw new RepositoryError("Simulated network failure");
    }
  }

  private session(email: string, fullName: string): AuthSession {
    this.user = {
      id: "mock-user",
      email,
      fullName,
      phone: null,
    };
    return {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  async signUp(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<AuthSession> {
    await this.simulateNetwork();
    if (input.password.length < 6) {
      throw new RepositoryError("Password too short", undefined, 422);
    }
    return this.session(input.email.trim(), input.fullName.trim());
  }

  async signIn(input: { email: string; password: string }): Promise<AuthSession> {
    await this.simulateNetwork();
    if (input.password.length < 6) {
      throw new RepositoryError("Invalid credentials", undefined, 401);
    }
    return this.session(input.email.trim(), "");
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    await this.simulateNetwork();
    if (refreshToken !== "mock-refresh-token" || !this.user) {
      throw new RepositoryError("Invalid refresh token", undefined, 401);
    }
    return this.session(this.user.email, this.user.fullName);
  }

  async getMe(): Promise<AuthUser> {
    await this.simulateNetwork();
    if (!this.user) {
      throw new RepositoryError("Not authenticated", undefined, 401);
    }
    return this.user;
  }
}
