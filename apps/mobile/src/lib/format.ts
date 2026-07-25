/**
 * Date / time / money formatting for the reservation flow.
 *
 * Everything here is hand-rolled rather than `Intl.*` on purpose: React
 * Native's ICU support varies with the engine and build (a Hermes build
 * without full ICU silently falls back to English month names), and the same
 * booking must read identically on every device. The existing money formatter
 * in packages/api/http-mapping.ts made the same call for the same reason.
 */

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_NOMINATIVE = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

/** Monday-first, matching the RU calendar convention. */
export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** JS getDay() is Sunday-first; the calendar grid is Monday-first. */
export function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** "YYYY-MM-DD" in the DEVICE's local calendar — the key the availability
 * endpoint takes. `toISOString().slice(0,10)` would be wrong: it shifts to UTC
 * and in Almaty (+05:00) turns any evening into the previous day. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" as a LOCAL midnight, not UTC (see toDateKey). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "28 июля" */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** "Июль 2026" — calendar header. */
export function formatMonthYear(date: Date): string {
  return `${MONTHS_NOMINATIVE[date.getMonth()]} ${date.getFullYear()}`;
}

/** "19:00" in the device's timezone. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "28 июля, 19:00" — the one-line "when" of a booking. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDayMonth(date)}, ${formatTime(iso)}`;
}

/**
 * Minor units (tiyin) to "8 990 ₸". The group separator is a non-breaking
 * space so a price never wraps in the middle of the number, and the tenge
 * sign is joined with one too so it never falls to the next line alone.
 */
export function formatMoneyMinor(minor: number): string {
  const whole = Math.round(minor / 100).toString();
  // Escaped, not a literal U+00A0: an invisible character in source is a
  // real hazard (eslint no-irregular-whitespace flags it) and impossible to
  // review by eye.
  const NBSP = "\u00A0";
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)}${NBSP}₸`;
}
