import { t } from "./i18n";

/**
 * Pure formatting for the operational block of the panel's landing page.
 *
 * Kept out of the components on purpose: this is what breaks in real life
 * (a wait printed as "ждёт 125 мин", tomorrow's request printed as if it were
 * today), and it must be testable without a DOM.
 */

const copy = t.admin.today;

const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 24 * MINUTES_IN_HOUR;

/**
 * How long a request has been waiting, as a phrase: «ждёт 7 мин»,
 * «ждёт 2 ч 5 мин», «ждёт 3 дня».
 *
 * The value comes from the server (`waiting_minutes`), already whole and never
 * negative — but a broken payload must not print «ждёт -3 мин», so anything
 * below zero and anything not finite reads as 0 minutes.
 *
 * Above an hour the minutes still matter (the difference between «1 ч» and
 * «1 ч 55 мин» is a guest who is about to give up), above a day they do not.
 */
export function formatWaiting(minutes: number): string {
  return copy.waiting(formatWaitingDuration(minutes));
}

/** The bare duration, without the «ждёт» prefix. */
export function formatWaitingDuration(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;

  if (total < MINUTES_IN_HOUR) return copy.waitingMinutes(total);
  if (total < MINUTES_IN_DAY) {
    const hours = Math.floor(total / MINUTES_IN_HOUR);
    const rest = total % MINUTES_IN_HOUR;
    return rest === 0 ? copy.waitingHours(hours) : copy.waitingHoursMinutes(hours, rest);
  }
  return copy.waitingDays(Math.floor(total / MINUTES_IN_DAY));
}

const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

/**
 * The day part of a booking's start, relative to the reader's own day:
 * «сегодня», «завтра», or a bare date for anything further out.
 *
 * WHY RELATIVE: the awaiting queue is not limited to today — a request for
 * Saturday sits in it — and «14 авг» tells a hostess much less at a glance than
 * «завтра» does. Everything past tomorrow keeps the date, because «через 4 дня»
 * is arithmetic the reader should not have to redo.
 *
 * Comparison is on the LOCAL calendar date, not on a 24-hour distance: at 23:50
 * a booking at 00:30 is «завтра», not «через 40 минут».
 */
export function formatBookingDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const days = calendarDaysBetween(now, d);
  if (days === 0) return copy.dayToday;
  if (days === 1) return copy.dayTomorrow;
  return dayFmt.format(d);
}

/** «сегодня 19:30» / «завтра 12:00» / «14 авг 20:00». */
export function formatBookingWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatBookingDay(iso, now)} ${timeFmt.format(d)}`;
}

function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * The `tel:` target for a phone the guest typed. Everything that is not a digit
 * or a leading plus is dropped, because a tablet's dialer chokes on spaces and
 * brackets — but the DISPLAYED number stays exactly as the guest gave it, so
 * staff can read it back over the phone.
 */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}
