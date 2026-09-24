/**
 * Денежное окно бесплатной отмены (`restaurants.free_cancel_window_minutes`),
 * записывается отдельной ручкой `PUT /admin/restaurants/:id/payment-settings/
 * free-cancel-window` (bookeat-backend `internal/usecase/admin.SetFreeCancelWindow`)
 * — НЕ той же ручкой, что остальной профиль заведения, поэтому свой файл, как
 * у `whatsapp-phone.ts`.
 *
 * Колонка `NOT NULL DEFAULT 120` (миграции 0034/0035): в отличие от
 * `hold_minutes`, здесь нет значения-сентинела «сброшено на платформенный
 * дефолт» — у заведения ВСЕГДА есть конкретное число. Пустое поле формы
 * поэтому не отправляет `null`, а отправляет САМ платформенный дефолт
 * (`PLATFORM_DEFAULT_FREE_CANCEL_HOURS * 60`) — вызывающая сторона решает это
 * снаружи (см. `VenuesView.tsx`), здесь только разбор и границы.
 */

/** Границы minutes зеркалят `usecase/admin.minFreeCancelWindowMinutes` /
 * `maxFreeCancelWindowMinutes` — сервер держит 0..7 дней. */
export const FREE_CANCEL_WINDOW_MIN_MINUTES = 0;
export const FREE_CANCEL_WINDOW_MAX_MINUTES = 7 * 24 * 60;

/**
 * Разбирает значение поля формы (минуты). Пустая строка и нечисловой ввод
 * трактуются ОДИНАКОВО — как «нет собственного значения» (`null`), той же
 * логикой, что и `hold_minutes` в `VenuesView.tsx`. Число вне границ
 * зажимается в допустимый диапазон, а не отбрасывается: отрицательное
 * значение никогда не должно уйти на сервер, а обрезание вместо ошибки —
 * клиентская validation-for-UX, сервер всё равно проверит диапазон повторно.
 */
export function parseFreeCancelWindowMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(FREE_CANCEL_WINDOW_MAX_MINUTES, Math.max(FREE_CANCEL_WINDOW_MIN_MINUTES, parsed));
}

/**
 * The slice of `CatalogVenue` this module's display helper needs — kept
 * narrow (not imported from `./types`) so a fixture only has to supply the
 * two fields that matter, same reasoning as `VenueBookingRulesSource` in
 * `../booking-rules.ts`.
 */
export interface FreeCancelWindowDisplaySource {
  free_cancel_window_minutes?: number | null;
  booking_rules?: { free_cancel_hours?: number } | null;
}

/**
 * What `VenuesView`'s edit form should show on load: the EXACT stored
 * minutes when the cabinet read carries them (backend
 * `attachFreeCancelWindowMinutes`, added alongside the fix for the "1 minute
 * saved, reloads as 0" bug — `free_cancel_hours` rounds to the nearest
 * hour). Falls back to `hours * 60` only when the exact field is absent —
 * an old server build or a stale cached client — which is lossy for a
 * non-hour-aligned window but was already the previous behaviour, so it is
 * kept as a compatibility floor, not the primary path. Empty string means
 * neither is available (no data to prefill at all).
 */
export function initialFreeCancelMinutesField(detail: FreeCancelWindowDisplaySource): string {
  if (typeof detail.free_cancel_window_minutes === "number") {
    return String(detail.free_cancel_window_minutes);
  }
  if (typeof detail.booking_rules?.free_cancel_hours === "number") {
    return String(detail.booking_rules.free_cancel_hours * 60);
  }
  return "";
}
