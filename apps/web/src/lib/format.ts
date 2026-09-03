import type { Dictionary } from "@bookeat/i18n";
import type { PriceLevel, PriceRange, RestaurantSummary, VenueSchedule } from "@bookeat/api/client";

import type { WebLocale } from "@web/lib/locale";

/** BCP-47 тег для Intl. Словарь и `Accept-Language` пользуются короткими
 * кодами, а форматирование дат и чисел требует полного тега. */
export const INTL_TAG: Record<WebLocale, string> = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
};

/**
 * Строка под названием заведения: «Кухня · ₸₸₸ · адрес».
 *
 * Собирается ТОЛЬКО из того, что действительно пришло: у заведения может не
 * быть ни кухни, ни адреса, и «Кухня ·  · » с дырами читается как поломка
 * вёрстки. Расстояния («1,2 км») в макете есть, а в API — нет: геолокацию
 * сайт не спрашивает и координаты гостя не знает, поэтому этой части в строке
 * нет вовсе, а не «0 км».
 */
export function venueMeta(
  venue: Pick<RestaurantSummary, "cuisines" | "priceLevel" | "priceRange" | "address">,
  t: Dictionary,
  options: { withAddress?: boolean } = {},
): string {
  const parts: string[] = [];
  const cuisines = venue.cuisines.map((cuisine) => cuisine.name).filter(Boolean);
  if (cuisines.length > 0) parts.push(cuisines.join(", "));
  const price = priceLabel(venue.priceLevel, venue.priceRange, t);
  if (price) parts.push(price);
  if (options.withAddress !== false && venue.address.trim()) parts.push(venue.address.trim());
  return parts.join(t.web.format.metaSeparator);
}

/** Числовой диапазон среднего чека, если он есть; иначе символьная ступень. */
export function priceLabel(
  level: PriceLevel | undefined,
  range: PriceRange | undefined,
  t: Dictionary,
): string {
  if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
    return t.web.format.priceRange(formatNumber(range.min), formatNumber(range.max));
  }
  return level ?? "";
}

/** Разряды неразрывным пробелом — «8 990», как в макете. */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** «Открыто сейчас» / «Сейчас закрыто» / «Часы работы не указаны».
 * Считает СЕРВЕР: клиент не выводит статус из часов открытия (см. VenueSchedule). */
export function scheduleStatus(schedule: VenueSchedule | null, t: Dictionary) {
  if (!schedule || schedule.openNow === null) {
    return { label: t.web.venue.status.unknown, tone: "neutral" as const };
  }
  return schedule.openNow
    ? { label: t.web.venue.status.open, tone: "success" as const }
    : { label: t.web.venue.status.closed, tone: "neutral" as const };
}

/** «18» и «МАЯ» для плашки на карточке события (узел 3253:2 → «Card / Event»). */
export function eventDateParts(startsAt: string, locale: WebLocale) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat(INTL_TAG[locale], { month: "short" })
      .format(date)
      .replace(/\.$/, "")
      .toUpperCase(),
    time: new Intl.DateTimeFormat(INTL_TAG[locale], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  };
}

/**
 * Подпись выбранной даты в панели поиска — «Сегодня, 25 авг» / «6 сент»
 * (макет 3253:41, узел «Field / Дата»).
 *
 * Нативное `<input type="date">` рисует значение в формате ОС и браузера, а
 * не страницы: на русской странице в англоязычном Chrome это `mm/dd/yyyy`.
 * Изменить это нельзя ни атрибутом `lang`, ни `Intl` — поэтому значение
 * рисуем сами поверх поля, а само поле остаётся нативным ради календаря и
 * клавиатуры.
 *
 * @param today «YYYY-MM-DD» сегодняшнего дня; передавать его надо ТОЛЬКО
 * после гидратации (см. SearchPanel): на сервере часовой пояс другой, и
 * «Сегодня», посчитанное в разметке, разошлось бы с браузерным.
 */
export function searchDateLabel(
  iso: string,
  locale: WebLocale,
  t: Dictionary,
  today?: string | null,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  // UTC-полночь и `timeZone: "UTC"` в форматтере: иначе дата, разобранная в
  // поясе браузера, при печати в другом поясе съезжает на сутки.
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  const dayMonth = new Intl.DateTimeFormat(INTL_TAG[locale], {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    // «25 авг.» → «25 авг»: точка в макете не нарисована, а Intl её ставит.
    .replace(/\.$/, "");
  return iso.trim() === today ? t.web.format.dateToday(dayMonth) : dayMonth;
}

/** «YYYY-MM-DD» сегодняшнего дня — значение по умолчанию для поля даты. */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * «HH:MM» текущего времени в поясе браузера — значение по умолчанию для поля
 * времени в панели поиска (замечание владельца 31.08.2026: поле не должно быть
 * пустым).
 *
 * Время НЕ округляется до получаса, хотя в макете (3253:47) нарисовано «19:30».
 * Округление — это правило, которого в макете нет: 19:30 там просто пример
 * заполненного поля. `timeFrom` уходит на сервер как НАЧАЛО окна поиска, и
 * «с 19:07» — корректный запрос. Если владелец захочет шаг в полчаса, это
 * одна строка здесь, а не переделка панели.
 *
 * Считать это на сервере нельзя по той же причине, что и «сегодня»: у сервера
 * свой часовой пояс, и разметка разошлась бы с браузером (ошибка гидратации).
 * Значение подставляется эффектом ПОСЛЕ гидратации — см. SearchPanel.
 */
export function nowTimeHhMm(now: Date = new Date()): string {
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * «25 августа» — подпись выбранной даты в карточке брони (узлы 3525:14739 и
 * 3525:14770 файла QovvuAoI9YxsLMwWkfgKN8).
 *
 * Месяц ПОЛНЫЙ и в родительном падеже, а не сокращённый, как в панели поиска:
 * там ячейка 190 широкая и подпись делит её с датой, здесь строка стоит одна.
 * Обе печатаются `Intl`, склонение — его забота, а не наша.
 *
 * Тот же приём с UTC-полуночью, что и в `searchDateLabel`: дата без времени,
 * разобранная в поясе браузера, при печати в другом поясе съезжает на сутки.
 */
export type BookingDateStyle =
  /** «25 августа» — подпись даты в карточке брони. */
  | "dayMonth"
  /** «Вторник, 25 августа» — строка даты на странице бронирования
   * (узел 3525:14826). */
  | "weekdayLong"
  /** «Вт, 25 августа» — строка сводки (узел 3525:14950). */
  | "weekdayShort"
  /** «Вт, 25 авг» — ячейка билета (узел 3525:15036). */
  | "weekdayCompact";

const DATE_STYLE_OPTIONS: Record<BookingDateStyle, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: "numeric", month: "long" },
  weekdayLong: { weekday: "long", day: "numeric", month: "long" },
  weekdayShort: { weekday: "short", day: "numeric", month: "long" },
  weekdayCompact: { weekday: "short", day: "numeric", month: "short" },
};

export function bookingDateLabel(
  iso: string,
  locale: WebLocale,
  style: BookingDateStyle = "dayMonth",
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  const text = new Intl.DateTimeFormat(INTL_TAG[locale], {
    ...DATE_STYLE_OPTIONS[style],
    timeZone: "UTC",
  })
    .format(date)
    // «25 авг.» → «25 авг»: точку в макете не рисуют, а Intl её ставит.
    .replace(/\.$/, "");
  // Русский Intl печатает день недели со строчной («вторник, 25 августа»), а
  // в макете он с прописной. Регистр меняем по правилам ЯЗЫКА, а не ASCII:
  // «i» в турецком становится «İ», и `toUpperCase()` без локали это ломает.
  return capitalize(text, locale);
}

function capitalize(text: string, locale: WebLocale): string {
  if (!text) return text;
  return text[0].toLocaleUpperCase(INTL_TAG[locale]) + text.slice(1);
}

/**
 * Запасная зона заведения, когда сервер её не назвал.
 *
 * То же значение и та же причина, что в маппере доступности
 * (`packages/api/src/http-mapping.ts`: `text(api.timezone) || "Asia/Almaty"`):
 * весь каталог сегодня казахстанский, и «зона неизвестна» на практике значит
 * «поле не приехало», а не «заведение в другом поясе».
 */
export const VENUE_TIMEZONE_FALLBACK = "Asia/Almaty";

/**
 * Момент времени — в СТЕННЫХ ЧАСАХ ЗАВЕДЕНИЯ.
 *
 * Зачем вообще: `Booking.startsAt` приходит в UTC («RFC3339 UTC as stored by
 * the backend»), а гостю надо показать то время, на которое его ждут за
 * столом. Печать через `new Date(...)` без зоны перевела бы момент в пояс
 * БРАУЗЕРА, и гость, открывший ссылку из Берлина, увидел бы 16:30 у брони,
 * которую ресторан называет 19:30. На телефоне такого не бывает (устройство
 * стоит в том же поясе), а сайт открывают откуда угодно.
 *
 * Зону берём с заведения (`Restaurant.schedule.timezone` — это IANA-строка
 * сервера, которой он же считал `open_now`). Битую или пустую подменяем
 * запасной: `Intl` на неизвестной зоне БРОСАЕТ, и один кривой ответ сервера
 * иначе уронил бы страницу целиком.
 *
 * `null` — момент не разобрали; вызывающий обязан не печатать «Invalid Date».
 */
export function venueWallClock(
  iso: string,
  timeZone: string | null | undefined,
): { date: string; time: string } | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const zone = (timeZone ?? "").trim();
  return (zone ? partsIn(instant, zone) : null) ?? partsIn(instant, VENUE_TIMEZONE_FALLBACK);
}

function partsIn(instant: Date, timeZone: string): { date: string; time: string } | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      // `hour12: false` в некоторых движках даёт «24:00» вместо «00:00»;
      // `h23` — единственная запись, у которой полночь это ноль.
      hourCycle: "h23",
    }).formatToParts(instant);
  } catch {
    // Неизвестная зона — `Intl` бросает RangeError.
    return null;
  }
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const [year, month, day, hour, minute] = [
    at("year"),
    at("month"),
    at("day"),
    at("hour"),
    at("minute"),
  ];
  if (!year || !month || !day || !hour || !minute) return null;
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

/**
 * «19:30» из `AvailabilitySlot.startsAt`.
 *
 * ЧАСЫ БЕРУТСЯ ИЗ САМОЙ СТРОКИ, а не из `new Date(...)`. Слот приходит как
 * RFC3339 со смещением ЗАВЕДЕНИЯ («2026-08-25T19:30:00+05:00»), и это стенные
 * часы ресторана — то время, на которое гостя ждут за столом. `Date` перевёл
 * бы его в пояс браузера, и гость из Берлина увидел бы 16:30 у слота, который
 * ресторан называет 19:30. На телефоне такого не бывает (устройство стоит в
 * том же поясе), а сайт открывают откуда угодно.
 *
 * Пустая строка — «время не разобрали»: вызывающий не должен печатать
 * «Invalid Date» на кнопке.
 */
export function slotTimeLabel(startsAt: string): string {
  const match = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(startsAt.trim());
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

/**
 * Календарный день слота в поясе ЗАВЕДЕНИЯ — «YYYY-MM-DD» из той же строки и
 * по той же причине, что и `slotTimeLabel`.
 */
export function slotDateIso(startsAt: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(startsAt.trim());
  return match ? match[1] : null;
}
