import type { Booking, BookingStatus } from "@bookeat/api/client";
import { isCancellableBookingStatus } from "@bookeat/api/client";

/**
 * Правила страницы гостя для списка броней (узел 3525:15153).
 *
 * `GET /bookings` отдаёт машинный статус и не знает, что «подтверждённая»
 * бронь, у которой визит уже закончился, для гостя — истёкшая: статуса
 * `expired` у бэкенда нет (см. `conventions/bookeat-frontend.md`,
 * `isRebookableBooking`). Поэтому сегменты и ярлыки считаются здесь, а не
 * на сервере, и все функции принимают `now` явно — иначе их не проверить.
 */

export type BookingSegment = "active" | "past" | "cancelled";

/** Ключи ярлыка совпадают с `t.web.profile.bookings.status`. */
export type StatusPillKey =
  | "confirmed"
  | "pending"
  | "waitlist"
  | "arrived"
  | "completed"
  | "cancelled"
  | "noShow"
  | "expired";

/** Тона совпадают с точками `webProfile.bookingCard.statusPill.dot`. */
export type StatusPillTone = "success" | "warning" | "neutral";

export interface StatusPill {
  key: StatusPillKey;
  tone: StatusPillTone;
}

/** Бронь ещё «открыта»: ждёт решения заведения или подтверждена. */
const OPEN_STATUSES: readonly BookingStatus[] = ["pending", "confirmed", "waitlist"];
/** Гость был в заведении — это и есть «визит» в статистике карточки. */
const VISITED_STATUSES: readonly BookingStatus[] = ["arrived", "completed"];
/** Бронь не состоялась по чьей-то воле, а не по времени. */
const CANCELLED_STATUSES: readonly BookingStatus[] = ["cancelled", "no_show"];

function isOver(booking: Booking, now: Date): boolean {
  return Date.parse(booking.endsAt) <= now.getTime();
}

/** Открытая бронь, чей визит ещё не закончился. */
export function isActiveBooking(booking: Booking, now: Date): boolean {
  return OPEN_STATUSES.includes(booking.status) && !isOver(booking, now);
}

export function segmentOf(booking: Booking, now: Date): BookingSegment {
  if (CANCELLED_STATUSES.includes(booking.status)) return "cancelled";
  if (isActiveBooking(booking, now)) return "active";
  return "past";
}

/**
 * Раскладывает список по сегментам «Активные / Прошедшие / Отменённые».
 *
 * Активные — ближайший визит первым: гостю нужен тот, что «сегодня вечером».
 * Прошедшие и отменённые остаются в порядке сервера (он отдаёт свежие
 * первыми); пересортировка по `startsAt` здесь ничего не добавила бы, а
 * отменённая бронь на далёкую дату и вовсе встала бы выше вчерашней.
 */
export function splitBySegment(
  bookings: readonly Booking[],
  now: Date = new Date(),
): Record<BookingSegment, Booking[]> {
  const split: Record<BookingSegment, Booking[]> = { active: [], past: [], cancelled: [] };
  for (const booking of bookings) split[segmentOf(booking, now)].push(booking);
  split.active.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return split;
}

export function statusPill(booking: Booking, now: Date): StatusPill {
  switch (booking.status) {
    case "pending":
    case "confirmed":
    case "waitlist":
      if (isOver(booking, now)) return { key: "expired", tone: "neutral" };
      if (booking.status === "confirmed") return { key: "confirmed", tone: "success" };
      return { key: booking.status, tone: "warning" };
    case "arrived":
      return { key: "arrived", tone: "success" };
    case "completed":
      return { key: "completed", tone: "neutral" };
    case "cancelled":
      return { key: "cancelled", tone: "neutral" };
    case "no_show":
      return { key: "noShow", tone: "neutral" };
  }
}

/** Код брони показывает только подтверждённая и ещё не прошедшая бронь. */
export function canShowCode(booking: Booking, now: Date): boolean {
  return booking.status === "confirmed" && !isOver(booking, now);
}

/** «Изменить» — у ожидающей и подтверждённой, пока визит не прошёл. */
export function canChange(booking: Booking, now: Date): boolean {
  return (booking.status === "pending" || booking.status === "confirmed") && !isOver(booking, now);
}

/**
 * «Отменить» решает ТОЛЬКО статус — так же, как `POST /bookings/:id/cancel`
 * на бэкенде; времени в правиле нет нарочно (см. `CANCELLABLE_BOOKING_STATUSES`).
 */
export function canCancel(booking: Booking): boolean {
  return isCancellableBookingStatus(booking.status);
}

/** Визиты для статистики карточки гостя — только состоявшиеся. */
export function countVisits(bookings: readonly Booking[]): number {
  return bookings.filter((booking) => VISITED_STATUSES.includes(booking.status)).length;
}
