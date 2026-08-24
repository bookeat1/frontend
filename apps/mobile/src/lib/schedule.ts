import type { DayOfWeek, ScheduleDay, VenueSchedule } from "@bookeat/api";
import { WEEK_ORDER_MONDAY_FIRST } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";

const t = getDictionary();

/**
 * Чтение графика работы заведения.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: здесь НЕТ и не может быть вычисления
 * «открыто/закрыто». Открытость знает только сервер (`schedule.openNow`,
 * посчитанный в таймзоне заведения); клиент, считавший её из первого и
 * последнего времени в свободнотекстовой строке и часов устройства, — это и
 * есть тот баг, который эта задача убирает.
 *
 * Всё, что тут делается с датами, — определение того, какой сегодня ДЕНЬ
 * НЕДЕЛИ у заведения, чтобы подсветить нужную строку недели. Ошибка в этом
 * месте стоит подсветки не той строки, а не вранья про «открыто».
 */

/** Статус заведения «прямо сейчас» — ровно три возможных состояния. */
export type OpenState = "open" | "closed" | "unknown";

export function openState(schedule: VenueSchedule | null): OpenState {
  if (!schedule || schedule.openNow === null) return "unknown";
  return schedule.openNow ? "open" : "closed";
}

export function openStateLabel(schedule: VenueSchedule | null): string {
  switch (openState(schedule)) {
    case "open":
      return t.restaurant.openNow;
    case "closed":
      return t.restaurant.closedNow;
    case "unknown":
      return t.restaurant.hoursUnknownShort;
  }
}

/**
 * День недели (0 = вс, как у сервера) В ТАЙМЗОНЕ ЗАВЕДЕНИЯ.
 *
 * `Intl` с `timeZone` — единственный способ разрешить IANA-зону; на сборке
 * Hermes без полного ICU он может отсутствовать или бросить, поэтому вызов
 * защищён, а запасной вариант — день устройства. Для гостя в Алматы и
 * заведения в Алматы это одно и то же; расхождение возможно только у
 * заведения в другой зоне (в каталоге такое поддержано на бэкенде).
 */
export function venueDayOfWeek(timezone: string, now: Date = new Date()): DayOfWeek {
  if (timezone) {
    try {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
      }).format(now);
      const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
      if (index >= 0) return index as DayOfWeek;
    } catch {
      // Зона неизвестна движку — падать из-за подсветки строки нельзя.
    }
  }
  return now.getDay() as DayOfWeek;
}

/** true, когда заведение живёт в другом часовом поясе, чем телефон гостя, —
 * тогда под графиком имеет смысл написать, что время местное. */
export function isForeignTimezone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    const deviceZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return Boolean(deviceZone) && deviceZone !== timezone;
  } catch {
    return false;
  }
}

/** День из графика или `undefined` — «сервер про этот день не сказал». */
export function scheduleDayFor(
  schedule: VenueSchedule | null,
  dayOfWeek: DayOfWeek,
): ScheduleDay | undefined {
  return schedule?.days.find((day) => day.dayOfWeek === dayOfWeek);
}

/**
 * Строка часов одного дня.
 *
 * Случай «закрывается на следующий день» РАЗЛИЧАЕТСЯ здесь по-прежнему: у него
 * своя строка словаря (`rangeNextDay`) и своя ветка для закрытия ровно в
 * полночь. С 2026-08-24 из русского словаря убраны обе словесные приписки —
 * и «следующего дня», и «(полночь)», — в графике остаются только часы. Решение
 * о том, какая это строка, осталось в коде: вернуть слова можно правкой
 * словаря, не трогая логику перехода через полночь.
 */
export function dayHoursLabel(day: ScheduleDay | undefined): string {
  if (!day) return t.restaurant.schedule.unknownDay;
  if (!day.isOpen) return t.restaurant.schedule.dayOff;
  if (!day.opensAt || !day.closesAt) return t.restaurant.schedule.openTimeUnknown;
  if (!day.closesNextDay) return t.restaurant.schedule.range(day.opensAt, day.closesAt);
  if (day.closesAt === "00:00") return t.restaurant.schedule.untilMidnight(day.opensAt);
  return t.restaurant.schedule.rangeNextDay(day.opensAt, day.closesAt);
}

/** Есть ли в графике хоть один день, про который сервер что-то сказал. */
export function hasKnownDays(schedule: VenueSchedule | null): boolean {
  return (schedule?.days.length ?? 0) > 0;
}

/**
 * Статус для компактного блока часов: серверное «Открыто» + время закрытия
 * СЕГОДНЯ («Открыто до 23:00») и серверное «Закрыто» + время открытия
 * СЕГОДНЯ («Откроется в 10:00», правка владельца 2026-08-24).
 *
 * Открытость по-прежнему берётся ТОЛЬКО из `openNow` — эта функция ничего не
 * вычисляет об открытости, а лишь дописывает к уже известному ответу сервера
 * время из сегодняшней строки графика.
 *
 * «Откроется в» ставится строго при трёх условиях сразу: сервер сказал
 * «закрыто», у СЕГОДНЯШНЕГО дня есть время открытия, и это время ещё впереди
 * по часам заведения. Закрытое поздним вечером заведение получает голое
 * «Закрыто»: «Откроется в 10:00» без слова «завтра» в 23:00 — обещание не про
 * тот день, а слова «завтра» в словаре нет.
 */
export function openUntilTodayLabel(
  schedule: VenueSchedule | null,
  now: Date = new Date(),
): string {
  if (!schedule) return openStateLabel(schedule);
  const day = scheduleDayFor(schedule, venueDayOfWeek(schedule.timezone, now));

  if (openState(schedule) === "open") {
    if (day?.isOpen && day.closesAt) {
      return t.restaurant.openUntil(day.closesAt);
    }
    return openStateLabel(schedule);
  }

  if (openState(schedule) === "closed") {
    // Сравнение строк "ЧЧ:ММ" честно только при ВЕДУЩЕМ НУЛЕ: "9:00" < "10:00"
    // лексикографически ложно. Ведущий ноль гарантирует `clockTime`
    // (packages/api/src/http-mapping.ts), и `venueClock` ниже нормализует
    // ответ движка тем же образом.
    const clock = venueClock(schedule.timezone, now);
    if (day?.isOpen && day.opensAt && clock && clock < day.opensAt) {
      return t.restaurant.opensAt(day.opensAt);
    }
  }

  return openStateLabel(schedule);
}

/**
 * Текущее время «ЧЧ:ММ» В ТАЙМЗОНЕ ЗАВЕДЕНИЯ, либо `null`, когда движок зону
 * не знает.
 *
 * Это НЕ вычисление открытости — открытость по-прежнему приходит только из
 * `openNow`. Часы нужны ровно для одного решения: сегодняшнее время открытия
 * ещё впереди (тогда закрытому заведению можно дописать «Откроется в 10:00»)
 * или уже позади (тогда остаётся голое «Закрыто», потому что «завтра» мы
 * гостю не обещали).
 */
function venueClock(timezone: string, now: Date): string | null {
  if (!timezone) return null;
  try {
    const value = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    // Часть движков печатает полночь как «24:00» — это тот же ноль часов.
    const normalized = value.startsWith("24:") ? `00:${value.slice(3)}` : value;
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/**
 * Когда все семь дней недели рабочие и с одинаковым окном — возвращает это окно,
 * иначе `null`. Дизайн показывает такой график одной строкой «Ежедневно с 10:00
 * до 23:00»; если часы разнятся (или какой-то день неизвестен/выходной), вызов
 * возвращает `null`, и экран рисует разбивку по дням.
 */
export function uniformDailyHours(
  schedule: VenueSchedule | null,
): { opensAt: string; closesAt: string; closesNextDay: boolean } | null {
  if (!schedule) return null;
  const days = WEEK_ORDER_MONDAY_FIRST.map((dayOfWeek) => scheduleDayFor(schedule, dayOfWeek));
  const first = days[0];
  if (!first || !first.isOpen || !first.opensAt || !first.closesAt) return null;
  const allSame = days.every(
    (day) =>
      day?.isOpen &&
      day.opensAt === first.opensAt &&
      day.closesAt === first.closesAt &&
      day.closesNextDay === first.closesNextDay,
  );
  if (!allSame) return null;
  return {
    opensAt: first.opensAt,
    closesAt: first.closesAt,
    closesNextDay: first.closesNextDay,
  };
}
