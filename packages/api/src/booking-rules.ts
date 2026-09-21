/**
 * Явные правила брони — Trello BNjLdfSP («Явные правила брони в момент
 * бронирования и в напоминании»), `bookeat-backend` PR #143 (смёржен в
 * `develop`).
 *
 * Заведение может задать три поля — `hold_minutes`, `late_arrival_text`
 * (колонки `restaurants`, пишутся через `PATCH /restaurants/:id`) и
 * `free_cancel_hours` (НЕ отдельная колонка — сервер округляет её из уже
 * существующего денежного окна `restaurants.free_cancel_window_minutes`, см.
 * `usecase/restaurants.ResolveBookingRules`, и своей ручки записи у неё в
 * этом PR нет). Сервер отдаёт все три УЖЕ РАЗРЕШЁННЫМИ (заданное заведением
 * или платформенный дефолт) вложенным объектом `booking_rules` — и на
 * детальном ответе заведения (`GET/PATCH /restaurants/:id`), и на
 * `GET /bookings/:id` (`EffectiveBookingRules` в `types.ts`).
 *
 * Три функции ниже — страховка НА КЛИЕНТЕ на случай отсутствия блока: старая
 * сборка сервера, листинг (там `booking_rules` не бывает вовсе) или
 * несработавший на сервере резолвер (сервер сам называет это «not a hard
 * dependency» и глотает ошибку, отдавая брони без блока). В этих случаях
 * подставляется ровно тот дефолт, что зашит в бэкенд (`BOOKING_DEFAULT_HOLD_MINUTES`
 * / `PAYMENTS_FREE_CANCEL_WINDOW_MINUTES` / `BOOKING_DEFAULT_LATE_ARRIVAL_TEXT`)
 * — те же числа, тот же текст. Источник для этих функций — И `Restaurant`
 * (поля `holdMinutes`/`freeCancelHours`/`lateArrivalText`), И
 * `Booking.bookingRules` (уже вложенный объект той же формы) — оба
 * структурно подходят под `VenueBookingRulesSource` ниже.
 */

export const PLATFORM_DEFAULT_HOLD_MINUTES = 15;
export const PLATFORM_DEFAULT_FREE_CANCEL_HOURS = 2;
export const PLATFORM_DEFAULT_LATE_ARRIVAL_TEXT = "Опаздываете — позвоните в заведение.";

/** То подмножество полей `Restaurant`/`EffectiveBookingRules`, которое нужно
 * этому модулю, чтобы под него подходили и частичные объекты (тестовые
 * фикстуры), и уже полностью разрешённый `Booking.bookingRules`. */
export interface VenueBookingRulesSource {
  holdMinutes?: number;
  freeCancelHours?: number;
  lateArrivalText?: string;
}

export function effectiveHoldMinutes(source: VenueBookingRulesSource | null | undefined): number {
  return typeof source?.holdMinutes === "number" ? source.holdMinutes : PLATFORM_DEFAULT_HOLD_MINUTES;
}

export function effectiveFreeCancelHours(
  source: VenueBookingRulesSource | null | undefined,
): number {
  return typeof source?.freeCancelHours === "number"
    ? source.freeCancelHours
    : PLATFORM_DEFAULT_FREE_CANCEL_HOURS;
}

export function effectiveLateArrivalText(source: VenueBookingRulesSource | null | undefined): string {
  const trimmed = source?.lateArrivalText?.trim();
  return trimmed ? trimmed : PLATFORM_DEFAULT_LATE_ARRIVAL_TEXT;
}
