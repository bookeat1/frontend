import type { DayOfWeek, ScheduleDay, VenueSchedule } from "@bookeat/api/client";
import { WEEK_ORDER_MONDAY_FIRST } from "@bookeat/api/client";
import type { Dictionary } from "@bookeat/i18n";

/**
 * Чтение графика работы заведения для сайта.
 *
 * ГЛАВНОЕ ПРАВИЛО: здесь НЕТ вычисления «открыто/закрыто». Открытость знает
 * только сервер (`schedule.openNow`, посчитанный в таймзоне заведения). Этот
 * файл лишь дописывает к серверному ответу время из СЕГОДНЯШНЕЙ строки
 * графика — «Открыто до 23:00» (макет 3525:14586) и «Ежедневно с 10:00 до
 * 23:00» (макет 3525:14723).
 *
 * Правила повторяют apps/mobile/src/lib/schedule.ts, чтобы сайт и приложение
 * не спорили о времени. Общего пакета у них пока нет — это долг, а не
 * решение: мобильная версия завязана на свой словарь-синглтон.
 */

export type OpenState = "open" | "closed" | "unknown";

export function openState(schedule: VenueSchedule | null): OpenState {
  if (!schedule || schedule.openNow === null) return "unknown";
  return schedule.openNow ? "open" : "closed";
}

const WEEKDAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * День недели (0 = вс, как у сервера) В ТАЙМЗОНЕ ЗАВЕДЕНИЯ. Неизвестная
 * движку зона не роняет страницу: запасной вариант — день браузера.
 */
export function venueDayOfWeek(timezone: string, now: Date = new Date()): DayOfWeek {
  if (timezone) {
    try {
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
      const index = WEEKDAY_INDEX.indexOf(weekday);
      if (index >= 0) return index as DayOfWeek;
    } catch {
      // Зона неизвестна движку — берём день браузера.
    }
  }
  return now.getDay() as DayOfWeek;
}

/**
 * Текущее время «ЧЧ:ММ» в таймзоне заведения либо `null`, когда движок зону
 * не знает. Нужно ровно для одного решения: сегодняшнее открытие ещё впереди
 * («Откроется в 10:00») или уже позади (голое «Сейчас закрыто»).
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

/** Сегодняшняя строка графика или `undefined` — «сервер про этот день не сказал». */
export function todaySchedule(schedule: VenueSchedule | null, now: Date = new Date()): ScheduleDay | undefined {
  if (!schedule) return undefined;
  const today = venueDayOfWeek(schedule.timezone, now);
  return schedule.days.find((day) => day.dayOfWeek === today);
}

export interface ScheduleStatus {
  label: string;
  tone: "success" | "neutral";
}

/**
 * Ярлык в шапке заведения.
 *
 * «Открыто до 23:00» — серверное «открыто» + время закрытия сегодня.
 * «Открыто сейчас» — сервер сказал «открыто», а времени на сегодня нет.
 * «Откроется в 10:00» — сервер сказал «закрыто», сегодняшнее открытие ещё
 * впереди по часам заведения. Позже него — «Сейчас закрыто»: «завтра» мы
 * гостю не обещаем. Без графика — «Часы работы не указаны».
 *
 * Сравнение «ЧЧ:ММ» строками честно только с ведущим нулём; его гарантирует
 * `clockTime` в packages/api и `venueClock` выше.
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
  const day = todaySchedule(schedule, now);
  if (state === "open") {
    return {
      label: day?.isOpen && day.closesAt ? t.web.venue.status.openUntil(day.closesAt) : t.web.venue.status.open,
      tone: "success",
    };
  }
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
): { opensAt: string; closesAt: string } | null {
  if (!schedule) return null;
  const days = WEEK_ORDER_MONDAY_FIRST.map((dayOfWeek) =>
    schedule.days.find((day) => day.dayOfWeek === dayOfWeek),
  );
  const first = days[0];
  if (!first || !first.isOpen || !first.opensAt || !first.closesAt) return null;
  const allSame = days.every(
    (day) =>
      day?.isOpen &&
      day.opensAt === first.opensAt &&
      day.closesAt === first.closesAt &&
      day.closesNextDay === first.closesNextDay,
  );
  return allSame ? { opensAt: first.opensAt, closesAt: first.closesAt } : null;
}

/**
 * Подпись под телефоном (узел 3525:14723). В макете одна строка —
 * «Ежедневно с 10:00 до 23:00»; когда график не одинаков по дням, пишем окно
 * сегодняшнего дня или «Сегодня выходной». `null` — сказать нечего, и подпись
 * возвращается к слову «Телефон».
 */
export function phoneHoursNote(
  schedule: VenueSchedule | null,
  t: Dictionary,
  now: Date = new Date(),
): string | null {
  const daily = uniformDailyHours(schedule);
  if (daily) return t.web.venue.contacts.daily(daily.opensAt, daily.closesAt);
  const day = todaySchedule(schedule, now);
  if (!day) return null;
  if (!day.isOpen) return t.web.venue.contacts.todayDayOff;
  if (day.opensAt && day.closesAt) return t.web.venue.contacts.today(day.opensAt, day.closesAt);
  return null;
}
