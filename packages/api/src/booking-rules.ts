/**
 * Явные правила брони — Trello BNjLdfSP («Явные правила брони в момент
 * бронирования и в напоминании»).
 *
 * Заведение может задать три поля (`bookeat-backend`, параллельная работа,
 * ветка/PR на момент этого коммита ещё не смёржены в `develop`):
 *   - `hold_minutes` — сколько минут после времени брони стол держат;
 *   - `free_cancel_hours` — за сколько часов до брони отмена ещё бесплатна;
 *   - `late_arrival_text` — что сказать гостю про опоздание.
 *
 * Контракт: ЭФФЕКТИВНОЕ значение (заданное заведением или платформенный
 * дефолт) должно прийти в ответе API самим сервером. Три функции ниже —
 * страховка НА КЛИЕНТЕ на случай, если бэкенд ещё не задеплоен/не смёржен:
 * поле на `Restaurant` в этом случае отсутствует (`undefined`), и здесь
 * подставляется ровно тот дефолт, что обещан бэкендом, — те же числа, тот же
 * текст. Когда бэкенд начнёт присылать поле всегда, эти функции не перестанут
 * работать (тот же дефолт останется страховкой на случай пропуска поля), но
 * фактически будут просто возвращать серверное значение.
 */

export const PLATFORM_DEFAULT_HOLD_MINUTES = 15;
export const PLATFORM_DEFAULT_FREE_CANCEL_HOURS = 2;
export const PLATFORM_DEFAULT_LATE_ARRIVAL_TEXT = "Опаздываете — позвоните в заведение.";

/** Заведение, у которого могут быть эти три поля — ровно то подмножество
 * `Restaurant`, которое нужно этому модулю, чтобы его можно было передавать
 * и частичные объекты (например, тестовые фикстуры). */
export interface VenueBookingRulesSource {
  holdMinutes?: number;
  freeCancelHours?: number;
  lateArrivalText?: string;
}

export function effectiveHoldMinutes(venue: VenueBookingRulesSource | null | undefined): number {
  return typeof venue?.holdMinutes === "number" ? venue.holdMinutes : PLATFORM_DEFAULT_HOLD_MINUTES;
}

export function effectiveFreeCancelHours(
  venue: VenueBookingRulesSource | null | undefined,
): number {
  return typeof venue?.freeCancelHours === "number"
    ? venue.freeCancelHours
    : PLATFORM_DEFAULT_FREE_CANCEL_HOURS;
}

export function effectiveLateArrivalText(venue: VenueBookingRulesSource | null | undefined): string {
  const trimmed = venue?.lateArrivalText?.trim();
  return trimmed ? trimmed : PLATFORM_DEFAULT_LATE_ARRIVAL_TEXT;
}
