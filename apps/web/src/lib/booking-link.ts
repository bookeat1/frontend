import { DEFAULT_GUESTS, GUEST_OPTIONS } from "@web/lib/booking-options";

/**
 * Адрес страницы бронирования и то, что он несёт.
 *
 * ВЫБОР ЖИВЁТ В АДРЕСНОЙ СТРОКЕ, а не только в состоянии экрана. Три причины,
 * и все три — про уже случавшиеся поломки:
 *
 *   • страница бронирования открывается из карточки в правой колонке
 *     заведения, где гость уже выбрал день, компанию и время. Потерять этот
 *     выбор на переходе значит заставить сделать его дважды;
 *   • дальше гость уходит на `/login` и возвращается по `?next=`. Возврат
 *     несёт ПУТЬ СО СТРОКОЙ ПОИСКА, поэтому выбор переживает вход бесплатно;
 *   • ссылку можно переслать и открыть заново — обновление страницы не
 *     обнуляет форму.
 *
 * ВСЁ, ЧТО ПРИШЛО ИЗ АДРЕСА, ПРОВЕРЯЕТСЯ. Это ввод, а не память: `?guests=999`
 * или `?date=вчера` не должны доехать до запроса доступности, тем более до
 * тела брони.
 */

export const BOOKING_PARAM = {
  date: "date",
  guests: "guests",
  slot: "slot",
  /** Идентификатор брони, которую гость меняет (кнопка «Изменить бронь» на
   * экране успеха). Присутствие параметра переключает экран в режим переноса:
   * создаётся не новая бронь, а `PATCH /bookings/:id`. */
  change: "change",
} as const;

export interface BookingIntent {
  /** «YYYY-MM-DD» или `null` — тогда экран подставит сегодняшний день ПОСЛЕ
   * гидратации: «сегодня» знает только браузер. */
  date: string | null;
  guests: number;
  /** `startsAt` слота дословно, как его отдал сервер, или `null`. */
  slot: string | null;
  /** Бронь, которую переносим, или `null` — обычное создание. */
  changeBookingId: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Начало RFC3339 со смещением заведения: «2026-08-25T19:30:00+05:00». Полную
 * грамматику здесь не разбираем — строка всё равно сверяется с живой выдачей
 * доступности, прежде чем попасть в тело брони. */
const SLOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
/** UUID сервера. Проверяем форму, а не существование: несуществующую бронь
 * отвергнет сервер, а вот мусор в пути запроса — наша забота. */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Путь страницы бронирования заведения. Одно место на весь сайт: разъедутся
 * — ссылка из карточки молча уведёт в 404. */
export function bookingPath(venueId: string): string {
  return `/venues/${encodeURIComponent(venueId)}/book`;
}

/** Путь страницы созданной брони («Бронь подтверждена»). */
export function bookingResultPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}`;
}

/**
 * Ссылка на бронирование с уже сделанным выбором.
 *
 * Пустые части в адрес НЕ пишутся: `?date=&slot=` — это три лишних символа и
 * ноль смысла, а заодно ссылка, которая выглядит по-разному при одинаковом
 * выборе.
 */
export function bookingHref(
  venueId: string,
  intent: Partial<BookingIntent> = {},
): string {
  const params = new URLSearchParams();
  if (intent.date && DATE_RE.test(intent.date)) params.set(BOOKING_PARAM.date, intent.date);
  if (typeof intent.guests === "number" && isKnownGuests(intent.guests)) {
    params.set(BOOKING_PARAM.guests, String(intent.guests));
  }
  if (intent.slot && SLOT_RE.test(intent.slot)) params.set(BOOKING_PARAM.slot, intent.slot);
  if (intent.changeBookingId && UUID_RE.test(intent.changeBookingId)) {
    params.set(BOOKING_PARAM.change, intent.changeBookingId);
  }
  const query = params.toString();
  return query ? `${bookingPath(venueId)}?${query}` : bookingPath(venueId);
}

/** Что из адреса пережило проверку. Не прошедшее молча становится `null` —
 * спорить с подделанной ссылкой не о чем, а падать на ней тем более незачем. */
export function readBookingIntent(params: URLSearchParams): BookingIntent {
  const date = params.get(BOOKING_PARAM.date);
  const guests = Number(params.get(BOOKING_PARAM.guests));
  const slot = params.get(BOOKING_PARAM.slot);
  const change = params.get(BOOKING_PARAM.change);
  return {
    date: date && DATE_RE.test(date) ? date : null,
    guests: isKnownGuests(guests) ? guests : DEFAULT_GUESTS,
    slot: slot && SLOT_RE.test(slot) ? slot : null,
    changeBookingId: change && UUID_RE.test(change) ? change : null,
  };
}

function isKnownGuests(value: number): boolean {
  return (GUEST_OPTIONS as readonly number[]).includes(value);
}
