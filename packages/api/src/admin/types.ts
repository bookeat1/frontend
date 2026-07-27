/**
 * Admin-panel API types. These mirror the backend DTOs 1:1 (see
 * backend-core/internal/transport/rest/{auth,admin}/{request,response}.go).
 * Kept in a dedicated subpath (`@bookeat/api/admin`) so the web admin app can
 * consume a framework-light surface without dragging in the mobile mock data
 * (which imports .jpg assets) or the React-Native peer types.
 */

/** Auth token pair returned by /auth/login, /auth/refresh. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  /** RFC3339 timestamp of access-token expiry. */
  expires_at: string;
}

/** The signed-in user (GET /users/me). `role` is the global role, NOT the
 * per-restaurant staff role — the panel resolves restaurant membership by
 * loading the restaurant profile (see AdminApiClient.getProfile). */
export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: string;
  avatar_url: string | null;
  preferred_language: string;
}

/** Standard paginated list envelope (response.Page[T]). */
export interface ApiPage<T> {
  items: T[];
  total: number;
  pages: number;
  page: number;
  per_page: number;
}

/** Booking lifecycle states (domain.BookingStatus). */
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "waitlist"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";

/** Where a booking originated (domain.BookingSource). */
export type BookingSource = "app" | "admin" | "phone" | "widget";

/** One booking row as shown in the venue calendar (admin.bookingResponse). */
export interface AdminBooking {
  id: string;
  restaurant_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  email: string;
  guests: number;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: BookingSource;
  notes: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
}

/** One menu item (admin.menuItemResponse). Price is a decimal string. */
export interface AdminMenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: string;
  image_url: string | null;
  is_available: boolean;
  category: string | null;
  subcategory: string | null;
  portion_size: string | null;
  display_order: number | null;
  tags: string[];
}

/** A menu category (admin.menuCategoryResponse). */
export interface AdminMenuCategory {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
}

/** The venue's own profile (admin.restaurantProfileResponse). Editorial flags
 * (is_active/is_premium) are read-only display fields. */
export interface RestaurantProfile {
  id: string;
  name: string;
  description: string;
  address: string;
  opening_hours: string;
  phone: string;
  email: string;
  city: string;
  price_category: string;
  is_active: boolean;
  is_premium: boolean | null;
}

/** Filters for GET /admin/restaurants/:id/bookings. */
export interface BookingListParams {
  /** Single calendar day, "YYYY-MM-DD". Ignored if from/to are set. */
  date?: string;
  from?: string;
  to?: string;
  /** One or more statuses (sent comma-joined). */
  statuses?: BookingStatus[];
  page?: number;
  per_page?: number;
}

/** Optional body on confirm/reject/no-show transitions. */
export interface BookingReasonInput {
  reason?: string;
}

/** Optional body on a venue cancellation. */
export interface BookingCancelInput {
  reason_code?: string;
  reason?: string;
}

// ---- My restaurants (post-login picker) ------------------------------------

/** One entry of GET /admin/my-restaurants (myrestaurants.restaurantResponse):
 * a restaurant the signed-in staff member manages, plus their role there. */
export interface MyRestaurant {
  id: string;
  name: string;
  /** "owner" | "manager" | "hostess", or "admin" for a superadmin. */
  role: string;
}

/** Envelope of GET /admin/my-restaurants (data is `{restaurants: [...]}`). */
export interface MyRestaurantsResponse {
  restaurants: MyRestaurant[];
}

// ---- Events ----------------------------------------------------------------

/** Event publication state (domain.EventStatus). draft -> published -> hidden. */
export type EventStatus = "draft" | "published" | "hidden";

/** One event as returned by the admin endpoints (events.eventResponse, admin
 * shape — carries the raw i18n maps). Money is integer minor units, never a
 * float. `*_i18n`, cover_image_url, ticket_price_minor and capacity are omitted
 * by the backend when empty. */
export interface AdminEvent {
  id: string;
  restaurant_id: string;
  title: string;
  title_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  starts_at: string;
  ends_at: string;
  venue?: string;
  cover_image_url?: string | null;
  status: EventStatus;
  ticketed: boolean;
  ticket_price_minor?: number | null;
  capacity?: number | null;
  created_at: string;
  updated_at: string;
}

/** Create/update payload for an event (events.eventRequest). starts_at/ends_at
 * must be RFC3339. ticket_price_minor is integer minor units. */
export interface EventInput {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  cover_image_url: string | null;
  status: EventStatus;
  ticketed: boolean;
  ticket_price_minor: number | null;
  capacity: number | null;
}

// ---- Promos ----------------------------------------------------------------

/** Promo publication state (domain.PromoStatus). draft -> published -> hidden. */
export type PromoStatus = "draft" | "published" | "hidden";

/** One promo as returned by the admin endpoints (promos.promoResponse). */
export interface AdminPromo {
  id: string;
  restaurant_id: string;
  title: string;
  title_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  starts_at: string;
  ends_at: string;
  terms?: string;
  status: PromoStatus;
  created_at: string;
  updated_at: string;
}

/** Create/update payload for a promo (promos.promoRequest). */
export interface PromoInput {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  terms: string;
  status: PromoStatus;
}

// ---- Schedule --------------------------------------------------------------

/** One weekday's working hours (admin.workingHoursResponse). day_of_week is
 * 0..6; the backend does not fix the week-start, so the UI labels 0 as Sunday
 * (JS Date convention) — confirm against seeded data. Times are "HH:MM" or
 * "HH:MM:SS" strings, null when closed. */
export interface WorkingHours {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

/** A special-day override (admin.scheduleOverrideResponse). A holiday can be
 * marked as a PAID booking day: booking_payment_required + deposit_amount_minor
 * (integer minor units — the UI shows/enters whole ₸). */
export interface ScheduleOverride {
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
  booking_payment_required: boolean;
  deposit_amount_minor: number | null;
}

/** GET /admin/restaurants/:id/schedule (admin.scheduleResponse). */
export interface Schedule {
  working_hours: WorkingHours[];
  overrides: ScheduleOverride[];
}

/** Upsert payload for a single override (admin.scheduleOverrideRequest). */
export interface ScheduleOverrideInput {
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
  booking_payment_required: boolean;
  deposit_amount_minor: number | null;
}

// ---- Guests ----------------------------------------------------------------

/** One aggregated guest row (admin.guestResponse). Read-only. */
export interface AdminGuest {
  user_id: string | null;
  name: string;
  phone: string;
  phone_normalized: string;
  email: string;
  bookings_count: number;
  visits_count: number;
  first_booking_at: string;
  last_booking_at: string;
}

/** Filters for the admin event/promo listings. */
export interface AdminListParams {
  statuses?: string[];
  page?: number;
  per_page?: number;
}

// ---- Web push subscriptions ------------------------------------------------

/** The browser PushSubscription reduced to the backend's expected shape
 * (pushsubscriptions.registerRequest). `p256dh` and `auth` are base64url
 * (URL-safe, no padding) — the encoding webpush-go decodes with
 * base64.RawURLEncoding, which is also what the browser produces. */
export interface PushSubscriptionInput {
  restaurant_id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ---- Booking policy / capacity mode ----------------------------------------

/**
 * How a venue accounts for occupancy (domain.CapacityMode, migration 0054).
 *
 * `tables` — a booking is seated at a concrete table and the GiST exclusion
 * constraint on booking_tables is the authority.
 * `seats` — the venue declares a total number of seats and bookings are
 * counted against per-slot capacity buckets; no tables are involved.
 */
export type CapacityMode = "tables" | "seats";

/** The policy actually in force = global defaults with the venue's overrides
 * applied (bookings.effectiveBookingPolicy). Read-only. */
export interface EffectiveBookingPolicy {
  timezone: string;
  booking_duration_minutes: number;
  booking_buffer_minutes: number;
  booking_lead_minutes: number;
  booking_horizon_days: number;
  cancel_deadline_minutes: number;
  confirm_sla_minutes: number;
  max_guests_per_booking: number;
  auto_confirm: boolean;
  capacity_mode: CapacityMode;
  capacity_seats: number;
}

/** What the venue has explicitly overridden; `null` = "inherit the default"
 * (bookings.bookingPolicyOverrideBlock). */
export interface BookingPolicyOverrides {
  timezone: string | null;
  booking_duration_minutes: number | null;
  booking_buffer_minutes: number | null;
  booking_lead_minutes: number | null;
  booking_horizon_days: number | null;
  cancel_deadline_minutes: number | null;
  confirm_sla_minutes: number | null;
  max_guests_per_booking: number | null;
  auto_confirm: boolean | null;
  booking_capacity_mode: CapacityMode | null;
  booking_capacity_seats: number | null;
}

/** GET /admin/restaurants/:id/booking-policy (bookings.bookingPolicyResponse). */
export interface BookingPolicy {
  restaurant_id: string;
  effective: EffectiveBookingPolicy;
  overrides: BookingPolicyOverrides;
}

/**
 * PATCH body. Every field is optional and an OMITTED key means "leave that
 * column alone" — the server models them as Go pointers (bookings/request.go:
 * bookingPolicyRequest), and a body with no field at all is a 422. Send only
 * what the staff member actually changed.
 */
export interface BookingPolicyPatch {
  booking_capacity_mode?: CapacityMode;
  booking_capacity_seats?: number;
}

// ---- Gastroguide (superadmin editor) ---------------------------------------

/**
 * A guide collection's publication state (domain.GuideCollectionStatus).
 *
 * Note it is NOT the promo/event triple: there is no "hidden", and "archived"
 * is not the same thing — an archived collection was live once and keeps its
 * venue links so it can be brought back, which is why the editor's badge and
 * the promos badge cannot be the same component.
 */
export type GuideCollectionStatus = "draft" | "published" | "archived";

/** A localized field's translation map ({"kk": "...", "en": "..."}). The base
 * ru value lives in the plain column beside it; a missing key falls back to it,
 * so an empty string here is never sent — it would make the app render blank. */
export type I18nMap = Record<string, string>;

/** A guide rubric as the editor sees it (GET /admin/gastroguide/categories).
 * Unlike the guest read this includes switched-off rubrics. */
export interface GuideCategory {
  id: string;
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  position: number;
  is_active: boolean;
}

/** Body of POST/PUT /admin/gastroguide/categories. */
export interface GuideCategoryInput {
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  position: number;
  is_active: boolean;
}

/** A collection row in the editor's list. */
export interface GuideCollection {
  id: string;
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  subtitle: string;
  subtitle_i18n?: I18nMap;
  description: string;
  description_i18n?: I18nMap;
  cover_image_url: string | null;
  /** null means the collection is shown in every city. */
  city: string | null;
  status: GuideCollectionStatus;
  published_at: string | null;
  position: number;
  /**
   * How many venues a GUEST can open right now — not how many the editor
   * attached. A collection holding a deactivated venue reports fewer than it
   * shows in the detail, and that difference is the point: it is the same
   * number the app displays.
   */
  venue_count: number;
  category_slugs: string[];
  updated_at: string;
}

/** One venue inside a collection, as the editor sees it. */
export interface GuideCollectionVenue {
  restaurant_id: string;
  position: number;
  note: string;
  note_i18n?: I18nMap;
  name: string;
  address: string;
  cuisine_type: string;
  city: string;
  price_category: string;
  primary_image_url: string | null;
  /**
   * The venue's catalog state. False means the venue is currently invisible to
   * guests and does not count towards venue_count — the editor keeps the
   * curation (deactivation is routinely temporary), but has to be able to SEE
   * that the slot is dark.
   */
  is_active: boolean;
}

/** GET /admin/gastroguide/collections/:id — the collection plus everything in it. */
export interface GuideCollectionDetail extends GuideCollection {
  venues: GuideCollectionVenue[];
  categories: GuideCategory[];
}

/**
 * Body of POST/PUT /admin/gastroguide/collections — a FULL replace of the
 * editable fields.
 *
 * Status and published_at are deliberately absent: publication is its own set
 * of endpoints, so fixing a typo can never take a collection live or pull it
 * down. `city: null` means "every city".
 */
export interface GuideCollectionInput {
  slug: string;
  title: string;
  title_i18n?: I18nMap;
  subtitle: string;
  subtitle_i18n?: I18nMap;
  description: string;
  description_i18n?: I18nMap;
  cover_image_url: string | null;
  city: string | null;
  position: number;
}

/** Query of the editor's collection listing. */
export interface GuideCollectionListParams {
  /** Empty/omitted = every status. */
  status?: GuideCollectionStatus[];
  city?: string;
  q?: string;
  page?: number;
  per_page?: number;
}

/** One row of the venue catalog search used when attaching a venue
 * (GET /restaurants/search — the public catalog endpoint, reused here). */
export interface VenueSearchResult {
  id: string;
  name: string;
  address: string;
  cuisine_type: string;
  city: string;
  price_category: string;
  is_active: boolean;
  primary_image?: string | null;
}
