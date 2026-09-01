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
