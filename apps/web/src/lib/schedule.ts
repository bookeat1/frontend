import type { ScheduleDay, VenueSchedule } from "@bookeat/api/client";
import {
  WEEK_ORDER_MONDAY_FIRST,
  activeScheduleDay,
  isAroundTheClock,
  scheduleDayFor,
  venueClock,
  venueDayOfWeek,
} from "@bookeat/api/client";
import type { Dictionary } from "@bookeat/i18n";

/**
 * Чтение графика работы заведения для сайта.
 *
 * ГЛАВНОЕ ПРАВИЛО: здесь НЕТ вычисления «открыто/закрыто». Открытость знает
 * только сервер (`schedule.openNow`, посчитанный в таймзоне заведения). Этот
 * файл лишь дописывает к серверному ответу время из АКТИВНОЙ строки графика
 * — «Открыто до 23:00» (макет 3525:14586) и «Ежедневно с 10:00 до 23:00»
 * (макет 3525:14723).
 *
 * Какая строка активна (сегодняшняя или вчерашняя смена за полночь), решает
 * `activeScheduleDay` из `@bookeat/api` — ОБЩИЙ с мобильным приложением
 * модуль, чтобы сайт и приложение не спорили о времени на ночных заведениях.
 * Здесь остаётся только выбор слов из словаря сайта.
 */

export type OpenState = "open" | "closed" | "unknown";

export function openState(schedule: VenueSchedule | null): OpenState {
  if (!schedule || schedule.openNow === null) return "unknown";
  return schedule.openNow ? "open" : "closed";
}

export { venueClock, venueDayOfWeek };

/** Сегодняшняя строка графика или `undefined` — «сервер про этот день не сказал». */
export function todaySchedule(schedule: VenueSchedule | null, now: Date = new Date()): ScheduleDay | undefined {
  if (!schedule) return undefined;
  return scheduleDayFor(schedule, venueDayOfWeek(schedule.timezone, now));
}

export interface ScheduleStatus {
  label: string;
  tone: "success" | "neutral";
}

/**
 * Ярлык в шапке заведения.
 *
 * «Открыто до 23:00» — серверное «открыто» + время закрытия АКТИВНОЙ строки:
 * в воскресенье 01:00 при субботней смене «до 02:00» это «до 02:00», а не
 * воскресное закрытие. «Открыто круглосуточно» — активная строка 24 часа.
 * «Открыто сейчас» — сервер сказал «открыто», а времени нет.
 * «Откроется в 10:00» — сервер сказал «закрыто», сегодняшнее открытие ещё
 * впереди по часам заведения. Позже него — «Сейчас закрыто»: «завтра» мы
 * гостю не обещаем. Без графика — «Часы работы не указаны».
 */
export function scheduleStatus(
  schedule: VenueSchedule | null,
  t: Dictionary,
  now: Date = new Date(),
): ScheduleStatus {
  const state = openState(schedule);
  if (state === "unknown" || !schedule) {
    return { label: t.web.venue.status.unknown, tone: "neutral" };
  }
  if (state === "open") {
    const active = activeScheduleDay(schedule, now)?.day;
    if (isAroundTheClock(active)) return { label: t.web.venue.status.aroundTheClock, tone: "success" };
    return {
      label: active?.isOpen && active.closesAt ? t.web.venue.status.openUntil(active.closesAt) : t.web.venue.status.open,
      tone: "success",
    };
  }
  // Закрыто: «Откроется в …» только про СЕГОДНЯШНЮЮ строку. Если сервер
  // сказал «закрыто», пока вчерашняя смена по графику ещё идёт, прав сервер.
  const day = todaySchedule(schedule, now);
  const clock = venueClock(schedule.timezone, now);
  if (day?.isOpen && day.opensAt && clock && clock < day.opensAt) {
    return { label: t.web.venue.status.opensAt(day.opensAt), tone: "neutral" };
  }
  return { label: t.web.venue.status.closed, tone: "neutral" };
}

/**
 * Одно окно на все семь дней («Ежедневно с 10:00 до 23:00») либо `null`, когда
 * часы разнятся, какой-то день выходной или про него ничего не известно.
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
  return allSame ? { opensAt: first.opensAt, closesAt: first.closesAt, closesNextDay: first.closesNextDay } : null;
}

/**
 * Подпись под телефоном (узел 3525:14723). В макете одна строка —
 * «Ежедневно с 10:00 до 23:00»; когда график не одинаков по дням, пишем окно
 * АКТИВНОЙ строки — той же, что объясняет чип, иначе чип и подпись разойдутся:
 *   - сегодняшняя строка → «Сегодня с 12:00 до 23:00» / «Сегодня выходной»;
 *   - вчерашняя смена ещё идёт → «Сегодня до 02:00» (про сегодняшний график
 *     не говорим — он ещё не начался, а «выходной» рядом с «открыто» — ложь);
 *   - круглосуточно → «Круглосуточно».
 * `null` — сказать нечего, и подпись возвращается к слову «Телефон».
 */
export function phoneHoursNote(
  schedule: VenueSchedule | null,
  t: Dictionary,
  now: Date = new Date(),
): string | null {
  const daily = uniformDailyHours(schedule);
  if (daily) {
    return isAroundTheClock({ dayOfWeek: 0, isOpen: true, ...daily })
      ? t.web.venue.contacts.aroundTheClock
      : t.web.venue.contacts.daily(daily.opensAt, daily.closesAt);
  }
  const active = activeScheduleDay(schedule, now);
  if (!active) return null;
  const { day, fromYesterday } = active;
  if (!day.isOpen) return t.web.venue.contacts.todayDayOff;
  if (!day.opensAt || !day.closesAt) return null;
  if (isAroundTheClock(day)) return t.web.venue.contacts.aroundTheClock;
  if (fromYesterday) return t.web.venue.contacts.todayUntil(day.closesAt);
  return t.web.venue.contacts.today(day.opensAt, day.closesAt);
}
