/**
 * STUB DATA — fields the real backend does not provide (yet).
 *
 * Everything exported from this file is an assumption or a placeholder. It is
 * the ONE place HttpRestaurantRepository is allowed to reach for something the
 * API did not send. The rule for this file: nothing in it may reach a screen
 * looking like a fact about the world. A missing value is rendered as missing;
 * an assumption is either invisible or labelled.
 *
 * Confirmed absent from `backend-core` as of this writing (checked the DTOs
 * in internal/transport/rest/restaurants and internal/transport/rest/menu,
 * and internal/domain/restaurant.go + menu.go):
 *   - a "popular in menu" flag on menu items: NO LONGER ABSENT (2026-08-27).
 *     The venue marks its own «Лучшие позиции» (menu_items.top_pick_position)
 *     and the server serves the whole rail from
 *     GET /restaurants/:id/menu-highlights, marked dishes first. The app no
 *     longer derives it — see mapMenuHighlights in http-mapping.ts.
 *   - a tenge price *range* (only a price_category tier "₸"/"₸₸"/"₸₸₸" exists)
 *   - social links: DOES exist (social_links on the detail endpoint) — real
 *     data is used for that.
 *
 * Removed from this file (2026-07-26), because the app was showing them as
 * real data:
 *   - stubDistanceMeters() — a hash of the restaurant id rendered as "3.4 км"
 *     next to the address on the venue screen and on every search card. That
 *     is a claim about the physical world that nobody measured. A real
 *     distance needs the guest's location plus a real calculation (and there
 *     is no geo query in the API at all); until both exist, the app says
 *     nothing about distance. `distanceMeters` is gone from the types too, so
 *     it cannot quietly come back.
 *   - stubPopularSearches() / stubRecentSearches() — three hardcoded phrases
 *     ("Грузинская кухня", "Паназиатская кухня", "Веранда") presented under
 *     the heading «Популярные запросы». All three returned zero results
 *     against the live catalog (verified by curl 2026-07-26). The search
 *     screen now shows the real catalog when the query is empty, and there is
 *     no search-terms endpoint to replace them with.
 *
 * Removed 2026-07-26 (второй заход), потому что сервер стал отдавать факт:
 *   - ASSUMED_IS_BOOKABLE — константа `true`, из-за которой кнопка
 *     «Забронировать столик» предлагалась КАЖДОМУ заведению, а правда
 *     («столиков нет, слотов не будет ни на одну дату») выяснялась только
 *     после выбора даты. Теперь в payload есть `accepts_online_bookings`, и
 *     он читается как есть: на живом каталоге 17 заведений из 24 брони не
 *     принимают.
 *   - парсер `opening_hours` (parseOpeningHours / buildWorkingHours /
 *     computeIsOpenNow) — «открыто сейчас» и «открыто до 24:00» выводились из
 *     первого и последнего времени в свободнотекстовой строке и часов
 *     устройства. Теперь есть `schedule` с графиком по дням и `open_now`,
 *     посчитанным сервером в таймзоне заведения.
 *
 * Fixed earlier, no longer stubbed here:
 *   - the map preview — GET /restaurants/:id/map is real (a server-rendered
 *     PNG, see static-map.ts); the placehold.co stub image is gone
 *   - promo banners — GET /restaurants/:id/promos is real (image-less, so the
 *     banner is caption-only)
 *   - rating / reviewsCount — GET /restaurants/:id/reviews/summary is real
 *     (venue screen only; the listing endpoint still carries no rating)
 */
import type { RestaurantTable } from "./types";

/**
 * STUB: there is no seating/table endpoint or field. Empty rather than
 * invented, and nothing renders it today.
 */
export function stubTables(): RestaurantTable[] {
  return [];
}

