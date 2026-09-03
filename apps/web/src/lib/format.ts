import type { Dictionary } from "@bookeat/i18n";
import type { PriceLevel, PriceRange, RestaurantSummary } from "@bookeat/api/client";

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

/**
 * «flourdemi.kz» из `https://www.instagram.com/flourdemi.kz/` — заголовок
 * плашки соцсетей (узел 3525:14728) показывает имя аккаунта, а не адрес.
 * Ссылка без пути (или не разбираемая) отдаёт `null`, и заголовком остаётся
 * сама ссылка — молча резать её до пустой строки нельзя.
 */
export function instagramHandle(url: string): string | null {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean);
    return path[0] ? decodeURIComponent(path[0]) : null;
  } catch {
    return null;
  }
}

/** «dastarkhan.kz» из `https://www.dastarkhan.kz/menu` — для плашки без Instagram. */
export function websiteHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
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
export function bookingDateLabel(iso: string, locale: WebLocale): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
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
