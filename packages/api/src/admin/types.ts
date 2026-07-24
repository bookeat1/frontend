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
