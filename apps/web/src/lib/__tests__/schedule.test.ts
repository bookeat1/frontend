import { describe, expect, it } from "vitest";
import { getDictionary } from "@bookeat/i18n";
import type { ScheduleDay, VenueSchedule } from "@bookeat/api/client";

import { phoneHoursNote, scheduleStatus, uniformDailyHours } from "@web/lib/schedule";

const t = getDictionary("ru");

/** Понедельник, 10:00 по Алматы (UTC+5). */
const MONDAY_MORNING = new Date("2026-08-31T05:00:00Z");
/** Понедельник, 23:30 по Алматы. */
const MONDAY_NIGHT = new Date("2026-08-31T18:30:00Z");

function day(dayOfWeek: ScheduleDay["dayOfWeek"], overrides: Partial<ScheduleDay> = {}): ScheduleDay {
  return { dayOfWeek, isOpen: true, opensAt: "12:00", closesAt: "23:00", closesNextDay: false, ...overrides };
}

function everyDay(overrides: Partial<ScheduleDay> = {}, openNow: boolean | null = true): VenueSchedule {
  return {
    timezone: "Asia/Almaty",
    openNow,
    days: ([0, 1, 2, 3, 4, 5, 6] as const).map((d) => day(d, overrides)),
  };
}

/**
 * Ярлык шапки. Открытость здесь НИКОГДА не считается из часов: она приходит
 * из `openNow`, а функция лишь дописывает к ней время сегодняшней строки.
 */
describe("scheduleStatus", () => {
  it("без графика — «часы не указаны»", () => {
    expect(scheduleStatus(null, t, MONDAY_MORNING)).toEqual({
      label: "Часы работы не указаны",
      tone: "neutral",
    });
  });

  it("сервер не сказал про открытость — тоже «не указаны», даже с днями", () => {
    expect(scheduleStatus(everyDay({}, null), t, MONDAY_MORNING).label).toBe("Часы работы не указаны");
  });

  it("открыто + сегодняшнее закрытие = «Открыто до 23:00» (макет 3525:14586)", () => {
    expect(scheduleStatus(everyDay(), t, MONDAY_MORNING)).toEqual({
      label: "Открыто до 23:00",
      tone: "success",
    });
  });

  it("время закрытия берётся из СЕГОДНЯШНЕГО дня в зоне заведения", () => {
    const schedule: VenueSchedule = {
      timezone: "Asia/Almaty",
      openNow: true,
      days: [day(1, { closesAt: "01:00", closesNextDay: true }), day(2, { closesAt: "22:00" })],
    };
    // 2026-08-31T20:30Z — уже вторник 01:30 в Алматы, но ещё понедельник по UTC.
    expect(scheduleStatus(schedule, t, new Date("2026-08-31T20:30:00Z")).label).toBe("Открыто до 22:00");
    expect(scheduleStatus(schedule, t, MONDAY_MORNING).label).toBe("Открыто до 01:00");
  });

  it("открыто, а сегодняшней строки нет — голое «Открыто сейчас», не выдумываем", () => {
    const schedule: VenueSchedule = { timezone: "Asia/Almaty", openNow: true, days: [day(3)] };
    expect(scheduleStatus(schedule, t, MONDAY_MORNING).label).toBe("Открыто сейчас");
  });

  it("закрыто до открытия — «Откроется в 12:00»", () => {
    expect(scheduleStatus(everyDay({}, false), t, MONDAY_MORNING)).toEqual({
      label: "Откроется в 12:00",
      tone: "neutral",
    });
  });

  it("закрыто после закрытия — «Сейчас закрыто», «завтра» не обещаем", () => {
    expect(scheduleStatus(everyDay({}, false), t, MONDAY_NIGHT).label).toBe("Сейчас закрыто");
  });

  it("закрыто в выходной — «Сейчас закрыто»", () => {
    const schedule = everyDay({ isOpen: false, opensAt: null, closesAt: null }, false);
    expect(scheduleStatus(schedule, t, MONDAY_MORNING).label).toBe("Сейчас закрыто");
  });
});

describe("uniformDailyHours", () => {
  it("семь одинаковых дней — одно окно", () => {
    expect(uniformDailyHours(everyDay())).toEqual({
      opensAt: "12:00",
      closesAt: "23:00",
      closesNextDay: false,
    });
  });

  // Окно обязано нести closesNextDay: без него подпись под телефоном не отличит
  // «до 02:00» от «до 02:00 следующего дня» и соврёт гостю ночного заведения.
  it("семь одинаковых ночных дней — окно помечено переходом через полночь", () => {
    expect(uniformDailyHours(everyDay({ closesAt: "02:00", closesNextDay: true }))).toEqual({
      opensAt: "12:00",
      closesAt: "02:00",
      closesNextDay: true,
    });
  });

  it("один день другой или неизвестен — null", () => {
    const uneven = everyDay();
    uneven.days[5] = day(5, { closesAt: "02:00", closesNextDay: true });
    expect(uniformDailyHours(uneven)).toBeNull();
    expect(uniformDailyHours({ ...everyDay(), days: everyDay().days.slice(1) })).toBeNull();
    expect(uniformDailyHours(null)).toBeNull();
  });
});

describe("phoneHoursNote", () => {
  it("одинаковый график — «Ежедневно с 12:00 до 23:00» (макет 3525:14723)", () => {
    expect(phoneHoursNote(everyDay(), t, MONDAY_MORNING)).toBe("Ежедневно с 12:00 до 23:00");
  });

  it("разный график — окно сегодняшнего дня", () => {
    const uneven = everyDay();
    uneven.days[1] = day(1, { opensAt: "10:00", closesAt: "22:00" });
    expect(phoneHoursNote(uneven, t, MONDAY_MORNING)).toBe("Сегодня с 10:00 до 22:00");
  });

  it("сегодня выходной — так и говорим", () => {
    const uneven = everyDay();
    uneven.days[1] = day(1, { isOpen: false, opensAt: null, closesAt: null });
    expect(phoneHoursNote(uneven, t, MONDAY_MORNING)).toBe("Сегодня выходной");
  });

  it("графика нет — подписи нет", () => {
    expect(phoneHoursNote(null, t, MONDAY_MORNING)).toBeNull();
  });
});
