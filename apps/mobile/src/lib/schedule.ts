import type { DayOfWeek, ScheduleDay, VenueSchedule } from "@bookeat/api";
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
 * `closesNextDay` — не украшение: «12:00 – 01:00» без него читается как «час
 * работы», а на деле это тринадцать часов. Закрытие ровно в полночь пишем
 * словами: «19:00 – 00:00 следующего дня» — калька, «до полуночи» — по-русски.
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
