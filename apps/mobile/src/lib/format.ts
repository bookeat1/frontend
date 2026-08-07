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

/** Short uppercase month names for the «Афиша» date block ("18 МАЙ"). */
const MONTHS_SHORT_UPPER = [
  "ЯНВ",
  "ФЕВ",
  "МАР",
  "АПР",
  "МАЙ",
  "ИЮН",
  "ИЮЛ",
  "АВГ",
  "СЕН",
  "ОКТ",
  "НОЯ",
  "ДЕК",
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

/**
 * "1990-05-04" → "04-05-1990".
 *
 * The WIRE format of a date and the format a guest reads are two different
 * things and must not be confused: everything that leaves the device stays
 * "YYYY-MM-DD" (that is what `time.Parse("2006-01-02")` takes on the server),
 * and this is only ever applied on the way to a `<Text>`.
 *
 * A string that is not a date key comes back unchanged rather than half
 * rearranged — showing "" or garbage for a value the server did send would
 * read as "we lost your data".
 */
export function formatDateKeyDayFirst(key: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key;
  return `${match[3]}-${match[2]}-${match[1]}`;
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

/**
 * The two lines of an «Афиша» row's left date block: the day number and the
 * short uppercase month ("18" / "МАЙ"). Returns null for an unparseable date so
 * the caller can drop the block rather than draw "NaN".
 */
export function formatEventDateBlock(iso: string): { day: string; month: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return { day: String(date.getDate()), month: MONTHS_SHORT_UPPER[date.getMonth()] };
}

/** "19:00" in the device's timezone. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * "Сегодня" / "Завтра" / "28 июля" — the day part of a booking's one-line
 * summary. Relative wording only for the two days a guest actually thinks
 * about relatively; anything further is a plain date, because "через 4 дня"
 * forces mental arithmetic the calendar already did.
 *
 * `now` is injectable so the caller can pass a stable value and the string
 * can be reasoned about; it defaults to the real clock.
 */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (isSameDay(date, now)) return "Сегодня";
  if (isSameDay(date, addDays(now, 1))) return "Завтра";
  return formatDayMonth(date);
}

/** "Сегодня, 19:00" / "28 июля, 19:00" — used in the cancellation dialog,
 * where the guest must be able to read a deadline without ambiguity. */
export function formatRelativeDateTime(iso: string, now: Date = new Date()): string {
  const day = formatRelativeDay(iso, now);
  if (!day) return "";
  return `${day}, ${formatTime(iso)}`;
}

/**
 * "Сегодня, 16:42" / "Вчера, 12:53" / "28 июля, 19:00" — the muted timestamp
 * line of a notification row. Unlike `formatRelativeDateTime` (which handles
 * future days for a booking deadline: Сегодня/Завтра), an inbox item is in the
 * past, so this resolves Сегодня/Вчера instead. The day words are passed in
 * from the dictionary so the screen stays reactive to a live language switch —
 * `formatRelativeDay` hardcodes them, which is why it is not reused here.
 */
export function formatNotificationTimestamp(
  iso: string,
  labels: { today: string; yesterday: string },
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = formatTime(iso);
  if (isSameDay(date, now)) return `${labels.today}, ${time}`;
  if (isSameDay(date, addDays(now, -1))) return `${labels.yesterday}, ${time}`;
  return `${formatDayMonth(date)}, ${time}`;
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

/** Whole tenge (MAJOR units) grouped ru-style: 25000 -> "25 000". Same
 * non-breaking group separator as formatMoneyMinor so the number never wraps
 * mid-digits. Kept private — callers want a labelled range, not a bare number. */
function groupTenge(value: number): string {
  const NBSP = "\u00A0";
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/**
 * Числовой диапазон среднего чека в «4 000–9 000 ₸»: неразрывный пробел между
 * разрядами (как в formatMoneyMinor), тире «–» (U+2013) между границами и «₸» в
 * конце через неразрывный пробел. Границы — в МАЖОРНЫХ тенге, не в тийинах.
 *
 * min === max (сервер прислал точку, а не диапазон) сворачивается в одно число
 * «5 000 ₸»: «5 000–5 000 ₸» читается как ошибка. Перевёрнутый диапазон
 * (min > max) нормализуется, чтобы битые данные не рисовали тире задом наперёд.
 */
export function formatPriceRange(range: { min: number; max: number }): string {
  const NBSP = "\u00A0";
  const low = Math.min(range.min, range.max);
  const high = Math.max(range.min, range.max);
  if (low === high) return `${groupTenge(low)}${NBSP}₸`;
  return `${groupTenge(low)}–${groupTenge(high)}${NBSP}₸`;
}
