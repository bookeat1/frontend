import type { DayOfWeek, ScheduleDay, VenueSchedule } from "./types";

/**
 * Чтение графика работы — ОБЩЕЕ для сайта и приложения (2026-09-03).
 *
 * ГЛАВНОЕ ПРАВИЛО: здесь НЕТ вычисления «открыто/закрыто». Открытость знает
 * только сервер (`VenueSchedule.openNow`, посчитанный в таймзоне заведения).
 * Этот модуль отвечает на другой вопрос: КАКОЙ СТРОКОЙ ГРАФИКА объясняется
 * текущее состояние, чтобы к серверному «открыто» дописать честное время
 * закрытия.
 *
 * Почему модуль общий: до него сайт и приложение держали две копии одной
 * логики, и обе после полуночи брали строку СЕГОДНЯШНЕГО календарного дня.
 * Заведение с субботней сменой «до 02:00» в воскресенье 01:00 печатало
 * «Открыто до 23:00» (воскресное закрытие), а при воскресном выходном —
 * «Открыто сейчас» рядом с «Сегодня выходной» (ревью PR #119, п. 1.1).
 * Ночные заведения — это пятница и суббота, самый трафик; чинить в двух
 * местах по-разному нельзя, поэтому правило живёт здесь, а словари — у
 * каждой платформы свои.
 */

const WEEKDAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * День недели (0 = вс, как у сервера) В ТАЙМЗОНЕ ЗАВЕДЕНИЯ.
 *
 * `Intl` с `timeZone` — единственный способ разрешить IANA-зону; на сборке
 * Hermes без полного ICU он может отсутствовать или бросить, поэтому вызов
 * защищён, а запасной вариант — день устройства/браузера.
 */
export function venueDayOfWeek(timezone: string, now: Date = new Date()): DayOfWeek {
  if (timezone) {
    try {
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
      const index = WEEKDAY_INDEX.indexOf(weekday);
      if (index >= 0) return index as DayOfWeek;
    } catch {
      // Зона неизвестна движку — падать из-за подсветки строки нельзя.
    }
  }
  return now.getDay() as DayOfWeek;
}

/**
 * Текущее время «ЧЧ:ММ» В ТАЙМЗОНЕ ЗАВЕДЕНИЯ либо `null`, когда движок зону
 * не знает или зона не задана.
 *
 * Это НЕ вычисление открытости. Часы нужны ровно для двух решений: сегодняшнее
 * открытие ещё впереди («Откроется в 10:00») и вчерашняя смена за полночь ещё
 * идёт (тогда время закрытия берётся из неё).
 *
 * Сравнение «ЧЧ:ММ» строками честно только с ВЕДУЩИМ НУЛЁМ: его гарантирует
 * `clockTime` в http-mapping и нормализация здесь.
 */
export function venueClock(timezone: string, now: Date = new Date()): string | null {
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

/** День из графика или `undefined` — «сервер про этот день не сказал». */
export function scheduleDayFor(
  schedule: VenueSchedule | null,
  dayOfWeek: DayOfWeek,
): ScheduleDay | undefined {
  return schedule?.days.find((day) => day.dayOfWeek === dayOfWeek);
}

/**
 * Круглосуточный день: открытие и закрытие совпадают, и закрытие «на
 * следующий день». Сервер кодирует 24/7 как «00:00–24:00»; `clockTime`
 * нормализует «24:00» в «00:00», поэтому без этой ветки гость читал бы
 * «Открыто до 00:00» и «с 00:00 до 00:00» (ревью PR #119, п. 1.2).
 *
 * Как именно бэкенд кодирует «24/7», из репозитория не видно — полночь-в-полночь
 * единственное представление, которое проходит через `clockTime`.
 */
export function isAroundTheClock(day: ScheduleDay | null | undefined): boolean {
  return Boolean(day?.isOpen && day.opensAt && day.closesAt && day.opensAt === day.closesAt && day.closesNextDay);
}

/** Строка графика, объясняющая текущее состояние, и чья она — сегодняшняя или вчерашняя. */
export interface ActiveScheduleDay {
  day: ScheduleDay;
  /** true — это вчерашняя строка с `closesNextDay`, смена ещё идёт. */
  fromYesterday: boolean;
}

/**
 * Строка графика, которой объясняется состояние заведения СЕЙЧАС.
 *
 * Обычно — сегодняшняя. Но если по часам заведения сегодняшнее открытие ещё
 * впереди (или сегодня выходной, или строки на сегодня нет), а вчерашняя
 * строка закрывается «на следующий день» и её `closesAt` ещё не наступил, —
 * это вчерашняя смена, и объяснять надо ею: «Открыто до 02:00», а не
 * «до 23:00» из воскресной строки.
 *
 * Возвращает `undefined`, когда ни сегодняшней, ни подходящей вчерашней
 * строки нет: сервер про этот день не сказал.
 *
 * Открытость по-прежнему НЕ выводится из результата: если сервер сказал
 * «закрыто», а вчерашняя строка ещё «идёт», прав сервер (переучёт, праздник,
 * ручное закрытие).
 */
export function activeScheduleDay(
  schedule: VenueSchedule | null,
  now: Date = new Date(),
): ActiveScheduleDay | undefined {
  if (!schedule) return undefined;
  const today = venueDayOfWeek(schedule.timezone, now);
  const clock = venueClock(schedule.timezone, now);
  const todayRow = scheduleDayFor(schedule, today);

  const beforeTodayOpening =
    !todayRow?.isOpen || !todayRow.opensAt || (clock !== null && clock < todayRow.opensAt);
  if (beforeTodayOpening) {
    const yesterday = scheduleDayFor(schedule, ((today + 6) % 7) as DayOfWeek);
    if (
      yesterday?.isOpen &&
      yesterday.closesNextDay &&
      yesterday.closesAt &&
      clock !== null &&
      // Круглосуточный вчерашний день закрывается в «00:00» следующего дня —
      // к этому моменту он уже кончился, и `clock < "00:00"` ложно всегда.
      clock < yesterday.closesAt
    ) {
      return { day: yesterday, fromYesterday: true };
    }
  }
  return todayRow ? { day: todayRow, fromYesterday: false } : undefined;
}
