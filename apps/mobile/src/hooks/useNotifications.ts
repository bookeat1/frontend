/**
 * Guest notifications inbox — the data behind the «Уведомления» screen.
 *
 * IMPORTANT: the backend has NO notifications-list endpoint yet. What exists
 * today is push delivery only — `registerPushToken` / `unregisterPushToken`
 * (packages/api) and three guest push EVENTS emitted server-side
 * (booking.confirmed / booking.cancelled / booking.reminder, see
 * src/lib/push-routing.ts). None of them is stored and re-served as a feed.
 *
 * So this hook returns an EMPTY list, on purpose: the screen renders a real
 * empty state rather than fabricated rows. It is shaped like a data hook (a
 * fixed list + an unread count + loading/error flags) so wiring the real
 * endpoint later is a body swap, not a screen rewrite.
 *
 * TODO(backend): when a notifications feed exists (e.g. GET /notifications
 * returning { items, unread_count }), add the method to `RestaurantRepository`,
 * implement it in `HttpRestaurantRepository`, and replace the constant below
 * with a `useQuery` on `useRepository()` — mirror `useMyBookings`. The
 * `AppNotification` shape and the type→filter mapping here already match the
 * three chips the design asks for.
 */

/**
 * A single inbox item. `type` drives the leading icon and the chip filter:
 *   - "booking"  → a confirmed/updated reservation (ForkKnife icon)
 *   - "reminder" → a visit reminder (Bell icon)
 *   - "promo"    → a discount/offer from a venue (Percent icon)
 *
 * "booking"/"reminder" line up with the backend's existing guest push events;
 * "promo" is not emitted by the backend yet, but the chip and icon are ready
 * for it. All fields mirror what a feed row would carry — nothing is invented
 * at runtime because no rows are produced today.
 */
export type NotificationType = "booking" | "reminder" | "promo";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** RFC3339, server time. Rendered via `formatNotificationTimestamp`. */
  createdAt: string;
  read: boolean;
}

/** The three filter chips. `all` shows everything; `bookings` covers both
 * booking and reminder items; `promos` covers promo items. */
export type NotificationFilter = "all" | "bookings" | "promos";

/** Which notification types each chip admits. Single source of truth so the
 * chip row and the filtering stay in sync. */
export function matchesFilter(type: NotificationType, filter: NotificationFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "bookings":
      return type === "booking" || type === "reminder";
    case "promos":
      return type === "promo";
  }
}

export interface UseNotificationsResult {
  notifications: readonly AppNotification[];
  /** Unread items across all types. 0 today (no feed) — the home bell shows no
   * badge until a real endpoint can supply a real count. */
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
}

/** No feed endpoint yet — see the file header. Kept as a module constant so the
 * empty array is referentially stable across renders (no new [] each call). */
const NO_NOTIFICATIONS: readonly AppNotification[] = [];

export function useNotifications(): UseNotificationsResult {
  return {
    notifications: NO_NOTIFICATIONS,
    unreadCount: 0,
    isLoading: false,
    isError: false,
  };
}
